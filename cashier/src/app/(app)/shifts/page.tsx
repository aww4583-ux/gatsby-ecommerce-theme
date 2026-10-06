import { ALL_STORES, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ShiftRow } from "@/lib/types";
import { ShiftsView } from "./shifts-view";

export default async function ShiftsPage() {
  const session = await requireSession();
  const supabase = await createClient();
  const allStores = session.selectedStore === ALL_STORES;

  // RLS: managers see every shift in their stores, cashiers only their own.
  let q = supabase
    .from("cash_shifts")
    .select(
      "*, cashier:profiles!cash_shifts_cashier_id_fkey(full_name), store:stores(name)",
    )
    .order("opened_at", { ascending: false })
    .limit(100);
  if (!allStores) q = q.eq("store_id", session.selectedStore);
  const { data: shifts, error } = await q.returns<ShiftRow[]>();
  if (error) throw new Error(error.message);

  const myOpenShift =
    shifts?.find((s) => s.cashier_id === session.userId && s.closed_at === null && !allStores) ?? null;

  return (
    <ShiftsView
      key={session.selectedStore}
      shifts={shifts ?? []}
      myOpenShift={myOpenShift}
      canManage={session.profile.role !== "cashier"}
      showStore={allStores}
    />
  );
}
