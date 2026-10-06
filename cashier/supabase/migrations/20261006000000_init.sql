-- =====================================================================
-- Multi-store POS + accounting: core schema, RLS, and money RPCs.
--
-- Money is always bigint Iraqi dinars (no fractions, never float).
-- Stock, invoice numbers and sale records are only ever changed by the
-- SECURITY DEFINER functions at the bottom of this file; clients have no
-- write grants on those tables.
-- =====================================================================

create extension if not exists pgcrypto;

create schema if not exists private;

create type public.app_role as enum ('owner', 'manager', 'cashier');
create type public.payment_method as enum ('cash', 'card');
create type public.sale_status as enum ('completed', 'refunded');

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(trim(name)) > 0),
  address text,
  phone text,
  -- Next invoice number for this store. Incremented inside complete_sale
  -- under a row lock, so numbers are sequential with no gaps.
  next_invoice_no bigint not null default 1 check (next_invoice_no > 0),
  created_at timestamptz not null default now()
);
create index on public.stores (organization_id);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  full_name text not null default '',
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.profiles (organization_id);

create table public.store_members (
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  primary key (user_id, store_id)
);
create index on public.store_members (store_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null check (length(trim(name)) > 0),
  barcode text,
  category text,
  sale_price bigint not null check (sale_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_store_barcode_key
  on public.products (store_id, barcode) where barcode is not null;
create index on public.products (store_id);

-- Cost price lives in its own table so cashiers can read products
-- (and get Realtime stock updates) without ever seeing cost.
create table public.product_costs (
  product_id uuid primary key references public.products (id) on delete cascade,
  cost_price bigint not null default 0 check (cost_price >= 0)
);

create table public.cash_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  cashier_id uuid not null references public.profiles (user_id),
  opening_cash bigint not null check (opening_cash >= 0),
  closing_cash bigint check (closing_cash >= 0),
  expected_cash bigint,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles (user_id)
);
-- One open shift per cashier per store.
create unique index cash_shifts_one_open
  on public.cash_shifts (store_id, cashier_id) where closed_at is null;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  invoice_no bigint not null,
  cashier_id uuid not null references public.profiles (user_id),
  shift_id uuid not null references public.cash_shifts (id),
  subtotal bigint not null check (subtotal >= 0),
  discount bigint not null default 0 check (discount >= 0 and discount <= subtotal),
  total bigint not null check (total = subtotal - discount),
  payment_method public.payment_method not null,
  paid bigint not null check (paid >= total),
  change_amount bigint not null check (change_amount = paid - total),
  status public.sale_status not null default 'completed',
  -- Lets the client retry a sale after a network drop without
  -- creating a duplicate invoice.
  client_request_id uuid,
  refunded_at timestamptz,
  refunded_by uuid references public.profiles (user_id),
  refund_shift_id uuid references public.cash_shifts (id),
  refund_reason text,
  created_at timestamptz not null default now(),
  unique (store_id, invoice_no),
  unique (store_id, client_request_id),
  check ((status = 'refunded') = (refunded_at is not null and refunded_by is not null))
);
create index on public.sales (store_id, created_at desc);
create index on public.sales (shift_id);
create index on public.sales (refund_shift_id) where refund_shift_id is not null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id),
  product_id uuid not null references public.products (id),
  name text not null,
  qty integer not null check (qty > 0),
  unit_price bigint not null check (unit_price >= 0),
  line_total bigint not null check (line_total = unit_price * qty)
);
create index on public.sale_items (sale_id);
create index on public.sale_items (product_id);

-- Cost snapshot per sold line, manager-only (same reason as product_costs).
create table public.sale_item_costs (
  sale_item_id uuid primary key references public.sale_items (id),
  unit_cost bigint not null check (unit_cost >= 0)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  category text not null check (length(trim(category)) > 0),
  amount bigint not null check (amount > 0),
  note text,
  date date not null default (now() at time zone 'Asia/Baghdad')::date,
  created_by uuid not null default auth.uid() references public.profiles (user_id),
  created_at timestamptz not null default now()
);
create index on public.expenses (store_id, date desc);

-- ---------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();

create function private.create_product_cost() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.product_costs (product_id) values (new.id)
  on conflict do nothing;
  return new;
end $$;

create trigger products_create_cost after insert on public.products
  for each row execute function private.create_product_cost();

-- Sales are never deleted. The only allowed update is the one-way
-- transition completed -> refunded performed by refund_sale.
create function private.guard_sales() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'لا يمكن حذف فاتورة بيع' using hint = 'sale_immutable';
  end if;
  if old.status <> 'completed' or new.status <> 'refunded'
     or (to_jsonb(old) - array['status','refunded_at','refunded_by','refund_shift_id','refund_reason'])
        is distinct from
        (to_jsonb(new) - array['status','refunded_at','refunded_by','refund_shift_id','refund_reason'])
  then
    raise exception 'لا يمكن تعديل فاتورة بيع' using hint = 'sale_immutable';
  end if;
  return new;
