"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, formatMoney, formatNumber, parseAmount } from "@/lib/format";
import type { PaymentMethod, Product, Receipt, Store } from "@/lib/types";
import { ReceiptDialog } from "@/components/receipt-dialog";

const PRODUCT_COLUMNS =
  "id, store_id, name, barcode, category, sale_price, stock, low_stock_threshold, is_active";

const byName = (a: Product, b: Product) => a.name.localeCompare(b.name, "ar");

// crypto.randomUUID only exists on https/localhost; tills on a LAN may be http.
function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function PosScreen({ store }: { store: Store }) {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [scan, setScan] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [paidInput, setPaidInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  // Reused across retries of the *same* cart so a sale whose response was
  // lost is not recorded twice; a changed cart gets a new id.
  const pendingRequest = useRef<{ key: string; id: string } | null>(null);

  const applyProducts = useCallback(
    ({ data, error }: { data: Product[] | null; error: unknown }) => {
      if (error) setError(errorMessage(error));
      else if (data) setProducts(data);
      setLoading(false);
    },
    [],
  );

  const loadProducts = useCallback(
    () =>
      supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("store_id", store.id)
        .eq("is_active", true)
        .order("name")
        .returns<Product[]>()
        .then(applyProducts),
    [supabase, store.id, applyProducts],
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Live stock: sales on other tills and product edits arrive here.
  useEffect(() => {
    const channel = supabase
      .channel(`products:${store.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products", filter: `store_id=eq.${store.id}` },
        (payload) => {
          const row = payload.new as Product;
          if (!row?.id) return;
          setProducts((list) => {
            const others = list.filter((p) => p.id !== row.id);
            return row.is_active ? [...others, row].sort(byName) : others;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, store.id]);

  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ product: productsById.get(id), qty }))
    .filter((l): l is { product: Product; qty: number } => !!l.product && l.qty > 0);

  const subtotal = lines.reduce((sum, l) => sum + l.product.sale_price * l.qty, 0);
  const discount = Math.min(parseAmount(discountInput), subtotal);
  const total = subtotal - discount;
  const paid = method === "cash" ? (paidInput.trim() === "" ? total : parseAmount(paidInput)) : total;
  const change = paid - total;
  const canPay = lines.length > 0 && !busy && paid >= total;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.barcode?.startsWith(q),
    );
  }, [products, query]);

  function addToCart(product: Product) {
    setError(null);
    const inCart = cart[product.id] ?? 0;
    if (inCart + 1 > product.stock) {
      setError(`لا يوجد مخزون كافٍ من "${product.name}" (المتوفر: ${product.stock})`);
      return;
    }
    setCart({ ...cart, [product.id]: inCart + 1 });
  }

  function setQty(product: Product, qty: number) {
    setError(null);
    const next = { ...cart };
    if (qty <= 0) delete next[product.id];
    else next[product.id] = Math.min(qty, product.stock);
    if (qty > product.stock) {
      setError(`لا يوجد مخزون كافٍ من "${product.name}" (المتوفر: ${product.stock})`);
    }
    setCart(next);
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim();
    setScan("");
    if (!code) return;
    const match =
      products.find((p) => p.barcode === code) ??
      (() => {
        const byText = products.filter((p) => p.name.includes(code));
        return byText.length === 1 ? byText[0] : undefined;
      })();
    if (match) addToCart(match);
    else setError(`لا يوجد منتج بالباركود أو الاسم: ${code}`);
  }

  async function checkout() {
    if (!canPay) return;
    setBusy(true);
    setError(null);

    const payload = {
      p_store_id: store.id,
      p_items: lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
      p_payment_method: method,
      p_paid: method === "cash" ? paid : null,
      p_discount: discount,
    };
    const key = JSON.stringify(payload);
    if (pendingRequest.current?.key !== key) {
      pendingRequest.current = { key, id: newRequestId() };
    }

    const { data, error } = await supabase.rpc("complete_sale", {
      ...payload,
      p_client_request_id: pendingRequest.current.id,
    });

    if (error) {
      setError(errorMessage(error));
      setBusy(false);
      loadProducts();
      return;
    }

    pendingRequest.current = null;
    setReceipt(data as Receipt);
    setCart({});
    setDiscountInput("");
    setPaidInput("");
    setMethod("cash");
    setBusy(false);
    loadProducts();
  }

  // F2: focus the scanner field. F9: complete the sale.
  const checkoutRef = useRef(checkout);
  useEffect(() => {
    checkoutRef.current = checkout;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        scanRef.current?.focus();
      } else if (e.key === "F9") {
        e.preventDefault();
        checkoutRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function closeReceipt() {
    setReceipt(null);
    setTimeout(() => scanRef.current?.focus(), 0);
  }

  const quickAmounts = [total, ...[5000, 10000, 25000, 50000].map((n) => Math.ceil(total / n) * n)]
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
    .slice(0, 4);

  return (
    <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[1fr_400px]">
      {/* Products */}
      <section className="flex min-h-0 flex-col gap-3">
        <form onSubmit={onScan} className="flex gap-2">
          <input
            ref={scanRef}
            autoFocus
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="امسح الباركود أو اكتب الاسم ثم Enter  (F2)"
            aria-label="الباركود"
            className="flex-1 rounded-xl border-2 border-emerald-600 bg-white px-4 py-3 text-lg outline-none"
          />
        </form>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في المنتجات..."
          aria-label="بحث"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 outline-none focus:border-emerald-600"
        />

        {loading ? (
          <p className="p-6 text-center text-gray-500">جارٍ تحميل المنتجات...</p>
        ) : products.length === 0 ? (
          <p className="rounded-xl bg-white p-6 text-center text-gray-500">
            لا توجد منتجات في هذا المتجر بعد.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const left = p.stock - (cart[p.id] ?? 0);
              const low = p.stock <= p.low_stock_threshold;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addToCart(p)}
                    disabled={left <= 0}
                    className="flex h-full w-full flex-col items-start gap-1 rounded-xl bg-white p-3 text-start shadow-sm ring-1 ring-black/5 hover:ring-emerald-600 disabled:opacity-40"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="tabular text-emerald-700">{formatMoney(p.sale_price)}</span>
                    <span className={`tabular text-xs ${low ? "font-semibold text-amber-700" : "text-gray-500"}`}>
                      المخزون: {formatNumber(p.stock)}
                      {low && " · منخفض"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Cart */}
      <section className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)]">
        <h2 className="text-lg font-bold">الفاتورة</h2>

        <ul className="min-h-24 flex-1 divide-y divide-gray-100 overflow-y-auto">
          {lines.length === 0 && <li className="py-6 text-center text-gray-400">السلة فارغة</li>}
          {lines.map(({ product, qty }) => (
            <li key={product.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{product.name}</div>
                <div className="tabular text-xs text-gray-500">{formatMoney(product.sale_price)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="إنقاص"
                  onClick={() => setQty(product, qty - 1)}
                  className="h-8 w-8 rounded-lg bg-gray-100 text-lg hover:bg-gray-200"
                >
                  −
                </button>
                <input
                  aria-label={`كمية ${product.name}`}
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(product, parseAmount(e.target.value))}
                  className="tabular h-8 w-12 rounded-lg border border-gray-300 text-center"
                />
                <button
                  type="button"
                  aria-label="زيادة"
                  onClick={() => setQty(product, qty + 1)}
                  className="h-8 w-8 rounded-lg bg-gray-100 text-lg hover:bg-gray-200"
                >
                  +
                </button>
              </div>
              <div className="tabular w-24 text-end font-semibold">
                {formatNumber(product.sale_price * qty)}
              </div>
            </li>
          ))}
        </ul>

        <dl className="tabular space-y-1 border-t border-gray-100 pt-3 text-sm">
          <div className="flex justify-between">
            <dt>المجموع</dt>
            <dd>{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt>
              <label htmlFor="discount">الخصم</label>
            </dt>
            <dd>
              <input
                id="discount"
                inputMode="numeric"
                dir="ltr"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder="0"
                className="tabular w-32 rounded-lg border border-gray-300 px-2 py-1 text-end"
              />
            </dd>
          </div>
          <div className="flex justify-between pt-1 text-xl font-bold">
            <dt>الإجمالي</dt>
            <dd>{formatMoney(total)}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="طريقة الدفع">
          {(["cash", "card"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={`rounded-lg py-2 font-semibold ring-1 ${
                method === m ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-gray-300"
              }`}
            >
              {m === "cash" ? "نقداً" : "بطاقة"}
            </button>
          ))}
        </div>

        {method === "cash" && (
          <div className="space-y-2">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>المبلغ المستلم</span>
              <input
                inputMode="numeric"
                dir="ltr"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && checkout()}
                placeholder={formatNumber(total)}
                className="tabular w-32 rounded-lg border border-gray-300 px-2 py-1 text-end"
              />
            </label>
            {quickAmounts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {quickAmounts.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPaidInput(String(v))}
                    className="tabular rounded-md bg-gray-100 px-2 py-1 text-xs hover:bg-gray-200"
                  >
                    {formatNumber(v)}
                  </button>
                ))}
              </div>
            )}
            <div className={`tabular flex justify-between font-semibold ${change < 0 ? "text-red-600" : ""}`}>
              <span>{change < 0 ? "المتبقي على الزبون" : "الباقي للزبون"}</span>
              <span>{formatMoney(Math.abs(change))}</span>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={checkout}
          disabled={!canPay}
          className="rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "جارٍ الحفظ..." : `إتمام البيع  (F9)`}
        </button>
      </section>

      {receipt && (
        <ReceiptDialog receipt={receipt} onClose={closeReceipt} heading="تم البيع بنجاح ✓" closeLabel="بيع جديد" />
      )}
    </main>
  );
}
