"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";

export function SetupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().rpc("create_organization", {
      p_org_name: orgName.trim(),
      p_store_name: storeName.trim(),
      p_full_name: fullName.trim(),
    });
    if (error) {
      setError(errorMessage(error));
      setBusy(false);
      return;
    }
    router.replace("/pos");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">اسمك</span>
        <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">اسم النشاط التجاري</span>
        <input required value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">اسم أول متجر</span>
        <input required value={storeName} onChange={(e) => setStoreName(e.target.value)} className={inputClass} />
      </label>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? "جارٍ..." : "ابدأ"}
      </button>
    </form>
  );
}