end $$;

create trigger sales_guard before update or delete on public.sales
  for each row execute function private.guard_sales();

create function private.guard_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'هذا السجل لا يمكن تعديله أو حذفه' using hint = 'sale_immutable';
end $$;

create trigger sale_items_guard before update or delete on public.sale_items
  for each row execute function private.guard_immutable();
create trigger sale_item_costs_guard before update or delete on public.sale_item_costs
  for each row execute function private.guard_immutable();

-- Store ownership of a product/shift cannot be moved to another store.
create function private.guard_store_id() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'لا يمكن نقل السجل إلى متجر آخر';
  end if;
  return new;
end $$;

create trigger products_store_fixed before update on public.products
  for each row execute function private.guard_store_id();
create trigger expenses_store_fixed before update on public.expenses
  for each row execute function private.guard_store_id();

-- ---------------------------------------------------------------------
-- Access helpers (used by RLS policies and RPCs)
-- ---------------------------------------------------------------------

create function private.current_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select organization_id from public.profiles
  where user_id = auth.uid() and is_active
$$;

create function private.current_app_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles
  where user_id = auth.uid() and is_active
$$;

-- Owner: every store in the organization. Manager/cashier: assigned stores.
create function private.can_access_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles p
    join public.stores s on s.organization_id = p.organization_id
    where p.user_id = auth.uid()
      and p.is_active
      and s.id = p_store_id
      and (p.role = 'owner' or exists (
        select 1 from public.store_members m
        where m.user_id = p.user_id and m.store_id = s.id))
  )
$$;

create function private.can_manage_store(p_store_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_access_store(p_store_id)
     and private.current_app_role() in ('owner', 'manager')
$$;

create function private.is_today(p_ts timestamptz) returns boolean
language sql stable set search_path = '' as $$
  select (p_ts at time zone 'Asia/Baghdad')::date = (now() at time zone 'Asia/Baghdad')::date
$$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.organizations   enable row level security;
alter table public.stores          enable row level security;
alter table public.profiles        enable row level security;
alter table public.store_members   enable row level security;
alter table public.products        enable row level security;
alter table public.product_costs   enable row level security;
alter table public.cash_shifts     enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.sale_item_costs enable row level security;
alter table public.expenses        enable row level security;

create policy org_select on public.organizations for select to authenticated
  using (id = private.current_org());
create policy org_update on public.organizations for update to authenticated
  using (id = private.current_org() and private.current_app_role() = 'owner')
  with check (id = private.current_org());

create policy stores_select on public.stores for select to authenticated
  using (private.can_access_store(id));
create policy stores_insert on public.stores for insert to authenticated
  with check (organization_id = private.current_org() and private.current_app_role() = 'owner');
create policy stores_update on public.stores for update to authenticated
  using (organization_id = private.current_org() and private.current_app_role() = 'owner')
  with check (organization_id = private.current_org());

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = auth.uid()
         or (organization_id = private.current_org()
             and private.current_app_role() in ('owner', 'manager')));

create policy members_select on public.store_members for select to authenticated
  using (user_id = auth.uid() or private.can_manage_store(store_id));

create policy products_select on public.products for select to authenticated
  using (private.can_access_store(store_id));
create policy products_insert on public.products for insert to authenticated
  with check (private.can_manage_store(store_id));
create policy products_update on public.products for update to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));

create policy product_costs_select on public.product_costs for select to authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_id and private.can_manage_store(p.store_id)));
create policy product_costs_update on public.product_costs for update to authenticated
  using (exists (select 1 from public.products p
                 where p.id = product_id and private.can_manage_store(p.store_id)));

create policy shifts_select on public.cash_shifts for select to authenticated
  using (private.can_manage_store(store_id)
         or (cashier_id = auth.uid() and private.can_access_store(store_id)));

-- Cashiers see only today's sales in their own stores.
create policy sales_select on public.sales for select to authenticated
  using (private.can_manage_store(store_id)
         or (private.can_access_store(store_id) and private.is_today(created_at)));

-- Item visibility follows the parent sale's visibility.
create policy sale_items_select on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id));

create policy sale_item_costs_select on public.sale_item_costs for select to authenticated
  using (exists (select 1 from public.sale_items i
                 join public.sales s on s.id = i.sale_id
                 where i.id = sale_item_id and private.can_manage_store(s.store_id)));

