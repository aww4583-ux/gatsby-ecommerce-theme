import { ALL_STORES, baghdadToday, requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Expense } from "@/lib/types";
import { ExpensesManager } from "./expenses-manager";

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export default async function ExpensesPage({ searchParams }: PageProps<"/expenses">) {
  const session = await requireManager();
  const params = await searchParams;
  const { today, monthStart } = baghdadToday();
  const from = isDate(params.from) ? params.from : monthStart;
  const to = isDate(params.to) ? params.to : today;

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
