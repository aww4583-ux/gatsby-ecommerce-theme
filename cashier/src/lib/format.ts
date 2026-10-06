export const CURRENCY = "د.ع";

const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// The number is wrapped in a left-to-right isolate (U+2066 … U+2069) so in
// RTL text a negative amount reads "-3,500 د.ع", not "3,500- د.ع".
export function formatMoney(value: number): string {
  return `\u2066${numberFormat.format(value)}\u2069 ${CURRENCY}`;
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

const dateParts = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Baghdad",
});

// "2026/10/06 14:05" in Baghdad time; plain digits stay readable in RTL.
export function formatDateTime(iso: string): string {
  const p = Object.fromEntries(
    dateParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}`;
}

// Parses user-typed amounts, accepting Arabic-Indic digits and separators.
export function parseAmount(input: string): number {
  const western = input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[,،\s]/g, "");
  const n = Number(western);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

type PgError = { message?: string; hint?: string; code?: string } | null;

// RPCs raise Arabic messages already; fall back for network/auth failures.
export function errorMessage(error: PgError | Error | unknown): string {
  if (!error) return "حدث خطأ غير متوقع";
  const e = error as PgError & { name?: string };
  if (e?.message && /fetch|network/i.test(e.message)) {
    return "تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد المحاولة.";
  }
  if (e?.message === "Invalid login credentials") return "البريد أو كلمة المرور غير صحيحة";
  return e?.message || "حدث خطأ غير متوقع";
}