create policy expenses_select on public.expenses for select to authenticated
  using (private.can_manage_store(store_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (private.can_manage_store(store_id));
create policy expenses_update on public.expenses for update to authenticated
  using (private.can_manage_store(store_id))
  with check (private.can_manage_store(store_id));
create policy expenses_delete on public.expenses for delete to authenticated
  using (private.can_manage_store(store_id) and private.current_app_role() = 'owner');

-- ---------------------------------------------------------------------
-- Grants. Supabase grants everything in public to anon/authenticated by
-- default, so start from nothing and add back only what clients need.
-- Column lists keep counters, stock and audit fields client-read-only.
-- ---------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant usage on schema private to authenticated;
grant execute on all functions in schema private to authenticated;

grant select on public.organizations, public.stores, public.profiles, public.store_members,
  public.products, public.product_costs, public.cash_shifts, public.sales,
  public.sale_items, public.sale_item_costs, public.expenses to authenticated;

grant update (name) on public.organizations to authenticated;
grant insert (organization_id, name, address, phone) on public.stores to authenticated;
grant update (name, address, phone) on public.stores to authenticated;
grant insert (store_id, name, barcode, category, sale_price, stock, low_stock_threshold, is_active)
  on public.products to authenticated;
-- Stock is adjusted by managers here; sales/refunds adjust it via RPC.
grant update (name, barcode, category, sale_price, stock, low_stock_threshold, is_active)
  on public.products to authenticated;
grant update (cost_price) on public.product_costs to authenticated;
grant insert (store_id, category, amount, note, date) on public.expenses to authenticated;
grant update (category, amount, note, date) on public.expenses to authenticated;
grant delete on public.expenses to authenticated;

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Receipt payload without any cost data (safe to return to cashiers).
create function private.sale_receipt(p_sale_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'store_id', s.store_id,
    'store_name', st.name,
    'store_address', st.address,
    'store_phone', st.phone,
    'invoice_no', s.invoice_no,
    'cashier_name', p.full_name,
    'created_at', s.created_at,
    'subtotal', s.subtotal,
    'discount', s.discount,
    'total', s.total,
    'payment_method', s.payment_method,
    'paid', s.paid,
    'change_amount', s.change_amount,
    'status', s.status,
    'refunded_at', s.refunded_at,
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'product_id', i.product_id, 'name', i.name, 'qty', i.qty,
        'unit_price', i.unit_price, 'line_total', i.line_total) order by i.name), '[]'::jsonb)
      from public.sale_items i where i.sale_id = s.id)
  )
  from public.sales s
  join public.stores st on st.id = s.store_id
  join public.profiles p on p.user_id = s.cashier_id
  where s.id = p_sale_id
$$;
revoke all on function private.sale_receipt(uuid) from public, anon, authenticated;

-- First-time setup: the signed-in user becomes owner of a new
-- organization with one store.
create function public.create_organization(p_org_name text, p_store_name text, p_full_name text default '')
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'يجب تسجيل الدخول' using errcode = '42501', hint = 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where user_id = v_uid) then
    raise exception 'هذا الحساب مرتبط بمؤسسة بالفعل' using hint = 'already_member';
  end if;

  insert into public.organizations (name) values (p_org_name) returning id into v_org;
  insert into public.profiles (user_id, organization_id, full_name, role)
    values (v_uid, v_org, coalesce(p_full_name, ''), 'owner');
  insert into public.stores (organization_id, name) values (v_org, p_store_name);
  return v_org;
end $$;

