-- Phase 4: stock movement log, receipt lookup, dashboard statistics.

-- ---------------------------------------------------------------------
-- Stock movements: every change to products.stock is logged by trigger,
-- including direct edits by managers, with who/when/why.
-- ---------------------------------------------------------------------

create type public.stock_reason as enum ('initial', 'sale', 'refund', 'adjustment');

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id),
  store_id uuid not null references public.stores (id),
  change integer not null,
  stock_after integer not null,
  reason public.stock_reason not null,
  -- Deferred: complete_sale deducts stock before inserting the sale row.
  sale_id uuid references public.sales (id) deferrable initially deferred,
  created_by uuid references public.profiles (user_id),
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id, created_at desc);
create index on public.stock_movements (store_id, created_at desc);

create function private.log_stock_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_reason text := nullif(current_setting('app.stock_reason', true), '');
  v_ref text := nullif(current_setting('app.stock_ref', true), '');
  v_change integer;
begin
  if tg_op = 'INSERT' then
    v_change := new.stock;
    v_reason := 'initial';
    v_ref := null;
  else
    v_change := new.stock - old.stock;
  end if;
  if v_change = 0 then
    return new;
  end if;
  insert into public.stock_movements (product_id, store_id, change, stock_after, reason, sale_id, created_by)
  values (new.id, new.store_id, v_change, new.stock,
          coalesce(v_reason, 'adjustment')::public.stock_reason,
          case when v_reason in ('sale', 'refund') then v_ref::uuid end,
          (select user_id from public.profiles where user_id = auth.uid()));
  return new;
end $$;

create trigger products_log_stock after insert or update of stock on public.products
  for each row execute function private.log_stock_movement();

create trigger stock_movements_guard before update or delete on public.stock_movements
  for each row execute function private.guard_immutable();

alter table public.stock_movements enable row level security;
create policy stock_movements_select on public.stock_movements for select to authenticated
  using (private.can_manage_store(store_id));
revoke all on public.stock_movements from anon, authenticated;
grant select on public.stock_movements to authenticated;

-- Existing stock becomes the opening balance of the log.
insert into public.stock_movements (product_id, store_id, change, stock_after, reason)
select id, store_id, stock, stock, 'initial' from public.products where stock <> 0;

