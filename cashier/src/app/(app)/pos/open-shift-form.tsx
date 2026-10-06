"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage, parseAmount } from "@/lib/format";

export function OpenShiftForm({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [openingCash, setOpeningCash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("open_shift", {
      p_store_id: storeId,
      p_opening_cash: parseAmount(openingCash),
    });
    if (error) {
      setError(errorMessage(error));
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5"
      >
        <div>
          <h1 className="text-xl font-bold">فتح وردية</h1>
          <p className="text-sm text-gray-500">{storeName}</p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">النقد الموجود في الدرج الآن (د.ع)</span>
          <input
            inputMode="numeric"
            dir="ltr"
            autoFocus
            required
            value={openingCash}
            onChange={(e) => setOpeningCash(e.target.value)}
            className="tabular w-full rounded-lg border border-gray-300 px-3 py-2 text-lg outline-none focus:border-emerald-600"
          />
        </label>
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? "جارٍ..." : "فتح الوردية والبدء بالبيع"}
        </button>
      </form>
    </main>
  );
}
