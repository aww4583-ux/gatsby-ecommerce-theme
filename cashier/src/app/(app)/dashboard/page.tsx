import { ALL_STORES, parseRange, requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { DashboardStats } from "@/lib/types";
import { Dashboard } from "./dashboard";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const session = await requireManager();
  const { from, to, today } = parseRange(await searchParams);
  const allStores = session.selectedStore === ALL_STORES;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", {
    p_from: from,
    p_to: to,
    p_store_id: allStores ? null : session.selectedStore,
  });
  if (error) throw new Error(error.message);

  const title = allStores
    ? "كل المتاجر"
    : (session.stores.find((s) => s.id === session.selectedStore)?.name ?? "");

  return <Dashboard stats={data as DashboardStats} from={from} to={to} today={today} title={title} />;
}
