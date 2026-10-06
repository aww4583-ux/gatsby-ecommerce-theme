import { requireOwner } from "@/lib/session";
import { StoresManager } from "./stores-manager";

export default async function StoresPage() {
  const session = await requireOwner();
  return <StoresManager stores={session.stores} organizationId={session.profile.organization_id} />;
}
