import { ALL_STORES, parseRange, requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";
import { ExpensesManager } from "./expenses-manager";

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const session = await requireManager();
  const { from, to, today } = parseRange(await searchParams);

  const supabase = await createClient();
  let q = supabase
    .from("expenses")
    .select(
      "id, store_id, category, amount, note, date, created_at, store:stores(name), creator:profiles!expenses_created_by_fkey(full_name)",
    )
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (session.selectedStore !== ALL_STORES) q = q.eq("store_id", session.selectedStore);
  const { data, error } = await q.returns<Expense[]>();
  if (error) throw new Error(error.message);

  return (
    <ExpensesManager
      expenses={data ?? []}
      stores={session.stores}
      selectedStore={session.selectedStore}
      from={from}
      to={to}
      today={today}
      canDelete={session.profile.role === "owner"}
    />
  );
}
