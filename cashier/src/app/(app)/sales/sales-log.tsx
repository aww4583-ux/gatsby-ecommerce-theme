"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateRange } from "@/components/date-range";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { Receipt, SaleRow } from "@/lib/types";
import { buttonDanger, cardClass, inputClass, tableClass } from "@/lib/ui";

export function SalesLog({
  sales,
  from,
  to,
  today,
  showStore,
  canManage,
}: {
  sales: SaleRow[];
  from: string;
  to: string;
  today: string;
  showStore: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const completed = sales.filter((s) => s.status === "completed");
  const total = completed.reduce((a, s) => a + s.total, 0);
  const shown = query.trim()
    ? sales.filter((s) => String(s.invoice_no) === query.trim() || s.cashier?.full_name.includes(query.trim()))
    : sales;

  async function open(sale: SaleRow) {
    setError(null);
    setReason("");
    const { data, error } = await createClient().rpc("get_receipt", { p_sale_id: sale.id });
    if (error) {
      alert(errorMessage(error));
      return;
    }
    setReceipt(data as Receipt);
  }

  async function refund() {
    if (!receipt) return;
    if (!confirm(`إرجاع الفاتورة رقم ${receipt.invoice_no} بمبلغ ${formatMoney(receipt.total)}؟ سيُعاد المخزون.`)) return;
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("refund_sale", {
      p_sale_id: receipt.id,
      p_reason: reason,
    });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setReceipt(data as Receipt);
    router.refresh();
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">سجل المبيعات</h1>
        <span className="tabular text-sm text-gray-500">
          {formatNumber(completed.length)} فاتورة · {formatMoney(total)}
        </span>
        {canManage && (
          <a
            href={`/export/sales?from=${from}&to=${to}`}
            className="ms-auto rounded-lg px-3 py-1.5 text-sm text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
          >
            تصدير CSV
          </a>
        )}
      </div>

      {canManage ? (
        <DateRange from={from} to={to} today={today} />
      ) : (
        <p className="text-sm text-gray-500">مبيعات اليوم في متجرك.</p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="رقم الفاتورة أو اسم الكاشير"
        aria-label="بحث في الفواتير"
        className={`${inputClass} max-w-xs`}
      />

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className={tableClass}>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-start">الفاتورة</th>
              {showStore && <th className="text-start">المتجر</th>}
              <th className="text-start">الوقت</th>
              <th className="text-start">الكاشير</th>
              <th className="text-start">الدفع</th>
              <th className="text-end">الإجمالي</th>
              <th className="text-start">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shown.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  لا توجد فواتير
                </td>
              </tr>
            )}
            {shown.map((s) => (
              <tr
                key={s.id}
                onClick={() => open(s)}
                className={`cursor-pointer hover:bg-emerald-50/50 ${s.status === "refunded" ? "text-gray-400" : ""}`}
              >
                <td>
                  <button type="button" className="font-semibold text-emerald-700" onClick={(e) => { e.stopPropagation(); open(s); }}>
                    #{s.invoice_no}
                  </button>
                </td>
                {showStore && <td>{s.store?.name}</td>}
                <td dir="ltr" className="text-end whitespace-nowrap">{formatDateTime(s.created_at)}</td>
                <td>{s.cashier?.full_name}</td>
                <td>{s.payment_method === "cash" ? "نقداً" : "بطاقة"}</td>
                <td className={`text-end font-semibold ${s.status === "refunded" ? "line-through" : ""}`}>
                  {formatMoney(s.total)}
                </td>
                <td>
                  {s.status === "refunded" ? (
                    <span title={s.refund_reason ?? ""} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                      مُرتجعة
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">مكتملة</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receipt && (
        <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)}>
          {canManage && receipt.status === "completed" && (
            <div className="mt-3 space-y-2 rounded-lg bg-red-50/50 p-3">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">سبب الإرجاع</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
              <button type="button" onClick={refund} disabled={busy} className={`${buttonDanger} w-full`}>
                {busy ? "جارٍ الإرجاع..." : "إرجاع الفاتورة كاملة"}
              </button>
            </div>
          )}
        </ReceiptDialog>
      )}
    </main>
  );
}