-- complete_sale / refund_sale: unchanged except they tag their stock
-- updates so the log shows "sale"/"refund" with the invoice.
create or replace function public.complete_sale(
  p_store_id uuid,
  p_items jsonb,
  p_payment_method public.payment_method,
  p_paid bigint default null,
  p_discount bigint default 0,
  p_client_request_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_shift_id uuid;
  v_existing uuid;
  v_sale_id uuid := gen_random_uuid();
  v_line record;
  v_product public.products;
  v_cost bigint;
  v_lines jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_discount bigint := coalesce(p_discount, 0);
  v_total bigint;
  v_paid bigint;
  v_invoice bigint;
begin
  if v_uid is null or not private.can_access_store(p_store_id) then
    raise exception 'غير مصرح لك بالبيع في هذا المتجر' using errcode = '42501', hint = 'not_authorized';
  end if;

  if p_client_request_id is not null then
    select id into v_existing from public.sales
     where store_id = p_store_id and client_request_id = p_client_request_id;
    if found then
      return private.sale_receipt(v_existing);
    end if;
  end if;

  -- FOR SHARE blocks close_shift from closing the drawer mid-sale.
  select id into v_shift_id from public.cash_shifts
   where store_id = p_store_id and cashier_id = v_uid and closed_at is null
   for share;
  if v_shift_id is null then
    raise exception 'يجب فتح وردية قبل البيع' using hint = 'no_open_shift';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'السلة فارغة' using hint = 'empty_cart';
  end if;
  if exists (select 1 from jsonb_array_elements(p_items) e
             where jsonb_typeof(e) <> 'object'
                or jsonb_typeof(e -> 'product_id') <> 'string'
                or jsonb_typeof(e -> 'qty') <> 'number'
                or (e ->> 'qty')::numeric <= 0
                or (e ->> 'qty')::numeric <> trunc((e ->> 'qty')::numeric)) then
    raise exception 'بيانات السلة غير صالحة' using hint = 'invalid_items';
  end if;

  -- Tag the stock changes below so the movement log records them as a sale.
  perform set_config('app.stock_reason', 'sale', true);
  perform set_config('app.stock_ref', v_sale_id::text, true);

  -- Merge duplicate lines and lock products in a fixed order so two
  -- concurrent sales of the same products cannot deadlock.
  for v_line in
    select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    update public.products
       set stock = stock - v_line.qty
     where id = v_line.product_id
       and store_id = p_store_id
       and is_active
       and stock >= v_line.qty
    returning * into v_product;

    if not found then
      select * into v_product from public.products
       where id = v_line.product_id and store_id = p_store_id and is_active;
      if not found then
        raise exception 'المنتج غير موجود في هذا المتجر' using hint = 'product_not_found';
      end if;
      raise exception 'المخزون غير كافٍ للمنتج "%" (المتوفر: %، المطلوب: %)',
        v_product.name, v_product.stock, v_line.qty
        using hint = 'insufficient_stock';
    end if;

    select cost_price into v_cost from public.product_costs where product_id = v_product.id;

    v_subtotal := v_subtotal + v_product.sale_price * v_line.qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id,
      'name', v_product.name,
      'qty', v_line.qty,
      'unit_price', v_product.sale_price,
      'unit_cost', coalesce(v_cost, 0));
  end loop;
  -- set_config(..., true) lasts until transaction end: clear the tag so later
  -- stock edits in the same transaction are not mislabelled.
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_ref', '', true);

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'الخصم غير صالح' using hint = 'invalid_discount';
  end if;
  v_total := v_subtotal - v_discount;

  if p_payment_method = 'cash' then
    v_paid := coalesce(p_paid, v_total);
    if v_paid < v_total then
      raise exception 'المبلغ المدفوع أقل من الإجمالي' using hint = 'insufficient_payment';
    end if;
  else
    v_paid := v_total;
  end if;

  update public.stores
     set next_invoice_no = next_invoice_no + 1
   where id = p_store_id
   returning next_invoice_no - 1 into v_invoice;

  insert into public.sales (id, store_id, invoice_no, cashier_id, shift_id, subtotal, discount,
                            total, payment_method, paid, change_amount, client_request_id)
  values (v_sale_id, p_store_id, v_invoice, v_uid, v_shift_id, v_subtotal, v_discount,
          v_total, p_payment_method, v_paid, v_paid - v_total, p_client_request_id);

  with lines as (
    select gen_random_uuid() as id, l.*
    from jsonb_to_recordset(v_lines)
      as l(product_id uuid, name text, qty int, unit_price bigint, unit_cost bigint)
  ), items as (
    insert into public.sale_items (id, sale_id, product_id, name, qty, unit_price, line_total)
    select id, v_sale_id, product_id, name, qty, unit_price, unit_price * qty from lines
  )
  insert into public.sale_item_costs (sale_item_id, unit_cost)
  select id, unit_cost from lines;

  return private.sale_receipt(v_sale_id);
end $$;

