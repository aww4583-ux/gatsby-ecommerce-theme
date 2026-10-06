-- Store isolation and role permissions. Everything rolls back.
\set owner     '00000000-0000-0000-0000-00000000000a'
\set manager   '00000000-0000-0000-0000-00000000000b'
\set cashier_a '00000000-0000-0000-0000-00000000000c'
\set cashier_b '00000000-0000-0000-0000-00000000000d'
\set outsider  '00000000-0000-0000-0000-00000000000e'

begin;

-- Data the cashiers should or should not see: one sale in each store.
select tests.login(:'cashier_a');
select public.open_shift(tests.store('متجر أ'), 0);
select public.complete_sale(tests.store('متجر أ'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash');
reset role;
select tests.login(:'cashier_b');
select public.open_shift(tests.store('متجر ب'), 0);
select public.complete_sale(tests.store('متجر ب'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر ب', 'رز'), 'qty', 1)), 'card');
reset role;
select tests.login(:'manager');
insert into public.expenses (store_id, category, amount) values (tests.store('متجر أ'), 'كهرباء', 50000);
reset role;
select tests.login(:'owner');
insert into public.expenses (store_id, category, amount) values (tests.store('متجر ب'), 'إيجار', 300000);
reset role;

-- ---------------- cashier A ----------------
select tests.login(:'cashier_a');
select tests.ok((select count(*) from public.stores) = 1
                and (select name from public.stores) = 'متجر أ',
                'cashier A sees only store A');
select tests.ok((select count(*) from public.products) = 4
                and not exists (select 1 from public.products where store_id = tests.store('متجر ب')),
                'cashier A sees only store A products');
select tests.ok((select count(*) from public.sales) = 1
                and (select store_id from public.sales) = tests.store('متجر أ'),
                'cashier A sees only store A sales');
select tests.ok((select count(*) from public.sale_items) = 1, 'cashier A sees items of own store sale only');
select tests.ok((select count(*) from public.product_costs) = 0, 'cashier A cannot see product costs');
select tests.ok((select count(*) from public.sale_item_costs) = 0, 'cashier A cannot see sale costs');
select tests.ok((select count(*) from public.expenses) = 0, 'cashier A cannot see expenses');
select tests.ok((select count(*) from public.cash_shifts) = 1, 'cashier A sees only own shift');
select tests.ok((select count(*) from public.profiles) = 1, 'cashier A sees only own profile');
select tests.throws($$ insert into public.products (store_id, name, sale_price)
                       values (tests.store('متجر أ'), 'x', 1) $$,
                    'cashier A cannot add products', null, '42501');
update public.products set stock = 999;
reset role;
select tests.ok(not exists (select 1 from public.products where stock = 999), 'cashier A cannot edit stock');
select tests.login(:'cashier_a');
select tests.throws($$ insert into public.sales (store_id, invoice_no, cashier_id, shift_id, subtotal,
                       total, payment_method, paid, change_amount) select store_id, 99, cashier_id, id,
                       0, 0, 'cash', 0, 0 from public.cash_shifts $$,
                    'cashier A cannot insert sales directly', null, '42501');
select tests.throws($$ update public.stores set next_invoice_no = 1 $$,
                    'cashier A cannot touch the invoice counter', null, '42501');
select tests.throws($$ select public.complete_sale(tests.store('متجر ب'),
                       jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر ب', 'رز'), 'qty', 1)), 'cash') $$,
                    'cashier A cannot sell in store B', 'not_authorized');
select tests.throws($$ select public.open_shift(tests.store('متجر ب'), 0) $$,
                    'cashier A cannot open a shift in store B', 'not_authorized');
select tests.throws($$ select public.refund_sale(tests.last_sale('متجر أ')) $$,
                    'cashier cannot refund', 'not_authorized');
select tests.throws($$ insert into public.expenses (store_id, category, amount)
                       values (tests.store('متجر أ'), 'x', 1) $$,
                    'cashier cannot add expenses', null, '42501');
reset role;

-- Yesterday's sale disappears for the cashier but not for the manager.
alter table public.sales disable trigger sales_guard;
update public.sales set created_at = now() - interval '1 day' where store_id = tests.store('متجر أ');
alter table public.sales enable trigger sales_guard;
select tests.login(:'cashier_a');
select tests.ok((select count(*) from public.sales) = 0, 'cashier A cannot see past days');
reset role;
select tests.login(:'manager');
select tests.ok((select count(*) from public.sales) = 1, 'manager still sees past days');
reset role;

-- ---------------- cashier B ----------------
select tests.login(:'cashier_b');
select tests.ok((select count(*) from public.stores) = 1
                and (select name from public.stores) = 'متجر ب', 'cashier B sees only store B');
select tests.ok(not exists (select 1 from public.products where store_id = tests.store('متجر أ')),
                'cashier B cannot see store A products');
select tests.ok(not exists (select 1 from public.sales where store_id = tests.store('متجر أ')),
                'cashier B cannot see store A sales');
reset role;

-- ---------------- manager of store A ----------------
select tests.login(:'manager');
select tests.ok((select count(*) from public.stores) = 1, 'manager sees only assigned store');
select tests.ok((select count(*) from public.product_costs) = 4, 'manager sees costs in own store');
select tests.ok((select count(*) from public.expenses) = 1, 'manager sees only own store expenses');
select tests.ok((select count(*) from public.sale_item_costs) = 1, 'manager sees sale costs in own store');
select tests.throws($$ insert into public.expenses (store_id, category, amount)
                       values (tests.store('متجر ب'), 'x', 1) $$,
                    'manager cannot add expenses to store B', null, '42501');
select tests.throws($$ insert into public.stores (organization_id, name)
                       values (private.current_org(), 'متجر ج') $$,
                    'manager cannot create stores', null, '42501');
select tests.throws($$ select public.upsert_staff('00000000-0000-0000-0000-00000000000c', 'x', 'manager', '{}') $$,
                    'manager cannot change staff', 'not_authorized');
update public.products set sale_price = 2500 where id = tests.product('متجر أ', 'شاي');
select tests.ok((select sale_price from public.products where id = tests.product('متجر أ', 'شاي')) = 2500,
                'manager can edit product price');
delete from public.expenses;
select tests.ok((select count(*) from public.expenses) = 1, 'manager cannot delete expenses (only owner)');
reset role;

-- ---------------- owner ----------------
select tests.login(:'owner');
select tests.ok((select count(*) from public.stores) = 2, 'owner sees both stores');
select tests.ok((select count(*) from public.sales) = 2, 'owner sees sales of all stores');
select tests.ok((select count(*) from public.expenses) = 2, 'owner sees expenses of all stores');
select tests.throws($$ select public.upsert_staff('00000000-0000-0000-0000-00000000000e', 'x', 'cashier', '{}') $$,
                    'owner cannot claim a user from another org', 'not_authorized');
select tests.throws($$ select public.upsert_staff('00000000-0000-0000-0000-00000000000c', 'x', 'cashier',
                       array[tests.store('متجر خارجي')]) $$,
                    'owner cannot assign a store of another org', 'invalid_store');
select tests.throws($$ select public.upsert_staff('00000000-0000-0000-0000-00000000000a', 'x', 'cashier', '{}') $$,
                    'owner cannot demote self', 'self_edit');
reset role;

-- ---------------- another organization ----------------
select tests.login(:'outsider');
select tests.ok((select count(*) from public.stores) = 1
                and (select name from public.stores) = 'متجر خارجي', 'outsider sees only own store');
select tests.ok((select count(*) from public.sales) = 0
                and (select count(*) from public.products) = 0
                and (select count(*) from public.expenses) = 0
                and (select count(*) from public.profiles) = 1, 'outsider sees nothing of org 1');
select tests.throws($$ select public.refund_sale(tests.last_sale('متجر أ')) $$,
                    'outsider cannot refund', 'not_authorized');
select tests.throws($$ insert into public.products (store_id, name, sale_price)
                       values (tests.store('متجر أ'), 'x', 1) $$,
                    'outsider cannot add products to org 1', null, '42501');
reset role;

-- ---------------- deactivated staff ----------------
select tests.login(:'owner');
select public.set_staff_active(:'cashier_a', false);
reset role;
select tests.login(:'cashier_a');
select tests.ok((select count(*) from public.stores) = 0
                and (select count(*) from public.products) = 0, 'deactivated cashier sees nothing');
select tests.throws($$ select public.complete_sale(tests.store('متجر أ'),
                       jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', 'شاي'), 'qty', 1)), 'cash') $$,
                    'deactivated cashier cannot sell', 'not_authorized');
reset role;

-- ---------------- anonymous ----------------
set local role anon;
select tests.throws($$ select * from public.stores $$, 'anon cannot read stores', null, '42501');
select tests.throws($$ select public.complete_sale(gen_random_uuid(), '[]', 'cash') $$,
                    'anon cannot call RPCs', null, '42501');
reset role;

rollback;
