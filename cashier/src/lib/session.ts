import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Store } from "@/lib/types";

export const STORE_COOKIE = "pos_store";
export const ALL_STORES = "all";

export type AppSession = {
  userId: string;
  email: string;
  profile: Profile;
  stores: Store[];
  // A store id, or ALL_STORES (owner/manager only).
  selectedStore: string;
  canSeeAllStores: boolean;
};

// Loads the signed-in user, their profile and the stores RLS lets them see.
// Redirects to /login or /setup when either is missing.
export async function requireSession(): Promise<AppSession> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, organization_id, full_name, role, is_active")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect("/setup");

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, address, phone")
    .order("created_at")
    .returns<Store[]>();

  const canSeeAllStores = profile.role !== "cashier" && (stores?.length ?? 0) > 1;
  const saved = (await cookies()).get(STORE_COOKIE)?.value;
  const valid =
    (saved === ALL_STORES && canSeeAllStores) || stores?.some((s) => s.id === saved);
  const selectedStore = valid && saved ? saved : (stores?.[0]?.id ?? "");

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    stores: stores ?? [],
    selectedStore,
    canSeeAllStores,
  };
}

// Pages for owners/managers only. Cashiers are sent back to the till.
export async function requireManager(): Promise<AppSession> {
  const session = await requireSession();
  if (session.profile.role === "cashier" || !session.profile.is_active) redirect("/pos");
  return session;
}

export async function requireOwner(): Promise<AppSession> {
  const session = await requireSession();
  if (session.profile.role !== "owner" || !session.profile.is_active) redirect("/pos");
  return session;
}

// Today and the first day of this month, in Baghdad time (YYYY-MM-DD).
export function baghdadToday(): { today: string; monthStart: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baghdad" }).format(new Date());
  return { today, monthStart: today.slice(0, 8) + "01" };
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ?from=&to= search params, defaulting to this month so far.
export function parseRange(params: Record<string, string | string[] | undefined>) {
  const { today, monthStart } = baghdadToday();
  let from = isDate(params.from) ? params.from : monthStart;
  let to = isDate(params.to) ? params.to : today;
  if (from > to) [from, to] = [to, from];
  return { from, to, today };
}
