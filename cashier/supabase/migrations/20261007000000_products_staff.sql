-- Phase 3: atomic product save (product + cost) and owner staff listing.

-- Creates or updates a product and its cost price in one transaction, so
-- a product never exists with a missing or stale cost.
create function public.save_product(
  p_store_id uuid,
  p_name text,
  p_sale_price bigint,
  p_cost_price bigint,
  p_stock integer,
  p_barcode text default null,
  p_category text default null,
  p_low_stock_threshold integer default 0,
  p_is_active boolean default true,
  p_id uuid default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_store uuid;
begin
  if p_id is not null then
    select store_id into v_store from public.products where id = p_id for update;
    if not found or v_store <> p_store_id then
      raise exception 'المنتج غير موجود في هذا المتجر' using hint = 'product_not_found';
    end if;
  end if;
  if not private.can_manage_store(p_store_id) then
    raise exception 'غير مصرح لك بإدارة منتجات هذا المتجر' using errcode = '42501', hint = 'not_authorized';
  end if;
  if p_cost_price is null or p_cost_price < 0 then
    raise exception 'سعر التكلفة غير صالح' using hint = 'invalid_cost';
  end if;

  begin
    if v_id is null then
      insert into public.products (store_id, name, barcode, category, sale_price, stock,
                                   low_stock_threshold, is_active)
      values (p_store_id, trim(p_name), nullif(trim(p_barcode), ''), nullif(trim(p_category), ''),
              p_sale_price, p_stock, coalesce(p_low_stock_threshold, 0), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.products
         set name = trim(p_name),
             barcode = nullif(trim(p_barcode), ''),
             category = nullif(trim(p_category), ''),
             sale_price = p_sale_price,
             stock = p_stock,
             low_stock_threshold = coalesce(p_low_stock_threshold, 0),
             is_active = coalesce(p_is_active, true)
       where id = v_id;
    end if;
  exception
    when unique_violation then
      raise exception 'الباركود مستخدم لمنتج آخر في هذا المتجر' using hint = 'duplicate_barcode';
    when check_violation then
      raise exception 'تحقق من الاسم والسعر والمخزون (لا قيم سالبة)' using hint = 'invalid_product';
  end;

  update public.product_costs set cost_price = p_cost_price where product_id = v_id;
  return v_id;
end $$;

-- Owner-only list of staff in the organization, including login email
-- (which lives in auth.users and is not otherwise readable).
create function public.org_staff()
returns table (user_id uuid, email text, full_name text, role public.app_role,
               is_active boolean, store_ids uuid[], created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if private.current_app_role() is distinct from 'owner' then
    raise exception 'هذه العملية للمالك فقط' using errcode = '42501', hint = 'not_authorized';
  end if;
  return query
    select p.user_id, u.email::text, p.full_name, p.role, p.is_active,
           coalesce(array_agg(m.store_id) filter (where m.store_id is not null), '{}'),
           p.created_at
    from public.profiles p
    join auth.users u on u.id = p.user_id
    left join public.store_members m on m.user_id = p.user_id
    where p.organization_id = private.current_org()
    group by p.user_id, u.email, p.full_name, p.role, p.is_active, p.created_at
    order by p.created_at;
end $$;

revoke all on function public.save_product(uuid, text, bigint, bigint, integer, text, text, integer, boolean, uuid)
  from public, anon;
revoke all on function public.org_staff() from public, anon;
grant execute on function public.save_product(uuid, text, bigint, bigint, integer, text, text, integer, boolean, uuid)
  to authenticated;
grant execute on function public.org_staff() to authenticated;
