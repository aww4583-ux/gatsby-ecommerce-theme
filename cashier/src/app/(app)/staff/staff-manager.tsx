"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { displayLogin } from "@/lib/login";
import { ROLE_LABELS, type AppRole, type StaffMember, type Store } from "@/lib/types";
import { buttonPrimary, buttonSecondary, cardClass, inputClass, tableClass } from "@/lib/ui";
import { createStaff, setStaffActive, updateStaff } from "./actions";

type Draft = {
  userId: string | null;
  fullName: string;
  email: string;
  password: string;
  role: AppRole;
  storeIds: string[];
};

const ROLE_HELP: Record<AppRole, string> = {
  cashier: "يبيع ويفتح ويغلق ورديته فقط، ولا يرى التكلفة أو الأرباح",
  manager: "يدير المنتجات والمصروفات والورديات في متاجره",
  owner: "صلاحية كاملة على كل المتاجر والموظفين",
};

export function StaffManager({
  staff,
  stores,
  currentUserId,
}: {
  staff: StaffMember[];
  stores: Store[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? "";

  function openNew() {
    setError(null);
    setDraft({
      userId: null,
      fullName: "",
      email: "",
      password: "",
      role: "cashier",
      storeIds: stores.length === 1 ? [stores[0].id] : [],
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError(null);
    const base = { fullName: draft.fullName, role: draft.role, storeIds: draft.storeIds };
    const { error } = draft.userId
      ? await updateStaff({ ...base, userId: draft.userId, newPassword: draft.password })
      : await createStaff({ ...base, email: draft.email, password: draft.password });
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    setDraft(null);
    router.refresh();
  }

  async function toggleActive(m: StaffMember) {
    const msg = m.is_active
      ? `إيقاف حساب ${m.full_name}؟ لن يتمكن من رؤية أي بيانات أو البيع.`
      : `إعادة تفعيل حساب ${m.full_name}؟`;
    if (!confirm(msg)) return;
    const { error } = await setStaffActive(m.user_id, !m.is_active);
    if (error) alert(error);
    router.refresh();
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const toggleStore = (id: string) =>
    setDraft((d) =>
      d
        ? { ...d, storeIds: d.storeIds.includes(id) ? d.storeIds.filter((x) => x !== id) : [...d.storeIds, id] }
        : d,
    );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">الموظفون</h1>
        <button type="button" onClick={openNew} className={`${buttonPrimary} ms-auto`}>
          + موظف جديد
        </button>
      </div>

      <div className={`${cardClass} overflow-x-auto p-0`}>
        <table className={tableClass}>
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-start">الاسم</th>
              <th className="text-start">اسم الدخول</th>
              <th className="text-start">الصلاحية</th>
              <th className="text-start">المتاجر</th>
              <th className="text-start">الحالة</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((m) => {
              const self = m.user_id === currentUserId;
              return (
                <tr key={m.user_id} className={m.is_active ? "" : "text-gray-400"}>
                  <td className="font-medium">{m.full_name}</td>
                  <td dir="ltr" className="text-end">{displayLogin(m.email)}</td>
                  <td>{ROLE_LABELS[m.role]}</td>
                  <td>{m.role === "owner" ? "كل المتاجر" : m.store_ids.map(storeName).join("، ")}</td>
                  <td>{m.is_active ? "فعّال" : "موقوف"}</td>
                  <td className="whitespace-nowrap text-end">
                    {self ? (
                      <span className="text-xs text-gray-400">(أنت)</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setDraft({
                              userId: m.user_id,
                              fullName: m.full_name,
                              email: m.email,
                              password: "",
                              role: m.role,
                              storeIds: m.store_ids,
                            });
                          }}
                          className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(m)}
                          className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100"
                        >
                          {m.is_active ? "إيقاف" : "تفعيل"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {draft && (
        <Dialog title={draft.userId ? `تعديل ${draft.fullName}` : "موظف جديد"} onClose={() => setDraft(null)}>
          <form onSubmit={save} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium">الاسم</span>
              <input required autoFocus value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} className={inputClass} />
            </label>
            {draft.userId ? (
              <p className="text-sm text-gray-600">
                اسم الدخول: <span dir="ltr">{displayLogin(draft.email)}</span>
              </p>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-medium">اسم المستخدم أو البريد (للدخول)</span>
                <input required dir="ltr" autoCapitalize="none" placeholder="ali أو ali@example.com" autoComplete="off" value={draft.email} onChange={(e) => set({ email: e.target.value })} className={inputClass} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-sm font-medium">
                {draft.userId ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور"}
              </span>
              <input
                required={!draft.userId}
                minLength={8}
                type="text"
                dir="ltr"
                autoComplete="new-password"
                value={draft.password}
                onChange={(e) => set({ password: e.target.value })}
                className={inputClass}
              />
            </label>

            <fieldset>
              <legend className="mb-1 text-sm font-medium">الصلاحية</legend>
              <div className="space-y-1">
                {(["cashier", "manager", "owner"] as const).map((r) => (
                  <label key={r} className="flex items-start gap-2 rounded-lg p-2 hover:bg-gray-50">
                    <input type="radio" name="role" checked={draft.role === r} onChange={() => set({ role: r })} className="mt-1" />
                    <span>
                      <span className="font-medium">{ROLE_LABELS[r]}</span>
                      <span className="block text-xs text-gray-500">{ROLE_HELP[r]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {draft.role !== "owner" && (
              <fieldset>
                <legend className="mb-1 text-sm font-medium">المتاجر</legend>
                <div className="flex flex-wrap gap-2">
                  {stores.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1 ring-gray-300">
                      <input type="checkbox" checked={draft.storeIds.includes(s.id)} onChange={() => toggleStore(s.id)} />
                      {s.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

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
