"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import type { Store } from "@/lib/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass } from "@/lib/ui";

type Draft = { id: string | null; name: string; address: string; phone: string };

export function StoresManager({ stores, organizationId }: { stores: Store[]; organizationId: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const values = {
      name: draft.name.trim(),
      address: draft.address.trim() || null,
      phone: draft.phone.trim() || null,
    };
    const supabase = createClient();
    const { error } = draft.id
      ? await supabase.from("stores").update(values).eq("id", draft.id)
      : await supabase.from("stores").insert({ ...values, organization_id: organizationId });
    setBusy(false);
    if (error) {
      setError(errorMessage(error));
      return;
    }
    setDraft(null);
    router.refresh();
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <main className="mx-auto w-full max-w-4xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">المتاجر</h1>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setDraft({ id: null, name: "", address: "", phone: "" });
          }}
          className={`${buttonPrimary} ms-auto`}
        >
          + متجر جديد
        </button>
      </div>
      <p className="text-sm text-gray-600">
        العنوان والهاتف يظهران في رأس الإيصال. بعد إضافة متجر، اربط به موظفين من صفحة الموظفين.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2">
        {stores.map((s) => (
          <li key={s.id} className={`${cardClass} flex items-start gap-3`}>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{s.name}</div>
              <div className="text-sm text-gray-600">{s.address || "—"}</div>
              <div dir="ltr" className="text-end text-sm text-gray-600">{s.phone}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setDraft({ id: s.id, name: s.name, address: s.address ?? "", phone: s.phone ?? "" });
              }}
              className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50"
            >
              تعديل
            </button>
          </li>
        ))}
      </ul>

      {draft && (
        <Dialog title={draft.id ? `تعديل ${draft.name}` : "متجر جديد"} onClose={() => setDraft(null)}>
          <form onSubmit={save} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">اسم المتجر</span>
              <input required autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">العنوان</span>
              <input value={draft.address} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">الهاتف</span>
              <input dir="ltr" inputMode="tel" value={draft.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClass} />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div className="flex justify-end gap-2">
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
