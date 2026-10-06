"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { selectStore, signOut } from "@/app/actions";
import { ROLE_LABELS, type AppRole, type Store } from "@/lib/types";

const ALL_STORES = "all";

export function Header({
  name,
  role,
  stores,
  selectedStore,
  canSeeAllStores,
}: {
  name: string;
  role: AppRole;
  stores: Store[];
  selectedStore: string;
  canSeeAllStores: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onChange(storeId: string) {
    startTransition(async () => {
      await selectStore(storeId);
      router.refresh();
    });
  }

  return (
    <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-black/5 bg-white px-4 py-2 print:hidden">
      <span className="text-lg font-bold text-emerald-700">الكاشير</span>

      {stores.length > 1 ? (
        <select
          aria-label="المتجر"
          value={selectedStore}
          disabled={pending}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 font-medium"
        >
          {canSeeAllStores && <option value={ALL_STORES}>كل المتاجر</option>}
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="rounded-lg bg-gray-100 px-2 py-1.5 font-medium">{stores[0]?.name}</span>
      )}

      <div className="ms-auto flex items-center gap-3 text-sm">
        <span>
          {name} <span className="text-gray-500">({ROLE_LABELS[role]})</span>
        </span>
        <form action={signOut}>
          <button type="submit" className="rounded-lg px-2 py-1 text-gray-600 hover:bg-gray-100">
            خروج
          </button>
        </form>
      </div>
    </header>
  );
}
