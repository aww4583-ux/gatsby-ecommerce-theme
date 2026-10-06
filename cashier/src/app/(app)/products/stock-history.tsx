"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatDateTime, formatNumber } from "@/lib/format";
import type { StockMovement } from "@/lib/types";
import { tableClass } from "@/lib/ui";

const REASONS: Record<StockMovement["reason"], string> = {
  initial: "رصيد افتتاحي",
  sale: "بيع",
  refund: "إرجاع",
  adjustment: "تعديل يدوي",
};

export function StockHistory({
  productId,
  productName,
  onClose,
}: {
  productId: string;
  productName: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<StockMovement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .from("stock_movements")
      .select(
        "id, change, stock_after, reason, created_at, sale:sales(invoice_no), actor:profiles!stock_movements_created_by_fkey(full_name)",
      )
      .eq("product_id", productId)
      .order("id", { ascending: false })
      .limit(200)
      .returns<StockMovement[]>()
      .then(({ data, error }) => {
        if (error) setError(errorMessage(error));
        else setRows(data);
      });
  }, [productId]);

  return (
    <Dialog title={`حركة مخزون: ${productName}`} onClose={onClose}>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!rows && !error && <p className="py-6 text-center text-gray-500">جارٍ التحميل...</p>}
      {rows && (
        <div className="max-h-[60vh] overflow-y-auto">
          <table className={tableClass}>
            <thead className="text-gray-600">
              <tr>
                <th className="text-start">الوقت</th>
                <th className="text-start">الحركة</th>
                <th className="text-end">التغيير</th>
                <th className="text-end">الرصيد</th>
                <th className="text-start">بواسطة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400">
                    لا توجد حركات
                  </td>
                </tr>
              )}
              {rows.map((m) => (
                <tr key={m.id}>
                  <td dir="ltr" className="text-end whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                  <td>
                    {REASONS[m.reason]}
                    {m.sale && <span className="text-gray-500"> #{m.sale.invoice_no}</span>}
                  </td>
                  <td dir="ltr" className={`text-end font-semibold ${m.change < 0 ? "text-red-600" : "text-emerald-700"}`}>
                    {m.change > 0 ? "+" : ""}
                    {formatNumber(m.change)}
                  </td>
                  <td className="text-end">{formatNumber(m.stock_after)}</td>
                  <td className="text-gray-600">{m.actor?.full_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
