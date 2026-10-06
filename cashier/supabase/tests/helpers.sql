-- Test helpers. Applied after the migration, test databases only.

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

-- Act as a signed-in Supabase user for the rest of the transaction.
create or replace function tests.login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.ok(p_cond boolean, p_name text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then
    raise exception 'FAIL: %', p_name;
  end if;
  raise notice 'ok - %', p_name;
end $$;

-- Passes when p_sql raises an error. If p_hint is given, the error's
-- HINT must match it; if p_sqlstate is given, the SQLSTATE must match.
create or replace function tests.throws(
  p_sql text, p_name text, p_hint text default null, p_sqlstate text default null)
returns void
language plpgsql as $$
declare
  v_hint text;
  v_state text;
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint, v_state = returned_sqlstate,
                            v_msg = message_text;
    if (p_hint is null or v_hint = p_hint) and (p_sqlstate is null or v_state = p_sqlstate) then
      raise notice 'ok - % (%)', p_name, v_msg;
      return;
    end if;
    raise exception 'FAIL: % - wrong error: [%] hint=% msg=%', p_name, v_state, v_hint, v_msg;
  end;
  raise exception 'FAIL: % - expected an error, none raised', p_name;
end $$;

-- Fixture lookups that ignore RLS.
create or replace function tests.store(p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.stores where name = p_name
$$;

create or replace function tests.product(p_store text, p_name text) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.products p join public.stores s on s.id = p.store_id
  where s.name = p_store and p.name = p_name
$$;

create or replace function tests.last_sale(p_store text) returns uuid
language sql stable security definer set search_path = '' as $$
  select sa.id from public.sales sa join public.stores s on s.id = sa.store_id
  where s.name = p_store order by sa.invoice_no desc limit 1
$$;

grant execute on all functions in schema tests to authenticated, anon;
