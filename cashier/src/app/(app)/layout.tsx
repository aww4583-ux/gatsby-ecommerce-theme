import { requireSession } from "@/lib/session";
import { Header } from "./header";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  if (!session.profile.is_active) {
    return (
      <Notice title="الحساب معطّل" body="تم تعطيل حسابك. تواصل مع صاحب العمل." />
    );
  }
  if (session.stores.length === 0) {
    return <Notice title="لا يوجد متجر" body="لم يتم ربطك بأي متجر بعد. تواصل مع صاحب العمل." />;
  }

  return (
    <>
      <Header
        name={session.profile.full_name || session.email}
        role={session.profile.role}
        stores={session.stores}
        selectedStore={session.selectedStore}
        canSeeAllStores={session.canSeeAllStores}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
        <h1 className="mb-2 text-xl font-bold">{title}</h1>
        <p className="text-gray-600">{body}</p>
      </div>
    </main>
  );
}
