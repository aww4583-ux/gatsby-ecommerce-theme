import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

// First sign-in of a new business owner: create the organization and its
// first store. Staff accounts never land here because the owner creates
// their profile.
export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile) redirect("/");

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="mb-1 text-2xl font-bold">إعداد نشاطك التجاري</h1>
        <p className="mb-6 text-sm text-gray-500">
          إذا كنت موظفاً، اطلب من صاحب العمل إضافتك بدلاً من إنشاء نشاط جديد.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
