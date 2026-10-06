import { ALL_STORES, parseRange, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { SaleRow } from "@/lib/types";
import { SalesLog } from "./sales-log";

// Baghdad is UTC+3 all year (no DST), so a calendar day maps to fixed UTC bounds.
const dayStart = (d: string) => `${d}T00:00:00+03:00`;
const nextDay = (d: string) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

export default async function SalesPage({ searchParams }: PageProps<"/sales">) {
  const session = await requireSession();
  const isCashier = session.profile.role === "cashier";
  // Cashiers only ever see today (RLS enforces it; the UI just matches).
  const range = parseRange(isCashier ? {} : await searchParams);
  const from = isCashier ? range.today : range.from;
  const to = isCashier ? range.today : range.to;
  const allStores = session.selectedStore === ALL_STORES;

  const supabase = await createClient();
  let q = supabase
    .from("sales")
    .select(
      "id, store_id, invoice_no, created_at, total, discount, payment_method, status, refund_reason, cashier:profiles!sales_cashier_id_fkey(full_name), store:stores(name)",
    )
    .gte("created_at", dayStart(from))
    .lt("created_at", dayStart(nextDay(to)))
    .order("created_at", { ascending: false })
    .limit(1000);
  if (!allStores) q = q.eq("store_id", session.selectedStore);
  const { data, error } = await q.returns<SaleRow[]>();
  if (error) throw new Error(error.message);

  return (
    <SalesLog
      sales={data ?? []}
      from={from}
      to={to}
      today={range.today}
      showStore={allStores}
      canManage={!isCashier}
    />
  );
}
