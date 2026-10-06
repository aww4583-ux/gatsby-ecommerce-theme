import { ALL_STORES, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { Shift } from "@/lib/types";
import { OpenShiftForm } from "./open-shift-form";
import { PosScreen } from "./pos-screen";

export default async function PosPage() {
  const session = await requireSession();

  if (session.selectedStore === ALL_STORES) {
    return (
      <main className="flex flex-1 items-center justify-center p-4 text-center text-gray-600">
        اختر متجراً محدداً من الأعلى لفتح شاشة الكاشير.
      </main>
    );
  }

  const store = session.stores.find((s) => s.id === session.selectedStore)!;
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("cash_shifts")
    .select("*")
    .eq("store_id", store.id)
    .eq("cashier_id", session.userId)
    .is("closed_at", null)
    .maybeSingle<Shift>();

  if (!shift) {
    return <OpenShiftForm storeId={store.id} storeName={store.name} />;
  }

  // key: remount with a fresh cart when the store changes.
  return <PosScreen key={store.id} store={store} />;
}
