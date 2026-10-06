import { requireOwner } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { StaffMember } from "@/lib/types";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const session = await requireOwner();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_staff");
  if (error) throw new Error(error.message);

  return <StaffManager staff={(data as StaffMember[] | null) ?? []} stores={session.stores} currentUserId={session.userId} />;
}
