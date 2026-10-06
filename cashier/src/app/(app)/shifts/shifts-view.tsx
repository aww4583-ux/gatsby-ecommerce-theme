"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatDateTime, formatMoney, parseAmount } from "@/lib/format";
import type { Shift, ShiftRow } from "@/lib/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, tableClass } from "@/lib/ui";

function Difference({ expected, counted }: { expected: number | null; counted: number | null }) {
  if (expected === null || counted === null) return <span className="text-gray-400">—</span>;
  const diff = counted - expected;
  if (diff === 0) return <span className="font-semibold text-emerald-700">مطابق</span>;
  return (
    <span className={`font-semibold ${diff < 0 ? "text-red-600" : "text-amber-700"}`}>
      {diff < 0 ? "عجز " : "زيادة "}
      {formatMoney(Math.abs(diff))}
    </span>
  );
}

export function ShiftsView({
  shifts,
  myOpenShift,
  canManage,
  showStore,
}: {
  shifts: ShiftRow[];
  myOpenShift: ShiftRow | null;
  canManage: boolean;
  showStore: boolean;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState<ShiftRow | null>(null);
  const [counted, setCounted] = useState("");
  const [result, setResult] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function closeShift(shift: ShiftRow) {
    if (counted.trim() === "") {
      setError("أدخل النقد المعدود في الدرج");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("close_shift", {
      p_shift_id: shift.id,
      p_closing_cash: parseAmount(counted),
    });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setResult(data as Shift);
    setClosing(null);
    setCounted("");
    router.refresh();
  }

  // Blind count: the expected amount is revealed only after closing, so
  // the count is not adjusted to match it.
  const closeForm = (shift: ShiftRow) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        closeShift(shift);
      }}
      className="space-y-3"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium">عُدّ النقد الموجود في الدرج الآن (د.ع)</span>
        <input
          autoFocus
          inputMode="numeric"
          dir="ltr"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          className={`${inputClass} tabular text-lg`}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
        {busy ? "جارٍ الإغلاق..." : "إغلاق الوردية"}
      </button>
    </form>
  );

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <h1 className="text-xl font-bold">الورديات</h1>

      {result && (
        <section className={`${cardClass} space-y-2 border-s-4 border-emerald-600`} aria-live="polite">
          <h2 className="font-bold">تم إغلاق الوردية</h2>
          <dl className="tabular grid max-w-md grid-cols-2 gap-1 text-sm">
            <dt>النقد الافتتاحي</dt>
            <dd>{formatMoney(result.opening_cash)}</dd>
            <dt>النقد المتوقع</dt>
            <dd>{formatMoney(result.expected_cash ?? 0)}</dd>
            <dt>النقد المعدود</dt>
            <dd>{formatMoney(result.closing_cash ?? 0)}</dd>
            <dt className="font-semibold">الفرق</dt>
            <dd>
              <Difference expected={result.expected_cash} counted={result.closing_cash} />
            </dd>
          </dl>
          <button type="button" onClick={() => router.push("/pos")} className={buttonSecondary}>
            العودة إلى الكاشير
          </button>
        </section>
      )}

      {myOpenShift && !result && (
        <section className={`${cardClass} max-w-md space-y-3`}>
          <h2 className="font-bold">ورديتي الحالية</h2>
          <p className="tabular text-sm text-gray-600">
            فُتحت {formatDateTime(myOpenShift.opened_at)} · النقد الافتتاحي{" "}
            {formatMoney(myOpenShift.opening_cash)}
          </p>
          {closeForm(myOpenShift)}
        </section>
      )}

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className={tableClass}>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {showStore && <th className="text-start">المتجر</th>}
              <th className="text-start">الكاشير</th>
              <th className="text-start">الفتح</th>
              <th className="text-start">الإغلاق</th>
              <th className="text-end">افتتاحي</th>
              <th className="text-end">متوقع</th>
              <th className="text-end">معدود</th>
              <th className="text-end">الفرق</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shifts.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-400">
                  لا توجد ورديات
                </td>
              </tr>
            )}
            {shifts.map((s) => (
              <tr key={s.id}>
                {showStore && <td>{s.store?.name}</td>}
                <td className="font-medium">{s.cashier?.full_name}</td>
                <td dir="ltr" className="text-end whitespace-nowrap">{formatDateTime(s.opened_at)}</td>
                <td className="whitespace-nowrap">
                  {s.closed_at ? (
                    <span dir="ltr">{formatDateTime(s.closed_at)}</span>
                  ) : canManage && s.id !== myOpenShift?.id ? (
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setCounted("");
                        setClosing(s);
                      }}
                      className="rounded-lg bg-amber-50 px-2 py-1 text-amber-800 hover:bg-amber-100"
                    >
                      مفتوحة · إغلاق
                    </button>
                  ) : (
                    <span className="text-amber-700">مفتوحة</span>
                  )}
                </td>
                <td className="text-end">{formatMoney(s.opening_cash)}</td>
                <td className="text-end">{s.expected_cash === null ? "—" : formatMoney(s.expected_cash)}</td>
                <td className="text-end">{s.closing_cash === null ? "—" : formatMoney(s.closing_cash)}</td>
                <td className="text-end">
                  <Difference expected={s.expected_cash} counted={s.closing_cash} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {closing && (
        <Dialog title={`إغلاق وردية ${closing.cashier?.full_name ?? ""}`} onClose={() => setClosing(null)}>
          {closeForm(closing)}
        </Dialog>
      )}
    </main>
  );
}
