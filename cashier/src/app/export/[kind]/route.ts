import { NextResponse } from "next/server";
import { ALL_STORES, parseRange, requireSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";

type Cell = string | number | null | undefined;

// Quote every text cell; neutralise spreadsheet formulas (=, +, -, @) in text.
function csv(rows: Cell[][]): string {
  const cell = (v: Cell) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  // BOM so Excel opens Arabic text as UTF-8.
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

const dayStart = (d: string) => `${d}T00:00:00+03:00`;
const nextDay = (d: string) => {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
};

type SaleExport = {
  invoice_no: number;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  status: string;
  refund_reason: string | null;
  cashier: { full_name: string } | null;
  store: { name: string } | null;
  sale_items: { name: string; qty: number }[];
};

type ExpenseExport = {
  date: string;
  category: string;
  amount: number;
  note: string | null;
  store: { name: string } | null;
  creator: { full_name: string } | null;
};

export async function GET(request: Request, ctx: RouteContext<"/export/[kind]">) {
  const { kind } = await ctx.params;
  const session = await requireSession();
  const url = new URL(request.url);
  const { from, to } = parseRange(Object.fromEntries(url.searchParams));
  const storeId = session.selectedStore === ALL_STORES ? null : session.selectedStore;
  const supabase = await createClient();

  if (session.profile.role === "cashier" || !session.profile.is_active) {
    return new NextResponse("غير مصرح", { status: 403 });
  }

  let rows: Cell[][];
  if (kind === "sales") {
    let q = supabase
      .from("sales")
      .select(
        "invoice_no, created_at, subtotal, discount, total, payment_method, status, refund_reason, cashier:profiles!sales_cashier_id_fkey(full_name), store:stores(name), sale_items(name, qty)",
      )
      .gte("created_at", dayStart(from))
      .lt("created_at", dayStart(nextDay(to)))
      .order("created_at");
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q.returns<SaleExport[]>();
    if (error) return new NextResponse(error.message, { status: 500 });
    rows = [
      ["رقم الفاتورة", "التاريخ", "المتجر", "الكاشير", "الدفع", "المجموع", "الخصم", "الإجمالي", "الحالة", "سبب الإرجاع", "الأصناف"],
      ...data.map((s) => [
        s.invoice_no,
        formatDateTime(s.created_at),
        s.store?.name,
        s.cashier?.full_name,
        s.payment_method === "cash" ? "نقداً" : "بطاقة",
        s.subtotal,
        s.discount,
        s.total,
        s.status === "refunded" ? "مُرتجعة" : "مكتملة",
        s.refund_reason,
        s.sale_items.map((i) => `${i.name} × ${i.qty}`).join("، "),
      ]),
    ];
  } else if (kind === "expenses") {
    let q = supabase
      .from("expenses")
      .select("date, category, amount, note, store:stores(name), creator:profiles!expenses_created_by_fkey(full_name)")
      .gte("date", from)
      .lte("date", to)
      .order("date");
    if (storeId) q = q.eq("store_id", storeId);
    const { data, error } = await q.returns<ExpenseExport[]>();
    if (error) return new NextResponse(error.message, { status: 500 });
    rows = [
      ["التاريخ", "المتجر", "البند", "المبلغ", "ملاحظة", "أضافه"],
      ...data.map((e) => [e.date, e.store?.name, e.category, e.amount, e.note, e.creator?.full_name]),
    ];
  } else if (kind === "summary") {
    const { data, error } = await supabase.rpc("dashboard_stats", { p_from: from, p_to: to, p_store_id: storeId });
    if (error) return new NextResponse(error.message, { status: 500 });
    const stats = data as DashboardStats;
    rows = [
      ["المتجر", "عدد الفواتير", "الإيرادات", "نقداً", "بطاقة", "الخصومات", "تكلفة البضاعة", "الربح الإجمالي", "المصروفات", "صافي الربح", "عدد المرتجعات", "قيمة المرتجعات"],
      ...stats.stores.map((s) => [
        s.name, s.sales_count, s.revenue, s.cash, s.card, s.discounts, s.cogs,
        s.gross_profit, s.expenses, s.net_profit, s.refunds_count, s.refunds_total,
      ]),
    ];
  } else {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}_${from}_${to}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
