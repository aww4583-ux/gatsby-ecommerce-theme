"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/format";
import { STAFF_DOMAIN, toLoginEmail } from "@/lib/login";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const supabase = createClient();
    const loginEmail = toLoginEmail(email);
    if (!loginEmail || (mode === "signup" && (!email.includes("@") || loginEmail.endsWith(STAFF_DOMAIN)))) {
      setError(mode === "signup" ? "أدخل بريداً إلكترونياً صحيحاً" : "أدخل بريداً أو اسم مستخدم صحيحاً");
      setBusy(false);
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) {
        setError(errorMessage(error));
        setBusy(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email: loginEmail, password });
      if (error) {
        setError(errorMessage(error));
        setBusy(false);
        return;
      }
      if (!data.session) {
        setNotice("تم إنشاء الحساب. افتح الرابط المرسل إلى بريدك ثم سجّل الدخول.");
        setMode("signin");
        setBusy(false);
        return;
      }
    }

    router.replace("/");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          {mode === "signin" ? "البريد أو اسم المستخدم" : "البريد الإلكتروني"}
        </span>
        <input
          type={mode === "signin" ? "text" : "email"}
          autoCapitalize="none"
          dir="ltr"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">كلمة المرور</span>
        <input
          type="password"
          dir="ltr"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? "جارٍ..." : mode === "signin" ? "تسجيل الدخول" : "إنشاء حساب"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
        }}
        className="w-full text-sm text-gray-600 hover:text-gray-900"
      >
        {mode === "signin" ? "صاحب عمل جديد؟ أنشئ حساباً" : "لديك حساب؟ سجّل الدخول"}
      </button>
    </form>
  );
}
