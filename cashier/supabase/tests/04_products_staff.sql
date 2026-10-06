-- save_product and org_staff. Everything rolls back.
\set owner     '00000000-0000-0000-0000-00000000000a'
\set manager   '00000000-0000-0000-0000-00000000000b'
\set cashier_a '00000000-0000-0000-0000-00000000000c'
\set outsider  '00000000-0000-0000-0000-00000000000e'

begin;

create temp table r (k text primary key, v uuid);
grant all on r to authenticated;

-- ---------- save_product ----------
select tests.login(:'manager');
insert into r select 'p', public.save_product(tests.store('متجر أ'), ' حليب ', 1250, 900, 12, ' 5001 ', 'ألبان', 3);
select tests.ok((select name = 'حليب' and barcode = '5001' and category = 'ألبان' and sale_price = 1250
                        and stock = 12 and low_stock_threshold = 3
                 from public.products where id = (select v from r where k = 'p')),
                'manager creates a product (values trimmed)');
select tests.ok((select cost_price from public.product_costs where product_id = (select v from r where k = 'p')) = 900,
                'cost saved in the same call');

select public.save_product(tests.store('متجر أ'), 'حليب كامل', 1500, 1000, 20, '5001', null, 0, false,
                           (select v from r where k = 'p'));
select tests.ok((select name = 'حليب كامل' and sale_price = 1500 and stock = 20 and not is_active and category is null
                 from public.products where id = (select v from r where k = 'p'))
                and (select cost_price from public.product_costs where product_id = (select v from r where k = 'p')) = 1000,
                'manager updates product and cost together');

select tests.throws($$ select public.save_product(tests.store('متجر أ'), 'مكرر', 1, 1, 1, '1001') $$,
                    'duplicate barcode in the same store rejected', 'duplicate_barcode');
select tests.throws($$ select public.save_product(tests.store('متجر أ'), 'سالب', -5, 1, 1) $$,
                    'negative price rejected', 'invalid_product');
select tests.throws($$ select public.save_product(tests.store('متجر أ'), 'تكلفة', 5, -1, 1) $$,
                    'negative cost rejected', 'invalid_cost');
select tests.throws($$ select public.save_product(tests.store('متجر ب'), 'x', 1, 1, 1) $$,
                    'manager cannot add products to another store', 'not_authorized');
select tests.throws($$ select public.save_product(tests.store('متجر ب'), 'x', 1, 1, 1, null, null, 0, true,
                         tests.product('متجر أ', 'شاي')) $$,
                    'cannot move a product to another store via save_product', 'product_not_found');
reset role;

select tests.login(:'owner');
select public.save_product(tests.store('متجر ب'), 'زيت', 4000, 3000, 6, '1001');
select tests.ok(exists (select 1 from public.products where name = 'زيت' and barcode = '1001'),
                'same barcode is allowed in a different store');
reset role;

select tests.login(:'cashier_a');
select tests.throws($$ select public.save_product(tests.store('متجر أ'), 'x', 1, 1, 1) $$,
                    'cashier cannot save products', 'not_authorized');
select tests.throws($$ select public.save_product(tests.store('متجر أ'), 'x', 1, 1, 1, null, null, 0, true,
                         tests.product('متجر أ', 'شاي')) $$,
                    'cashier cannot edit products', 'not_authorized');
reset role;

-- ---------- org_staff ----------
select tests.login(:'owner');
select tests.ok((select count(*) from public.org_staff()) = 4, 'owner lists the 4 people of org 1');
select tests.ok((select email from public.org_staff() where full_name = 'كاشير أ') = 'cashier_a@test',
                'staff list includes login email');
select tests.ok((select store_ids = array[tests.store('متجر أ')] from public.org_staff() where full_name = 'كاشير أ'),
                'staff list includes assigned stores');
reset role;

select tests.login(:'manager');
select tests.throws($$ select * from public.org_staff() $$, 'manager cannot list staff', 'not_authorized');
reset role;
select tests.login(:'cashier_a');
select tests.throws($$ select * from public.org_staff() $$, 'cashier cannot list staff', 'not_authorized');
reset role;
select tests.login(:'outsider');
select tests.ok((select count(*) from public.org_staff()) = 1, 'other org owner sees only their own staff');
reset role;

rollback;
