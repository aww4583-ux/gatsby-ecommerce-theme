-- Stock movement log, get_receipt and dashboard_stats. Everything rolls back.
\set owner     '00000000-0000-0000-0000-00000000000a'
\set manager   '00000000-0000-0000-0000-00000000000b'
\set cashier_a '00000000-0000-0000-0000-00000000000c'
\set cashier_b '00000000-0000-0000-0000-00000000000d'

begin;

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

select tests.ok((select count(*) from public.stock_movements m
                 where m.product_id = tests.product('متجر أ', 'شاي') and reason = 'initial' and change = 10) = 1,
                'new product logs its opening stock');

-- Sales: 2 tea cash (2000, cost 1200) + 1 sugar card (1500, cost 1000), and
-- one more tea that gets refunded.
select tests.login(:'cashier_a');
select public.open_shift(tests.store('متجر أ'), 0);
insert into r select 's1', public.complete_sale(tests.store('متجر أ'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 2)), 'cash');
insert into r select 's2', public.complete_sale(tests.store('متجر أ'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'سكر'), 'qty', 1)), 'card');
insert into r select 's3', public.complete_sale(tests.store('متجر أ'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'card');
reset role;

select tests.login(:'cashier_b');
select public.open_shift(tests.store('متجر ب'), 0);
insert into r select 'b1', public.complete_sale(tests.store('متجر ب'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر ب', 'رز'), 'qty', 1)), 'cash');
reset role;

select tests.login(:'manager');
select public.refund_sale((select (v->>'id')::uuid from r where k = 's3'), 'خطأ');
update public.products set stock = stock + 5 where id = tests.product('متجر أ', 'شاي');
insert into public.expenses (store_id, category, amount) values (tests.store('متجر أ'), 'كهرباء', 5000);
reset role;

-- ---------- stock log ----------
select tests.ok((select change = -2 and stock_after = 8 and created_by = :'cashier_a'::uuid
                        and sale_id = (select (v->>'id')::uuid from r where k = 's1')
                 from public.stock_movements where reason = 'sale'
                   and product_id = tests.product('متجر أ', 'شاي') order by id limit 1),
                'sale logged with invoice, cashier and stock after');
select tests.ok((select change = 1 and created_by = :'manager'::uuid
                        and sale_id = (select (v->>'id')::uuid from r where k = 's3')
                 from public.stock_movements where reason = 'refund'),
                'refund logged with the refunded invoice and who did it');
select tests.ok((select change = 5 and stock_after = 13 and created_by = :'manager'::uuid and sale_id is null
                 from public.stock_movements where reason = 'adjustment'),
                'manual stock edit logged as adjustment with who did it');
select tests.throws($$ delete from public.stock_movements $$, 'stock log cannot be deleted', 'sale_immutable');
select tests.throws($$ update public.stock_movements set change = 0 $$, 'stock log cannot be edited', 'sale_immutable');

select tests.login(:'cashier_a');
select tests.ok((select count(*) from public.stock_movements) = 0, 'cashier cannot read the stock log');
reset role;
select tests.login(:'manager');
select tests.ok(not exists (select 1 from public.stock_movements where store_id = tests.store('متجر ب')),
                'manager reads only own store log');
reset role;

-- ---------- get_receipt ----------
select tests.login(:'cashier_a');
select tests.ok((select (public.get_receipt((select (v->>'id')::uuid from r where k = 's1'))->>'invoice_no')::int) = 1,
                'cashier can reprint today''s receipt');
select tests.throws($$ select public.get_receipt((select (v->>'id')::uuid from r where k = 'b1')) $$,
                    'cashier cannot open another store''s receipt', 'not_found');
reset role;

-- ---------- dashboard ----------
select tests.login(:'manager');
insert into r select 'dm', public.dashboard_stats(current_date - 1, current_date + 1);
select tests.ok((select jsonb_array_length(v->'stores') from r where k = 'dm') = 1,
                'manager dashboard covers only managed stores');
select tests.ok((select (s->>'revenue')::bigint = 5500 and (s->>'cogs')::bigint = 3400
                        and (s->>'gross_profit')::bigint = 2100 and (s->>'expenses')::bigint = 5000
                        and (s->>'net_profit')::bigint = -2900 and (s->>'sales_count')::int = 2
                        and (s->>'cash')::bigint = 4000 and (s->>'card')::bigint = 1500
                        and (s->>'refunds_count')::int = 1 and (s->>'refunds_total')::bigint = 2000
                 from r, jsonb_array_elements(v->'stores') s where k = 'dm'),
                'store A: revenue 5500, cogs 3400, expenses 5000, net -2900, refund excluded');
select tests.ok((select (t->>'qty')::int = 2 and (t->>'profit')::bigint = 1600
                 from r, jsonb_array_elements(v->'top_products') t where k = 'dm' and t->>'name' = 'شاي'),
                'top products: tea qty 2, profit 1600');
select tests.ok((select sum((d->>'revenue')::bigint) from r, jsonb_array_elements(v->'days') d where k = 'dm') = 5500
                and (select jsonb_array_length(v->'days') from r where k = 'dm') = 3,
                'daily series covers every day in range and sums to revenue');
select tests.throws($$ select public.dashboard_stats(current_date, current_date, tests.store('متجر ب')) $$,
                    'manager cannot query another store', 'not_authorized');
select tests.throws($$ select public.dashboard_stats(current_date, current_date - 1) $$,
                    'reversed range rejected', 'invalid_range');
reset role;

select tests.login(:'owner');
insert into r select 'do', public.dashboard_stats(current_date, current_date);
select tests.ok((select jsonb_array_length(v->'stores') from r where k = 'do') = 2
                and (select sum((s->>'revenue')::bigint) from r, jsonb_array_elements(v->'stores') s where k = 'do') = 8500,
                'owner dashboard covers both stores (5500 + 3000)');
reset role;

-- Same item sold in two stores is one row in the all-stores top list.
select tests.login(:'owner');
select public.save_product(tests.store('متجر ب'), 'شاي', 2000, 1200, 5, '9999');
reset role;
select tests.login(:'cashier_b');
select public.complete_sale(tests.store('متجر ب'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر ب', 'شاي'), 'qty', 1)), 'card');
reset role;
select tests.login(:'owner');
select tests.ok((select count(*) from jsonb_array_elements(public.dashboard_stats(current_date, current_date)->'top_products') t
                 where t->>'name' = 'شاي') = 1
                and (select (t->>'qty')::int from jsonb_array_elements(public.dashboard_stats(current_date, current_date)->'top_products') t
                     where t->>'name' = 'شاي') = 3,
                'top products merge the same item across stores (tea: 2 + 1)');
reset role;

select tests.login(:'cashier_a');
select tests.throws($$ select public.dashboard_stats(current_date, current_date) $$,
                    'cashier cannot see the dashboard', 'not_authorized');
reset role;

rollback;
