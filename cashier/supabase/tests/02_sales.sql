-- Sale, return and shift rules. Everything rolls back.
\set owner     '00000000-0000-0000-0000-00000000000a'
\set manager   '00000000-0000-0000-0000-00000000000b'
\set cashier_a '00000000-0000-0000-0000-00000000000c'

begin;

create temp table r (k text primary key, v jsonb);
grant all on r to authenticated;

select tests.login(:'cashier_a');

select tests.throws($$ select public.complete_sale(tests.store('متجر أ'),
                       jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash') $$,
                    'cannot sell without an open shift', 'no_open_shift');

insert into r select 'shift', to_jsonb(public.open_shift(tests.store('متجر أ'), 100000));
select tests.throws($$ select public.open_shift(tests.store('متجر أ'), 0) $$,
                    'cannot open a second shift', 'shift_already_open');

-- ---------- rejected sales change nothing ----------
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 2),
                         jsonb_build_object('product_id', tests.product('متجر أ', 'سكر'), 'qty', 4)), 'cash') $$,
                    'sale rejected when stock is insufficient', 'insufficient_stock');
select tests.ok((select stock from public.products where id = tests.product('متجر أ', 'شاي')) = 10
                and (select stock from public.products where id = tests.product('متجر أ', 'سكر')) = 3,
                'rejected sale left all stock untouched');
select tests.ok((select count(*) from public.sales) = 0, 'rejected sale created no invoice');

select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), '[]', 'cash') $$,
                    'empty cart rejected', 'empty_cart');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 0)), 'cash') $$,
                    'zero quantity rejected', 'invalid_items');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1.5)), 'cash') $$,
                    'fractional quantity rejected', 'invalid_items');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر ب', 'رز'), 'qty', 1)), 'cash') $$,
                    'product from another store rejected', 'product_not_found');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash', 5000, 2001) $$,
                    'discount above subtotal rejected', 'invalid_discount');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash', 1000) $$,
                    'cash paid below total rejected', 'insufficient_payment');
select tests.ok((select stock from public.products where id = tests.product('متجر أ', 'شاي')) = 10,
                'stock still untouched after all rejections');

-- ---------- successful cash sale ----------
-- Duplicate lines for the same product are merged.
insert into r select 'sale1', public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
    jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 2),
    jsonb_build_object('product_id', tests.product('متجر أ', 'سكر'), 'qty', 1),
    jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)),
  'cash', 10000, 500);
select tests.ok((select (v->>'invoice_no')::int from r where k = 'sale1') = 1, 'first invoice is number 1');
select tests.ok((select (v->>'subtotal')::bigint = 7500 and (v->>'discount')::bigint = 500
                    and (v->>'total')::bigint = 7000 and (v->>'change_amount')::bigint = 3000
                 from r where k = 'sale1'), 'totals and change computed from DB prices');
select tests.ok((select jsonb_array_length(v->'items') from r where k = 'sale1') = 2, 'duplicate lines merged');
select tests.ok((select v::text not like '%cost%' from r where k = 'sale1'), 'receipt contains no cost data');
select tests.ok((select stock from public.products where id = tests.product('متجر أ', 'شاي')) = 7
                and (select stock from public.products where id = tests.product('متجر أ', 'سكر')) = 2,
                'stock deducted');

-- ---------- card sale + idempotent retry ----------
insert into r select 'sale2', public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
    jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)),
  'card', null, 0, 'b6a6f9f2-0000-4000-8000-000000000001');
insert into r select 'sale2_retry', public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
    jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)),
  'card', null, 0, 'b6a6f9f2-0000-4000-8000-000000000001');
select tests.ok((select v->>'id' from r where k = 'sale2') = (select v->>'id' from r where k = 'sale2_retry'),
                'retry with same request id returns the same invoice');
select tests.ok((select stock from public.products where id = tests.product('متجر أ', 'شاي')) = 6,
                'retry did not deduct stock twice');
select tests.ok((select (v->>'paid')::bigint = 2000 and (v->>'change_amount')::bigint = 0
                 from r where k = 'sale2'), 'card sale paid exactly the total');

-- A failed sale between two good ones leaves no gap in numbering.
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'سكر'), 'qty', 50)), 'cash') $$,
                    'oversell rejected', 'insufficient_stock');
insert into r select 'sale3', public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
    jsonb_build_object('product_id', tests.product('متجر أ', 'سكر'), 'qty', 1)), 'cash');
