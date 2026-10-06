"use client";

import { usePathname, useRouter } from "next/navigation";
import { buttonSecondary, inputClass } from "@/lib/ui";

// From/to date filter that writes ?from=&to= to the current page's URL,
// plus quick presets. Dates are Baghdad calendar days (YYYY-MM-DD).
export function DateRange({ from, to, today }: { from: string; to: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (f: string, t: string) => router.push(`${pathname}?from=${f}&to=${t}`);

  const shift = (days: number) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const presets: [string, string, string][] = [
    ["اليوم", today, today],
    ["آخر 7 أيام", shift(-6), today],
    ["هذا الشهر", today.slice(0, 8) + "01", today],
    ["آخر 30 يوماً", shift(-29), today],
  ];

  return (
    <div className="flex flex-wrap items-end gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          go(String(f.get("from")), String(f.get("to")));
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label>
          <span className="mb-1 block text-sm">من</span>
          <input type="date" name="from" defaultValue={from} key={from} className={inputClass} />
        </label>
        <label>
          <span className="mb-1 block text-sm">إلى</span>
          <input type="date" name="to" defaultValue={to} key={to} className={inputClass} />
        </label>
        <button type="submit" className={buttonSecondary}>
          عرض
        </button>
      </form>
      <div className="flex flex-wrap gap-1">
        {presets.map(([label, f, t]) => (
          <button
            key={label}
            type="button"
            onClick={() => go(f, t)}
            aria-pressed={f === from && t === to}
            className={`rounded-lg px-3 py-2 text-sm ${
              f === from && t === to ? "bg-emerald-50 font-semibold text-emerald-800" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
