-- Two organizations. Org 1 has store A and store B.
--   owner      ...0a  owner of org 1 (all stores)
--   manager    ...0b  manager of store A
--   cashier_a  ...0c  cashier in store A
--   cashier_b  ...0d  cashier in store B
--   outsider   ...0e  owner of org 2 (متجر خارجي)

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test'),
  ('00000000-0000-0000-0000-00000000000b', 'manager@test'),
  ('00000000-0000-0000-0000-00000000000c', 'cashier_a@test'),
  ('00000000-0000-0000-0000-00000000000d', 'cashier_b@test'),
  ('00000000-0000-0000-0000-00000000000e', 'outsider@test');

begin;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.create_organization('شركة الاختبار', 'متجر أ', 'المالك');
insert into public.stores (organization_id, name)
  values (private.current_org(), 'متجر ب');
select public.upsert_staff('00000000-0000-0000-0000-00000000000b', 'المدير', 'manager',
                           array[tests.store('متجر أ')]);
select public.upsert_staff('00000000-0000-0000-0000-00000000000c', 'كاشير أ', 'cashier',
                           array[tests.store('متجر أ')]);
select public.upsert_staff('00000000-0000-0000-0000-00000000000d', 'كاشير ب', 'cashier',
                           array[tests.store('متجر ب')]);

insert into public.products (store_id, name, barcode, sale_price, stock) values
  (tests.store('متجر أ'), 'شاي', '1001', 2000, 10),
  (tests.store('متجر أ'), 'سكر', '1002', 1500, 3),
  (tests.store('متجر أ'), 'سلعة السباق', '1003', 1000, 5),
  (tests.store('متجر أ'), 'سلعة وفيرة', '1004', 500, 100000),
  (tests.store('متجر ب'), 'رز', '2001', 3000, 20);
update public.product_costs set cost_price = 1200 where product_id = tests.product('متجر أ', 'شاي');
update public.product_costs set cost_price = 1000 where product_id = tests.product('متجر أ', 'سكر');
update public.product_costs set cost_price = 2000 where product_id = tests.product('متجر ب', 'رز');
commit;

begin;
select tests.login('00000000-0000-0000-0000-00000000000e');
select public.create_organization('شركة أخرى', 'متجر خارجي', 'مالك آخر');
commit;
