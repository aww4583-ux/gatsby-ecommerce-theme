"use client";

import { useState } from "react";
import { DateRange } from "@/components/date-range";
import { formatMoney, formatNumber } from "@/lib/format";
import type { DashboardStats, StoreStats } from "@/lib/types";
import { cardClass, tableClass } from "@/lib/ui";

const sum = (rows: StoreStats[], k: keyof StoreStats) => rows.reduce((s, r) => s + Number(r[k]), 0);

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "neg" }) {
  return (
    <div className={cardClass}>
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`tabular mt-1 text-2xl font-bold ${tone === "neg" ? "text-red-600" : ""}`}>{value}</div>
      {sub && <div className="tabular mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

// Daily revenue: single series, so one hue and no legend; hover for details.
function DailyChart({ days }: { days: DashboardStats["days"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.revenue));
  const h = hover !== null ? days[hover] : null;

  return (
    <section className={cardClass} aria-labelledby="daily-title">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="daily-title" className="font-bold">
          الإيرادات اليومية
        </h2>
        <span className="tabular text-xs text-gray-500">الأعلى: {formatMoney(max)}</span>
      </div>
      <div className="relative h-48" dir="ltr" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-100" />
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-gray-300">
          {days.map((d, i) => (
            <div
              key={d.day}
              className="flex h-full min-w-0 flex-1 items-end"
              onMouseEnter={() => setHover(i)}
              aria-label={`${d.day}: ${formatMoney(d.revenue)}`}
            >
              <div
                className={`w-full rounded-t ${hover === i ? "bg-emerald-800" : "bg-emerald-600"}`}
                style={{ height: `${(d.revenue / max) * 100}%`, minHeight: d.revenue > 0 ? 2 : 0 }}
              />
            </div>
          ))}
        </div>
        {h && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow"
            // Clamped so the tooltip stays inside the chart at either edge.
            style={{ left: `${Math.min(88, Math.max(12, ((hover! + 0.5) / days.length) * 100))}%` }}
            dir="rtl"
          >
            <div className="font-semibold" dir="ltr">{h.day}</div>
            <div className="tabular">الإيرادات: {formatMoney(h.revenue)}</div>
            <div className="tabular">صافي الربح: {formatMoney(h.net_profit)}</div>
          </div>
        )}
      </div>
      <div className="tabular mt-1 flex justify-between text-xs text-gray-500" dir="ltr">
        <span>{days[0]?.day}</span>
        <span>{days[days.length - 1]?.day}</span>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-gray-600">عرض كجدول</summary>
        <table className={`${tableClass} mt-2`}>
          <thead className="text-gray-600">
            <tr>
              <th className="text-start">اليوم</th>
              <th className="text-end">الإيرادات</th>
              <th className="text-end">صافي الربح</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day}>
                <td dir="ltr" className="text-end">{d.day}</td>
                <td className="text-end">{formatMoney(d.revenue)}</td>
                <td className={`text-end ${d.net_profit < 0 ? "text-red-600" : ""}`}>{formatMoney(d.net_profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function Dashboard({
  stats,
  from,
  to,
  today,
  title,
}: {
  stats: DashboardStats;
  from: string;
  to: string;
  today: string;
  title: string;
}) {
  const s = stats.stores;
  const revenue = sum(s, "revenue");
  const cogs = sum(s, "cogs");
  const expenses = sum(s, "expenses");
  const net = revenue - cogs - expenses;
  const margin = revenue > 0 ? Math.round(((revenue - cogs) / revenue) * 100) : 0;
  const qs = `from=${from}&to=${to}`;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">لوحة التحكم — {title}</h1>
        <div className="ms-auto flex flex-wrap gap-2 text-sm">
          <span className="self-center text-gray-500">تصدير CSV:</span>
          <a href={`/export/summary?${qs}`} className="rounded-lg px-2 py-1 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
            ملخص المتاجر
          </a>
          <a href={`/export/sales?${qs}`} className="rounded-lg px-2 py-1 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
            المبيعات
          </a>
          <a href={`/export/expenses?${qs}`} className="rounded-lg px-2 py-1 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
            المصروفات
          </a>
        </div>
      </div>

      <DateRange from={from} to={to} today={today} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="الإيرادات" value={formatMoney(revenue)} sub={`${formatNumber(sum(s, "sales_count"))} فاتورة`} />
        <Tile label="الربح الإجمالي" value={formatMoney(revenue - cogs)} sub={`تكلفة البضاعة ${formatMoney(cogs)} · هامش ${margin}%`} />
        <Tile label="المصروفات" value={formatMoney(expenses)} />
        <Tile label="صافي الربح" value={formatMoney(net)} tone={net < 0 ? "neg" : undefined} sub="الإيرادات − التكلفة − المصروفات" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="نقداً" value={formatMoney(sum(s, "cash"))} />
        <Tile label="بطاقة" value={formatMoney(sum(s, "card"))} />
        <Tile label="الخصومات" value={formatMoney(sum(s, "discounts"))} />
        <Tile label="المرتجعات" value={formatMoney(sum(s, "refunds_total"))} sub={`${formatNumber(sum(s, "refunds_count"))} فاتورة (غير محسوبة في الإيرادات)`} />
      </div>

      <DailyChart days={stats.days} />

      <div className="grid gap-4 lg:grid-cols-2">
        {s.length > 1 && (
          <section className={`${cardClass} overflow-x-auto`}>
            <h2 className="mb-2 font-bold">مقارنة المتاجر</h2>
            <table className={tableClass}>
              <thead className="text-gray-600">
                <tr>
                  <th className="text-start">المتجر</th>
                  <th className="text-end">الإيرادات</th>
                  <th className="text-end">الربح الإجمالي</th>
                  <th className="text-end">المصروفات</th>
                  <th className="text-end">صافي الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {s.map((r) => (
                  <tr key={r.store_id}>
                    <td className="font-medium">{r.name}</td>
                    <td className="text-end">{formatMoney(r.revenue)}</td>
                    <td className="text-end">{formatMoney(r.gross_profit)}</td>
                    <td className="text-end">{formatMoney(r.expenses)}</td>
                    <td className={`text-end font-semibold ${r.net_profit < 0 ? "text-red-600" : ""}`}>
                      {formatMoney(r.net_profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className={`${cardClass} overflow-x-auto`}>
          <h2 className="mb-2 font-bold">الأكثر مبيعاً</h2>
          {stats.top_products.length === 0 ? (
            <p className="py-4 text-center text-gray-400">لا توجد مبيعات في هذه الفترة</p>
          ) : (
            <table className={tableClass}>
              <thead className="text-gray-600">
                <tr>
                  <th className="text-start">المنتج</th>
                  <th className="text-end">الكمية</th>
                  <th className="text-end">الإيرادات</th>
                  <th className="text-end">الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.top_products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="font-medium">{p.name}</td>
                    <td className="text-end">{formatNumber(p.qty)}</td>
                    <td className="text-end">{formatMoney(p.revenue)}</td>
                    <td className="text-end">{formatMoney(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