select tests.ok((select (v->>'invoice_no')::int from r where k = 'sale3') = 3,
                'invoice numbers continue without gaps after a failed sale');
reset role;

-- ---------- price/cost snapshots ----------
select tests.login(:'manager');
update public.products set sale_price = 9999 where id = tests.product('متجر أ', 'شاي');
update public.product_costs set cost_price = 8888 where product_id = tests.product('متجر أ', 'شاي');
select tests.ok((select i.unit_price from public.sale_items i
                 where i.sale_id = (select (v->>'id')::uuid from r where k = 'sale1')
                   and i.product_id = tests.product('متجر أ', 'شاي')) = 2000,
                'sold price unchanged after price change');
select tests.ok((select c.unit_cost from public.sale_item_costs c join public.sale_items i on i.id = c.sale_item_id
                 where i.sale_id = (select (v->>'id')::uuid from r where k = 'sale1')
                   and i.product_id = tests.product('متجر أ', 'شاي')) = 1200,
                'sold cost unchanged after cost change');

-- ---------- returns ----------
select tests.throws($$ select public.refund_sale((select (v->>'id')::uuid from r where k = 'sale1')) $$,
                    'cash refund needs an open shift', 'no_open_shift');
insert into r select 'mshift', to_jsonb(public.open_shift(tests.store('متجر أ'), 0));
insert into r select 'refund1', public.refund_sale((select (v->>'id')::uuid from r where k = 'sale1'), 'تالف');
select tests.ok((select v->>'status' from r where k = 'refund1') = 'refunded', 'sale marked refunded');
select tests.ok((select stock from public.products where id = tests.product('متجر أ', 'شاي')) = 9
                and (select stock from public.products where id = tests.product('متجر أ', 'سكر')) = 2,
                'refund restored stock');
select tests.ok((select refunded_by = :'manager'::uuid and refunded_at is not null and refund_reason = 'تالف'
                 from public.sales where id = (select (v->>'id')::uuid from r where k = 'sale1')),
                'refund records who, when and why');
select tests.throws($$ select public.refund_sale((select (v->>'id')::uuid from r where k = 'sale1')) $$,
                    'cannot refund twice', 'already_refunded');
reset role;

-- ---------- sales are immutable, even for the database owner ----------
select tests.throws($$ delete from public.sales where id = (select (v->>'id')::uuid from r where k = 'sale2') $$,
                    'sales cannot be deleted', 'sale_immutable');
select tests.throws($$ update public.sales set total = 1 where id = (select (v->>'id')::uuid from r where k = 'sale2') $$,
                    'sales cannot be edited', 'sale_immutable');
select tests.throws($$ update public.sales set status = 'completed', refunded_at = null, refunded_by = null
                       where id = (select (v->>'id')::uuid from r where k = 'sale1') $$,
                    'a refund cannot be undone', 'sale_immutable');
select tests.throws($$ delete from public.sale_items $$, 'sale items cannot be deleted', 'sale_immutable');

-- ---------- shift close ----------
-- Cashier shift: opening 100000 + cash sales 7000 (sale1) + 1500 (sale3) = 108500.
-- sale1 was later refunded from the manager's shift, so it stays in the
-- cashier's drawer and is paid out of the manager's drawer.
select tests.login(:'cashier_a');
insert into r select 'closed', to_jsonb(public.close_shift((select (v->>'id')::uuid from r where k = 'shift'), 108000));
select tests.ok((select (v->>'expected_cash')::bigint = 108500 and (v->>'closing_cash')::bigint = 108000
                 from r where k = 'closed'), 'expected cash excludes card sales; shortage of 500 visible');
select tests.throws($$ select public.close_shift((select (v->>'id')::uuid from r where k = 'shift'), 0) $$,
                    'cannot close a shift twice', 'shift_closed');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'), jsonb_build_array(
                         jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash') $$,
                    'cannot sell after closing the shift', 'no_open_shift');
select tests.throws($$ select public.close_shift((select (v->>'id')::uuid from r where k = 'mshift'), 0) $$,
                    'cashier cannot close the manager''s shift', 'not_found');
reset role;
select tests.login(:'manager');
insert into r select 'mclosed', to_jsonb(public.close_shift((select (v->>'id')::uuid from r where k = 'mshift'), 0));
select tests.ok((select (v->>'expected_cash')::bigint from r where k = 'mclosed') = -7000,
                'manager drawer shows the 7000 cash refund paid out');
reset role;

rollback;
