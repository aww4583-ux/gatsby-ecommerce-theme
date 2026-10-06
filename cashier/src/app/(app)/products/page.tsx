import { PickStore } from "@/app/(app)/pick-store";
import { ALL_STORES, requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithCost } from "@/lib/types";
import { ProductsManager } from "./products-manager";

export default async function ProductsPage() {
  const session = await requireManager();
  if (session.selectedStore === ALL_STORES) return <PickStore what="المنتجات" />;

  const store = session.stores.find((s) => s.id === session.selectedStore)!;
  const supabase = await createClient();
  const { data: products, error } = await supabase
    .from("products")
    .select("*, product_costs(cost_price)")
    .eq("store_id", store.id)
    .order("name")
    .returns<ProductWithCost[]>();

  if (error) throw new Error(error.message);

  return <ProductsManager key={store.id} store={store} products={products ?? []} />;
}
