"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ALL_STORES, STORE_COOKIE } from "@/lib/session";

// The value is only a preference; requireSession re-validates it against
// the stores RLS allows, so a forged cookie grants nothing.
export async function selectStore(storeId: string) {
  if (storeId !== ALL_STORES && !/^[0-9a-f-]{36}$/i.test(storeId)) return;
  (await cookies()).set(STORE_COOKIE, storeId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(STORE_COOKIE);
  redirect("/login");
}
