import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";

// Cashiers land on the till; owners and managers on the dashboard.
export default async function Home() {
  const session = await requireSession();
  redirect(session.profile.role === "cashier" ? "/pos" : "/dashboard");
}