-- Owner adds or updates a staff member (who already has an auth account)
-- and sets exactly which stores they work in.
create function public.upsert_staff(
  p_user_id uuid, p_full_name text, p_role public.app_role, p_store_ids uuid[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.current_org();
begin
  if private.current_app_role() is distinct from 'owner' then
    raise exception 'هذه العملية للمالك فقط' using errcode = '42501', hint = 'not_authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'لا يمكنك تعديل صلاحياتك بنفسك' using hint = 'self_edit';
  end if;
  if exists (select 1 from public.profiles
             where user_id = p_user_id and organization_id <> v_org) then
    raise exception 'هذا المستخدم يتبع مؤسسة أخرى' using errcode = '42501', hint = 'not_authorized';
  end if;
  if exists (select 1 from unnest(coalesce(p_store_ids, '{}')) sid
             where not exists (select 1 from public.stores s
                               where s.id = sid and s.organization_id = v_org)) then
    raise exception 'متجر غير صالح' using hint = 'invalid_store';
  end if;

  insert into public.profiles (user_id, organization_id, full_name, role)
    values (p_user_id, v_org, coalesce(p_full_name, ''), p_role)
  on conflict (user_id) do update
    set full_name = excluded.full_name, role = excluded.role;

  delete from public.store_members where user_id = p_user_id;
  insert into public.store_members (user_id, store_id)
    select distinct p_user_id, sid from unnest(coalesce(p_store_ids, '{}')) sid;
end $$;

create function public.set_staff_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if private.current_app_role() is distinct from 'owner' then
    raise exception 'هذه العملية للمالك فقط' using errcode = '42501', hint = 'not_authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'لا يمكنك تعطيل حسابك' using hint = 'self_edit';
  end if;
  update public.profiles set is_active = p_active
   where user_id = p_user_id and organization_id = private.current_org();
  if not found then
    raise exception 'المستخدم غير موجود' using hint = 'not_found';
  end if;
end $$;

create function public.open_shift(p_store_id uuid, p_opening_cash bigint)
returns public.cash_shifts
language plpgsql security definer set search_path = '' as $$
declare
  v_shift public.cash_shifts;
begin
  if not private.can_access_store(p_store_id) then
    raise exception 'غير مصرح لك في هذا المتجر' using errcode = '42501', hint = 'not_authorized';
  end if;
  begin
    insert into public.cash_shifts (store_id, cashier_id, opening_cash)
      values (p_store_id, auth.uid(), p_opening_cash)
      returning * into v_shift;
  exception when unique_violation then
    raise exception 'لديك وردية مفتوحة بالفعل في هذا المتجر' using hint = 'shift_already_open';
  end;
  return v_shift;
end $$;

-- Expected cash = opening cash + cash sales taken in this shift
--                 - cash refunds paid out in this shift.
create function public.close_shift(p_shift_id uuid, p_closing_cash bigint)
returns public.cash_shifts
language plpgsql security definer set search_path = '' as $$
declare
  v_shift public.cash_shifts;
  v_expected bigint;
begin
  select * into v_shift from public.cash_shifts where id = p_shift_id for update;
  if not found
     or not (v_shift.cashier_id = auth.uid() and private.can_access_store(v_shift.store_id)
             or private.can_manage_store(v_shift.store_id)) then
    raise exception 'الوردية غير موجودة' using hint = 'not_found';
  end if;
  if v_shift.closed_at is not null then
    raise exception 'الوردية مغلقة بالفعل' using hint = 'shift_closed';
  end if;

  select v_shift.opening_cash
         + coalesce((select sum(total) from public.sales
                     where shift_id = v_shift.id and payment_method = 'cash'), 0)
         - coalesce((select sum(total) from public.sales
                     where refund_shift_id = v_shift.id and payment_method = 'cash'), 0)
    into v_expected;

  update public.cash_shifts
     set closing_cash = p_closing_cash, expected_cash = v_expected,
         closed_at = now(), closed_by = auth.uid()
   where id = v_shift.id
   returning * into v_shift;
  return v_shift;
end $$;

-- The only way to create a sale. Everything happens in one transaction:
-- prices and costs come from the database (never from the client), stock
-- is deducted with a guarded UPDATE, and the invoice number is taken from
-- the store row last so its lock is held as briefly as possible. Any
-- failure rolls back everything, including the invoice counter.
--
-- p_items: [{"product_id": "<uuid>", "qty": <int>}, ...]
create function public.complete_sale(
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

-- Full-invoice return by a manager or owner. Restores stock, marks the
-- sale refunded, and records who did it and when. Cash refunds come out
-- of the refunder's open shift so the drawer still balances.
create function public.refund_sale(p_sale_id uuid, p_reason text default null)
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

  for v_line in
    select product_id, sum(qty)::int as qty
    from public.sale_items where sale_id = v_sale.id
    group by product_id
    order by product_id
  loop
    update public.products set stock = stock + v_line.qty where id = v_line.product_id;
  end loop;

  update public.sales
     set status = 'refunded', refunded_at = now(), refunded_by = v_uid,
         refund_shift_id = v_shift_id, refund_reason = nullif(trim(p_reason), '')
   where id = v_sale.id;

  return private.sale_receipt(v_sale.id);
end $$;

revoke all on function public.create_organization(text, text, text) from public, anon;
revoke all on function public.upsert_staff(uuid, text, public.app_role, uuid[]) from public, anon;
revoke all on function public.set_staff_active(uuid, boolean) from public, anon;
revoke all on function public.open_shift(uuid, bigint) from public, anon;
revoke all on function public.close_shift(uuid, bigint) from public, anon;
revoke all on function public.complete_sale(uuid, jsonb, public.payment_method, bigint, bigint, uuid) from public, anon;
revoke all on function public.refund_sale(uuid, text) from public, anon;

grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.upsert_staff(uuid, text, public.app_role, uuid[]) to authenticated;
grant execute on function public.set_staff_active(uuid, boolean) to authenticated;
grant execute on function public.open_shift(uuid, bigint) to authenticated;
grant execute on function public.close_shift(uuid, bigint) to authenticated;
grant execute on function public.complete_sale(uuid, jsonb, public.payment_method, bigint, bigint, uuid) to authenticated;
grant execute on function public.refund_sale(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime (Supabase only; RLS still applies to what each client receives)
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sales, public.products, public.expenses;
  end if;
end $$;
