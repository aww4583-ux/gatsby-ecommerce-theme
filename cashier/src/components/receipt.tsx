import { formatDateTime, formatMoney, formatNumber } from "@/lib/format";
import type { Receipt } from "@/lib/types";

// Shared by the on-screen dialog and the printed copy.
export function ReceiptView({ receipt }: { receipt: Receipt }) {
  return (
    <div className="tabular text-sm" dir="rtl">
      <div className="text-center">
        <div className="text-base font-bold">{receipt.store_name}</div>
        {receipt.store_address && <div>{receipt.store_address}</div>}
        {receipt.store_phone && <div dir="ltr">{receipt.store_phone}</div>}
      </div>

      <div className="my-2 border-t border-dashed border-gray-400" />
      <div className="flex justify-between">
        <span>فاتورة رقم</span>
        <span className="font-bold">{receipt.invoice_no}</span>
      </div>
      <div className="flex justify-between">
        <span>التاريخ</span>
        <span dir="ltr">{formatDateTime(receipt.created_at)}</span>
      </div>
      <div className="flex justify-between">
        <span>الكاشير</span>
        <span>{receipt.cashier_name}</span>
      </div>
      {receipt.status === "refunded" && (
        <div className="mt-1 text-center font-bold">*** مُرتجعة ***</div>
      )}

      <div className="my-2 border-t border-dashed border-gray-400" />
      <table className="w-full">
        <thead>
          <tr className="text-xs">
            <th className="text-start font-semibold">الصنف</th>
            <th className="font-semibold">الكمية</th>
            <th className="text-end font-semibold">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item) => (
            <tr key={item.product_id} className="align-top">
              <td className="py-0.5">
                {item.name}
                <div className="text-xs text-gray-500">{formatNumber(item.unit_price)}</div>
              </td>
              <td className="py-0.5 text-center">{item.qty}</td>
              <td className="py-0.5 text-end">{formatNumber(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-2 border-t border-dashed border-gray-400" />
      <Row label="المجموع" value={formatMoney(receipt.subtotal)} />
      {receipt.discount > 0 && <Row label="الخصم" value={`- ${formatMoney(receipt.discount)}`} />}
      <Row label="الإجمالي" value={formatMoney(receipt.total)} bold />
      <Row label={receipt.payment_method === "cash" ? "المدفوع نقداً" : "المدفوع بالبطاقة"} value={formatMoney(receipt.paid)} />
      {receipt.change_amount > 0 && <Row label="الباقي" value={formatMoney(receipt.change_amount)} />}

      <div className="mt-3 text-center text-xs">شكراً لزيارتكم</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
