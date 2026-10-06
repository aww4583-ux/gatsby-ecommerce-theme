"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateRange } from "@/components/date-range";
import { Dialog } from "@/components/dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatMoney, parseAmount } from "@/lib/format";
import type { Expense, Store } from "@/lib/types";
import { buttonDanger, buttonPrimary, buttonSecondary, cardClass, inputClass, tableClass } from "@/lib/ui";

const ALL_STORES = "all";
const CATEGORIES = ["إيجار", "رواتب", "كهرباء", "مولدة", "ماء", "إنترنت", "نقل", "صيانة", "تنظيف", "ضيافة", "أخرى"];

type Draft = { id: string | null; store_id: string; category: string; amount: string; note: string; date: string };

export function ExpensesManager({
  expenses,
  stores,
  selectedStore,
  from,
  to,
  today,
  canDelete,
}: {
  expenses: Expense[];
  stores: Store[];
  selectedStore: string;
  from: string;
  to: string;
  today: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const allStores = selectedStore === ALL_STORES;
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  function newDraft(): Draft {
    return {
      id: null,
      store_id: allStores ? stores[0].id : selectedStore,
      category: "",
      amount: "",
      note: "",
      date: today,
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const amount = parseAmount(draft.amount);
    if (amount <= 0) {
      setError("أدخل مبلغاً أكبر من صفر");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const values = {
      category: draft.category.trim(),
      amount,
      note: draft.note.trim() || null,
      date: draft.date,
    };
    const { error } = draft.id
      ? await supabase.from("expenses").update(values).eq("id", draft.id)
      : await supabase.from("expenses").insert({ ...values, store_id: draft.store_id });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function remove(expense: Expense) {
    if (!confirm(`حذف مصروف "${expense.category}" بمبلغ ${formatMoney(expense.amount)}؟`)) return;
    const { error, count } = await createClient()
      .from("expenses")
      .delete({ count: "exact" })
      .eq("id", expense.id);
    if (error || count === 0) {
      alert(error ? errorMessage(error) : "لا تملك صلاحية الحذف");
      return;
    }
    router.refresh();
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">
          المصروفات {allStores ? "— كل المتاجر" : `— ${stores.find((s) => s.id === selectedStore)?.name}`}
        </h1>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft(newDraft());
          }}
          className={`${buttonPrimary} ms-auto`}
        >
          + مصروف جديد
        </button>
      </div>

      <DateRange from={from} to={to} today={today} />

      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <div className={`${cardClass} overflow-x-auto p-0`}>
          <table className={tableClass}>
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-start">التاريخ</th>
                {allStores && <th className="text-start">المتجر</th>}
                <th className="text-start">البند</th>
                <th className="text-start">ملاحظة</th>
                <th className="text-end">المبلغ</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    لا توجد مصروفات في هذه الفترة
                  </td>
                </tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td dir="ltr" className="text-end whitespace-nowrap">{e.date}</td>
                  {allStores && <td>{e.store?.name}</td>}
                  <td className="font-medium">{e.category}</td>
                  <td className="text-gray-600">
                    {e.note}
                    <div className="text-xs text-gray-400">{e.creator?.full_name}</div>
                  </td>
                  <td className="text-end font-semibold">{formatMoney(e.amount)}</td>
                  <td className="whitespace-nowrap text-end">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setDraft({
                          id: e.id,
                          store_id: e.store_id,
                          category: e.category,
                          amount: String(e.amount),
                          note: e.note ?? "",
                          date: e.date,
                        });
                      }}
                      className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                    >
                      تعديل
                    </button>
                    {canDelete && (
                      <button type="button" onClick={() => remove(e)} className={`${buttonDanger} ms-1`}>
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className={`${cardClass} h-fit space-y-2`}>
          <div className="text-sm text-gray-500">الإجمالي للفترة</div>
          <div className="tabular text-2xl font-bold">{formatMoney(total)}</div>
          <ul className="tabular space-y-1 border-t border-gray-100 pt-2 text-sm">
            {byCategory.map(([cat, amount]) => (
              <li key={cat} className="flex justify-between">
                <span>{cat}</span>
                <span>{formatMoney(amount)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {draft && (
        <Dialog title={draft.id ? "تعديل مصروف" : "مصروف جديد"} onClose={() => setDraft(null)}>
          <form onSubmit={save} className="grid grid-cols-2 gap-3">
            {!draft.id && allStores && (
              <label className="col-span-2">
                <span className="mb-1 block text-sm font-medium">المتجر</span>
                <select value={draft.store_id} onChange={(e) => set({ store_id: e.target.value })} className={inputClass}>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span className="mb-1 block text-sm font-medium">البند</span>
              <input required autoFocus list="expense-categories" value={draft.category} onChange={(e) => set({ category: e.target.value })} className={inputClass} />
              <datalist id="expense-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">المبلغ (د.ع)</span>
              <input required inputMode="numeric" dir="ltr" value={draft.amount} onChange={(e) => set({ amount: e.target.value })} className={inputClass} />
            </label>
            <label>
              <span className="mb-1 block text-sm font-medium">التاريخ</span>
              <input required type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} />
            </label>
            <label className="col-span-2">
              <span className="mb-1 block text-sm font-medium">ملاحظة</span>
              <input value={draft.note} onChange={(e) => set({ note: e.target.value })} className={inputClass} />
            </label>
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
