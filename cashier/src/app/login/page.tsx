import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h1 className="mb-1 text-2xl font-bold">الكاشير</h1>
        <p className="mb-6 text-sm text-gray-500">نظام نقاط البيع وإدارة المتاجر</p>
        <LoginForm />
      </div>
    </main>
  );
}
