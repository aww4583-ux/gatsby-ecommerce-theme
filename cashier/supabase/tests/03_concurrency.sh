#!/usr/bin/env bash
# Concurrent sales from separate connections (commits for real, so it
# runs last on a throwaway database).
#   1. 20 buyers race for the last 5 units: exactly 5 win, stock ends at 0.
#   2. 40 parallel sales, 10 of them doomed (insufficient stock): the 30
#      that succeed get consecutive invoice numbers with no gaps.
set -euo pipefail

PSQL=(psql -X -q -v ON_ERROR_STOP=1 "$@")
CASHIER=00000000-0000-0000-0000-00000000000c

q() { "${PSQL[@]}" -Atc "$1"; }

sale_sql() { # $1 = product name, $2 = qty
  cat <<SQL
begin;
select tests.login('$CASHIER');
select public.complete_sale(tests.store('متجر أ'),
  jsonb_build_array(jsonb_build_object('product_id', tests.product('متجر أ', '$1'), 'qty', $2)), 'cash');
commit;
SQL
}

fail() { echo "FAIL: $1"; exit 1; }

"${PSQL[@]}" -c "begin; select tests.login('$CASHIER'); select public.open_shift(tests.store('متجر أ'), 0); commit;" >/dev/null

start_no=$(q "select next_invoice_no from public.stores where id = tests.store('متجر أ')")

# ---- 1. race for the last 5 units ----
tmp=$(mktemp -d)
for i in $(seq 1 20); do
  (sale_sql 'سلعة السباق' 1 | "${PSQL[@]}" >"$tmp/$i.out" 2>&1 && echo ok >"$tmp/$i.status" \
     || echo fail >"$tmp/$i.status") &
done
wait
wins=$(grep -l '^ok$' "$tmp"/*.status | wc -l)
stock=$(q "select stock from public.products where id = tests.product('متجر أ', 'سلعة السباق')")
bad=0
for f in "$tmp"/*.status; do
  if grep -q '^fail$' "$f" && ! grep -q 'المخزون غير كافٍ' "${f%.status}.out"; then bad=$((bad + 1)); fi
done
[ "$wins" -eq 5 ] || fail "expected 5 winning sales, got $wins"
[ "$stock" -eq 0 ] || fail "expected stock 0, got $stock"
[ "$bad" -eq 0 ] || fail "$bad losers failed for a reason other than insufficient stock"
echo "ok - 20 concurrent buyers, 5 units: exactly 5 sales, stock 0, losers got insufficient_stock"
rm -rf "$tmp"

# ---- 2. no gaps under concurrency with failures mixed in ----
tmp=$(mktemp -d)
for i in $(seq 1 40); do
  if [ $((i % 4)) -eq 0 ]; then sql=$(sale_sql 'سلعة السباق' 1); else sql=$(sale_sql 'سلعة وفيرة' 1); fi
  (echo "$sql" | "${PSQL[@]}" >/dev/null 2>&1 || true) &
done
wait
rm -rf "$tmp"

read -r cnt mn mx distinct_cnt < <(q "select count(*), min(invoice_no), max(invoice_no), count(distinct invoice_no)
  from public.sales where store_id = tests.store('متجر أ') and invoice_no >= $start_no" | tr '|' ' ')
next_no=$(q "select next_invoice_no from public.stores where id = tests.store('متجر أ')")
[ "$cnt" -eq 35 ] || fail "expected 35 sales (5 + 30), got $cnt"
[ "$mn" -eq "$start_no" ] && [ "$mx" -eq $((start_no + cnt - 1)) ] && [ "$distinct_cnt" -eq "$cnt" ] \
  || fail "invoice numbers not contiguous: count=$cnt min=$mn max=$mx distinct=$distinct_cnt"
[ "$next_no" -eq $((mx + 1)) ] || fail "counter $next_no does not follow last invoice $mx"
echo "ok - 40 concurrent sales (10 doomed): 30 succeeded, invoices $mn..$mx with no gaps"

abundant=$(q "select stock from public.products where id = tests.product('متجر أ', 'سلعة وفيرة')")
[ "$abundant" -eq $((100000 - 30)) ] || fail "abundant stock should be 99970, got $abundant"
echo "ok - stock matches number of successful sales"
