#!/usr/bin/env bash
# Loads a realistic demo business into a LOCAL Supabase (npx supabase start):
# 3 stores, owner + manager + 3 cashiers, a grocery catalog, 14 days of
# sales (a few refunded) and expenses. Run on an empty database
# (npx supabase db reset). Never point this at production.
#
#   scripts/demo-seed.sh
#
# Logins (password demo1234 for all):
#   owner@demo.iq (owner) · mona (manager, Karrada) · ali (Karrada)
#   sara (Mansour) · hassan (Zayouna)
set -euo pipefail
cd "$(dirname "$0")/.."

API=${SUPABASE_URL:-http://127.0.0.1:54321}
DB=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
SR=${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}

user() { # email -> uuid
  curl -sS -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"demo1234\",\"email_confirm\":true}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.id){console.error(s);process.exit(1)}console.log(j.id)})'
}

OWNER=$(user owner@demo.iq)
MONA=$(user mona@staff.cashier.local)
ALI=$(user ali@staff.cashier.local)
SARA=$(user sara@staff.cashier.local)
HASSAN=$(user hassan@staff.cashier.local)

psql -X -q -v ON_ERROR_STOP=1 "$DB" \
  -v owner="$OWNER" -v mona="$MONA" -v ali="$ALI" -v sara="$SARA" -v hassan="$HASSAN" >/dev/null <<'SQL'
\set ON_ERROR_STOP 1
begin;

-- Act as a user for RPCs (same mechanism Supabase uses for auth.uid()).
create temp table who (k text primary key, id uuid);
insert into who values ('owner', :'owner'), ('mona', :'mona'), ('ali', :'ali'),
                       ('sara', :'sara'), ('hassan', :'hassan');
grant select on who to authenticated;

create or replace function pg_temp.act_as(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.act_as(:'owner');
select public.create_organization('أسواق الرافدين', 'فرع الكرادة', 'أبو أحمد');
update public.stores set address = 'بغداد - الكرادة داخل', phone = '07701111111' where name = 'فرع الكرادة';
insert into public.stores (organization_id, name, address, phone)
select organization_id, s.name, s.address, s.phone
from public.profiles,
     (values ('فرع المنصور', 'بغداد - شارع 14 رمضان', '07702222222'),
             ('فرع زيونة', 'بغداد - زيونة، قرب الجامع', '07703333333')) s(name, address, phone)
where user_id = :'owner';

create temp table st as select id, name from public.stores;

select public.upsert_staff(:'mona', 'منى', 'manager', array[(select id from st where name = 'فرع الكرادة')]);
select public.upsert_staff(:'ali', 'علي', 'cashier', array[(select id from st where name = 'فرع الكرادة')]);
select public.upsert_staff(:'sara', 'سارة', 'cashier', array[(select id from st where name = 'فرع المنصور')]);
select public.upsert_staff(:'hassan', 'حسن', 'cashier', array[(select id from st where name = 'فرع زيونة')]);

-- Same catalog in every store (price, cost, opening stock, low-stock alert).
create temp table catalog (name text, barcode text, category text, price bigint, cost bigint, stock int, low int);
insert into catalog values
  ('شاي محمود 500غ',       '6281001', 'مواد غذائية', 4500, 3600, 120, 15),
  ('سكر 1كغ',              '6281002', 'مواد غذائية', 1500, 1150, 200, 30),
  ('رز بسمتي 5كغ',         '6281003', 'مواد غذائية', 14000, 11500, 60, 10),
  ('زيت دوار الشمس 1.8لتر', '6281004', 'مواد غذائية', 5000, 4100, 80, 12),
  ('طحين 10كغ',            '6281005', 'مواد غذائية', 9000, 7600, 40, 8),
  ('معجون طماطة',          '6281006', 'معلبات',      1250, 900, 150, 20),
  ('تونة',                 '6281007', 'معلبات',      1750, 1300, 100, 15),
  ('بيبسي 1لتر',           '6281008', 'مشروبات',     1000, 700, 240, 40),
  ('ماء 12 قنينة',         '6281009', 'مشروبات',     3000, 2200, 90, 15),
  ('حليب 1لتر',            '6281010', 'ألبان',       1500, 1100, 140, 25),
  ('جبن مثلثات',           '6281011', 'ألبان',       2500, 1900, 70, 10),
  ('بيض طبقة 30',          '6281012', 'ألبان',       7000, 6000, 50, 10),
  ('صمون 10 قطع',          '6281013', 'مخبوزات',     1000, 650, 300, 50),
  ('معكرونة',              '6281014', 'مواد غذائية', 1000, 700, 180, 25);

select pg_temp.act_as(:'owner');
-- Opening stock sized so a fortnight of sales leaves a few items low.
select public.save_product(s.id, c.name, c.price, c.cost, c.stock * 3, c.barcode, c.category, c.low)
from st s cross join catalog c;

-- Each cashier opens a shift; 14 days of sales are rung up through the real
-- complete_sale RPC (stock, invoices, costs all real), then back-dated.
create temp table sold (id uuid, store text, day int);
do $$
declare
  c record;
  d int;
  n int;
  i int;
  items jsonb;
  r jsonb;
  busy numeric;
begin
  for c in select w.id as uid, st.id as store_id, st.name as store,
                  case st.name when 'فرع الكرادة' then 1.3 when 'فرع المنصور' then 1.0 else 0.7 end as weight
           from who w join public.store_members m on m.user_id = w.id join st on st.id = m.store_id
           join public.profiles p on p.user_id = w.id and p.role = 'cashier'
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', c.uid)::text, true);
    perform public.open_shift(c.store_id, 100000);
    for d in reverse 13..0 loop
      -- Busier towards the weekend (Thu/Fri) and growing over the fortnight.
      busy := c.weight * (1 + (13 - d) * 0.03)
              * case extract(dow from current_date - d) when 4 then 1.4 when 5 then 1.6 else 1 end;
      n := greatest(3, round((10 + random() * 8) * busy));
      for i in 1..n loop
        select jsonb_agg(jsonb_build_object('product_id', p.id, 'qty', 1 + floor(random() * 3)::int))
          into items
        from (select id from public.products where store_id = c.store_id and stock > 5
              order by random() limit 1 + floor(random() * 4)::int) p;
        continue when items is null;
        r := public.complete_sale(c.store_id, items,
               case when random() < 0.75 then 'cash' else 'card' end::public.payment_method,
               null,
               case when random() < 0.1 then 500 else 0 end);
        insert into sold values ((r->>'id')::uuid, c.store, d);
      end loop;
    end loop;
  end loop;
end $$;

-- Back-date: spread each day's sales between 9:00 and 22:00 Baghdad time,
-- keeping invoice order chronological.
alter table public.sales disable trigger sales_guard;
update public.sales s
   set created_at = ((current_date - x.day) + time '09:00'
                    + (x.rn::numeric / (x.cnt + 1)) * interval '13 hours') at time zone 'Asia/Baghdad'
  from (select sold.id, sold.day,
               row_number() over (partition by sold.store, sold.day order by sa.invoice_no) as rn,
               count(*) over (partition by sold.store, sold.day) as cnt
        from sold join public.sales sa on sa.id = sold.id) x
 where s.id = x.id;
alter table public.sales enable trigger sales_guard;
-- Run the deferred invoice-link checks now; ALTER needs no pending events.
set constraints all immediate;
alter table public.stock_movements disable trigger stock_movements_guard;
update public.stock_movements m set created_at = s.created_at
  from public.sales s where m.sale_id = s.id;
alter table public.stock_movements enable trigger stock_movements_guard;

-- A few returns (card, so no shift needed), by the manager.
select pg_temp.act_as(:'mona');
select public.refund_sale(id, 'منتج تالف')
from (select sa.id from public.sales sa join st on st.id = sa.store_id
      where st.name = 'فرع الكرادة' and sa.payment_method = 'card' and sa.created_at < now() - interval '1 day'
      order by sa.invoice_no limit 3) x;

-- Expenses per store.
select pg_temp.act_as(:'owner');
insert into public.expenses (store_id, category, amount, note, date)
select st.id, e.category, e.amount, e.note, current_date - e.days_ago
from st cross join (values
  ('إيجار', 350000, 'نصف إيجار الشهر', 12),
  ('رواتب', 250000, 'سلفة رواتب', 2),
  ('مولدة', 45000, 'اشتراك 10 أمبير', 10),
  ('كهرباء', 20000, null, 8),
  ('نقل', 15000, 'توصيل بضاعة', 5),
  ('تنظيف', 10000, null, 3)
) e(category, amount, note, days_ago);
update public.expenses set amount = amount * 0.7 where store_id = (select id from st where name = 'فرع زيونة');

commit;
SQL

psql -X -At "$DB" <<'SQL'
select 'stores: ' || count(*) from public.stores;
select 'products: ' || count(*) from public.products;
select 'sales: ' || count(*) || ' (refunded ' || count(*) filter (where status = 'refunded') || ')' from public.sales;
select 'revenue: ' || sum(total) filter (where status = 'completed') from public.sales;
SQL
echo "Demo loaded. Password for all accounts: demo1234"