create or replace function public.refund_sale(p_sale_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_sale public.sales;
  v_shift_id uuid;
  v_line record;
begin
  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found or not private.can_manage_store(v_sale.store_id) then
    raise exception 'غير مصرح لك بإرجاع هذه الفاتورة' using errcode = '42501', hint = 'not_authorized';
  end if;
  if v_sale.status = 'refunded' then
    raise exception 'تم إرجاع هذه الفاتورة مسبقاً' using hint = 'already_refunded';
  end if;

  if v_sale.payment_method = 'cash' then
    select id into v_shift_id from public.cash_shifts
     where store_id = v_sale.store_id and cashier_id = v_uid and closed_at is null
     for share;
    if v_shift_id is null then
      raise exception 'يجب فتح وردية لإرجاع مبلغ نقدي' using hint = 'no_open_shift';
    end if;
  end if;

  perform set_config('app.stock_reason', 'refund', true);
  perform set_config('app.stock_ref', v_sale.id::text, true);

  for v_line in
    select product_id, sum(qty)::int as qty
    from public.sale_items where sale_id = v_sale.id
    group by product_id
    order by product_id
  loop
    update public.products set stock = stock + v_line.qty where id = v_line.product_id;
  end loop;
  -- set_config(..., true) lasts until transaction end: clear the tag so later
  -- stock edits in the same transaction are not mislabelled.
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_ref', '', true);

  update public.sales
     set status = 'refunded', refunded_at = now(), refunded_by = v_uid,
         refund_shift_id = v_shift_id, refund_reason = nullif(trim(p_reason), '')
   where id = v_sale.id;

  return private.sale_receipt(v_sale.id);
end $$;

-- ---------------------------------------------------------------------
-- Receipt lookup for reprinting, with the same visibility as sales RLS.
-- ---------------------------------------------------------------------

create function public.get_receipt(p_sale_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.sales s
    where s.id = p_sale_id
      and (private.can_manage_store(s.store_id)
           or (private.can_access_store(s.store_id) and private.is_today(s.created_at)))
  ) then
    raise exception 'الفاتورة غير موجودة' using hint = 'not_found';
  end if;
  return private.sale_receipt(p_sale_id);
end $$;

-- ---------------------------------------------------------------------
-- Dashboard: revenue, cost of goods, expenses and net profit per store,
-- per day, and top products, for the stores the caller manages.
-- Refunded invoices are excluded (the sale was reversed).
-- Days are Baghdad calendar days.
-- ---------------------------------------------------------------------

create function public.dashboard_stats(p_from date, p_to date, p_store_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_stores uuid[];
  v_result jsonb;
begin
  if private.current_app_role() not in ('owner', 'manager') then
    raise exception 'غير مصرح' using errcode = '42501', hint = 'not_authorized';
  end if;
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366 then
    raise exception 'فترة غير صالحة' using hint = 'invalid_range';
  end if;

  select coalesce(array_agg(s.id), '{}') into v_stores
  from public.stores s
  where private.can_manage_store(s.id) and (p_store_id is null or s.id = p_store_id);
  if p_store_id is not null and cardinality(v_stores) = 0 then
    raise exception 'غير مصرح' using errcode = '42501', hint = 'not_authorized';
  end if;

  with
  sales as (
    select s.*, (s.created_at at time zone 'Asia/Baghdad')::date as day
    from public.sales s
    where s.store_id = any (v_stores)
      and (s.created_at at time zone 'Asia/Baghdad')::date between p_from and p_to
  ),
  done as (select * from sales where status = 'completed'),
  lines as (
    select d.store_id, d.day, i.product_id, i.name, i.qty, i.line_total, c.unit_cost * i.qty as cost
    from done d
    join public.sale_items i on i.sale_id = d.id
    join public.sale_item_costs c on c.sale_item_id = i.id
  ),
  exp as (
    select e.store_id, e.date as day, e.amount
    from public.expenses e
    where e.store_id = any (v_stores) and e.date between p_from and p_to
  ),
  per_store as (
    select st.id, st.name,
      (select count(*) from done d where d.store_id = st.id) as sales_count,
      (select coalesce(sum(total), 0) from done d where d.store_id = st.id) as revenue,
      (select coalesce(sum(discount), 0) from done d where d.store_id = st.id) as discounts,
      (select coalesce(sum(total), 0) from done d where d.store_id = st.id and payment_method = 'cash') as cash,
      (select coalesce(sum(total), 0) from done d where d.store_id = st.id and payment_method = 'card') as card,
      (select coalesce(sum(cost), 0) from lines l where l.store_id = st.id) as cogs,
      (select coalesce(sum(amount), 0) from exp x where x.store_id = st.id) as expenses,
      (select count(*) from sales s where s.store_id = st.id and s.status = 'refunded') as refunds_count,
      (select coalesce(sum(total), 0) from sales s where s.store_id = st.id and s.status = 'refunded') as refunds_total
    from public.stores st
    where st.id = any (v_stores)
  ),
  days as (
    select g::date as day from generate_series(p_from, p_to, interval '1 day') g
  ),
  per_day as (
    select dd.day,
      (select coalesce(sum(total), 0) from done d where d.day = dd.day) as revenue,
      (select coalesce(sum(cost), 0) from lines l where l.day = dd.day) as cogs,
      (select coalesce(sum(amount), 0) from exp x where x.day = dd.day) as expenses
    from days dd
  ),
  top as (
    select product_id, min(name) as name, sum(qty) as qty, sum(line_total) as revenue,
           sum(line_total) - sum(cost) as profit
    from lines group by product_id
    order by sum(line_total) desc limit 10
  )
  select jsonb_build_object(
    'stores', coalesce((select jsonb_agg(jsonb_build_object(
        'store_id', id, 'name', name, 'sales_count', sales_count, 'revenue', revenue,
        'discounts', discounts, 'cash', cash, 'card', card, 'cogs', cogs,
        'gross_profit', revenue - cogs, 'expenses', expenses,
        'net_profit', revenue - cogs - expenses,
        'refunds_count', refunds_count, 'refunds_total', refunds_total) order by name)
      from per_store), '[]'::jsonb),
    'days', coalesce((select jsonb_agg(jsonb_build_object(
        'day', day, 'revenue', revenue, 'net_profit', revenue - cogs - expenses) order by day)
      from per_day), '[]'::jsonb),
    'top_products', coalesce((select jsonb_agg(jsonb_build_object(
        'product_id', product_id, 'name', name, 'qty', qty, 'revenue', revenue, 'profit', profit)
        order by revenue desc) from top), '[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;

revoke all on function public.get_receipt(uuid) from public, anon;
revoke all on function public.dashboard_stats(date, date, uuid) from public, anon;
grant execute on function public.get_receipt(uuid) to authenticated;
grant execute on function public.dashboard_stats(date, date, uuid) to authenticated;
