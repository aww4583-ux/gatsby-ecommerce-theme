"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dialog } from "@/components/dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatMoney, formatNumber, parseAmount } from "@/lib/format";
import type { ProductWithCost, Store } from "@/lib/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, tableClass } from "@/lib/ui";

type Draft = {
  id: string | null;
  name: string;
  barcode: string;
  category: string;
  sale_price: string;
  cost_price: string;
  stock: string;
  low_stock_threshold: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  id: null,
  name: "",
  barcode: "",
  category: "",
  sale_price: "",
  cost_price: "",
  stock: "0",
  low_stock_threshold: "0",
  is_active: true,
};

function toDraft(p: ProductWithCost): Draft {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode ?? "",
    category: p.category ?? "",
    sale_price: String(p.sale_price),
    cost_price: String(p.product_costs?.cost_price ?? 0),
    stock: String(p.stock),
    low_stock_threshold: String(p.low_stock_threshold),
    is_active: p.is_active,
  };
}

export function ProductsManager({ store, products }: { store: Store; products: ProductWithCost[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lowCount = products.filter((p) => p.is_active && p.stock <= p.low_stock_threshold).length;
  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))] as string[],
    [products],
  );

  const shown = products.filter((p) => {
    const q = query.trim().toLowerCase();
    if (onlyLow && !(p.is_active && p.stock <= p.low_stock_threshold)) return false;
    return !q || p.name.toLowerCase().includes(q) || p.barcode?.includes(q) || p.category?.includes(q);
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("save_product", {
      p_id: draft.id,
      p_store_id: store.id,
      p_name: draft.name,
      p_barcode: draft.barcode,
      p_category: draft.category,
      p_sale_price: parseAmount(draft.sale_price),
      p_cost_price: parseAmount(draft.cost_price),
      p_stock: parseAmount(draft.stock),
      p_low_stock_threshold: parseAmount(draft.low_stock_threshold),
      p_is_active: draft.is_active,
    });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setDraft(null);
    router.refresh();
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const price = draft ? parseAmount(draft.sale_price) : 0;
  const cost = draft ? parseAmount(draft.cost_price) : 0;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">منتجات {store.name}</h1>
        <span className="text-sm text-gray-500">{formatNumber(products.length)} منتج</span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft(emptyDraft);
          }}
          className={`${buttonPrimary} ms-auto`}
        >
          + منتج جديد
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو الباركود أو الصنف"
          aria-label="بحث"
          className={`${inputClass} max-w-sm`}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          المخزون المنخفض فقط
          {lowCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 text-xs font-semibold text-amber-800">
              {lowCount}
            </span>
          )}
        </label>
      </div>

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className={tableClass}>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-start">المنتج</th>
              <th className="text-start">الباركود</th>
              <th className="text-end">سعر البيع</th>
              <th className="text-end">التكلفة</th>
              <th className="text-end">الربح</th>
              <th className="text-end">المخزون</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  لا توجد منتجات
                </td>
              </tr>
            )}
            {shown.map((p) => {
              const c = p.product_costs?.cost_price ?? 0;
              const low = p.stock <= p.low_stock_threshold;
              return (
                <tr key={p.id} className={p.is_active ? "" : "text-gray-400"}>
                  <td>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.category}
                      {!p.is_active && " · موقوف"}
                    </div>
                  </td>
                  <td dir="ltr" className="text-end">{p.barcode}</td>
                  <td className="text-end">{formatMoney(p.sale_price)}</td>
                  <td className="text-end">{formatMoney(c)}</td>
                  <td className={`text-end ${p.sale_price < c ? "text-red-600" : ""}`}>
                    {formatMoney(p.sale_price - c)}
                  </td>
                  <td className={`text-end ${low && p.is_active ? "font-semibold text-amber-700" : ""}`}>
                    {formatNumber(p.stock)}
                    {low && p.is_active && " ⚠"}
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setDraft(toDraft(p));
                      }}
                      className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                    >
                      تعديل
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {draft && (
        <Dialog title={draft.id ? "تعديل منتج" : "منتج جديد"} onClose={() => setDraft(null)}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            <label className="col-span-2">
              <span className="mb-1 block text-sm font-medium">الاسم</span>
              <input required autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">الباركود</span>
              <input dir="ltr" value={draft.barcode} onChange={(e) => set({ barcode: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">الصنف</span>
              <input list="categories" value={draft.category} onChange={(e) => set({ category: e.target.value })} className={inputClass} />
              <datalist id="categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">سعر البيع (د.ع)</span>
              <input required inputMode="numeric" dir="ltr" value={draft.sale_price} onChange={(e) => set({ sale_price: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">سعر التكلفة (د.ع)</span>
              <input required inputMode="numeric" dir="ltr" value={draft.cost_price} onChange={(e) => set({ cost_price: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">المخزون</span>
              <input required inputMode="numeric" dir="ltr" value={draft.stock} onChange={(e) => set({ stock: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">تنبيه عند انخفاض المخزون إلى</span>
              <input inputMode="numeric" dir="ltr" value={draft.low_stock_threshold} onChange={(e) => set({ low_stock_threshold: e.target.value })} className={inputClass} />
            </label>
            <p className={`col-span-2 text-sm ${price < cost ? "text-red-600" : "text-gray-600"}`}>
              الربح في القطعة: {formatMoney(price - cost)}
              {price < cost && " (البيع أقل من التكلفة)"}
            </p>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
              متاح للبيع (أزل العلامة لإيقاف المنتج دون حذفه)
            </label>
            {draft.id && (
              <p className="col-span-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                تعديل المخزون هنا يغيّر الرصيد مباشرة. المبيعات والمرتجعات تعدّله تلقائياً.
              </p>
            )}
            {error && <p role="alert" className="col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="col-span-2 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className={buttonSecondary}>
                إلغاء
              </button>
              <button type="submit" disabled={busy} className={buttonPrimary}>
                {busy ? "جارٍ الحفظ..." : "حفظ"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
