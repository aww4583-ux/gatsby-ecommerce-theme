"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorMessage } from "@/lib/format";
import type { AppRole, StaffMember } from "@/lib/types";

type Result = { error: string | null };

export type StaffInput = {
  fullName: string;
  role: AppRole;
  storeIds: string[];
};

const ROLES: AppRole[] = ["owner", "manager", "cashier"];

// Server actions are public endpoints: check shapes, not just values.
function validate(input: StaffInput): string | null {
  if (typeof input?.fullName !== "string" || !Array.isArray(input.storeIds)) return "بيانات غير صالحة";
  if (input.storeIds.some((id) => typeof id !== "string")) return "بيانات غير صالحة";
  if (!input.fullName.trim()) return "أدخل اسم الموظف";
  if (!ROLES.includes(input.role)) return "صلاحية غير صالحة";
  if (input.role !== "owner" && input.storeIds.length === 0) return "اختر متجراً واحداً على الأقل";
  return null;
}

// Org staff as the signed-in user sees them. org_staff() raises unless the
// caller is an active owner, so this doubles as the authorization check
// before any service-role call.
async function ownerStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("org_staff");
  return { supabase, staff: data as StaffMember[] | null, error };
}

export async function createStaff(
  input: StaffInput & { email: string; password: string },
): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  if (typeof input.email !== "string" || typeof input.password !== "string") return { error: "بيانات غير صالحة" };
  if (input.password.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };

  const { supabase, error: authError } = await ownerStaff();
  if (authError) return { error: errorMessage(authError) };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    if (createError?.code === "email_exists" || /already/i.test(createError?.message ?? "")) {
      return { error: "هذا البريد مسجّل مسبقاً" };
    }
    return { error: errorMessage(createError) };
  }

  const { error } = await supabase.rpc("upsert_staff", {
    p_user_id: created.user.id,
    p_full_name: input.fullName.trim(),
    p_role: input.role,
    p_store_ids: input.role === "owner" ? [] : input.storeIds,
  });
  if (error) {
    // Do not leave a login with no profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: errorMessage(error) };
  }
  return { error: null };
}

export async function updateStaff(
  input: StaffInput & { userId: string; newPassword: string },
): Promise<Result> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };
  if (typeof input.userId !== "string" || typeof input.newPassword !== "string") {
    return { error: "بيانات غير صالحة" };
  }

  const { supabase, staff, error: authError } = await ownerStaff();
  if (authError) return { error: errorMessage(authError) };
  if (!staff?.some((s) => s.user_id === input.userId)) return { error: "الموظف غير موجود" };

  const { error } = await supabase.rpc("upsert_staff", {
    p_user_id: input.userId,
    p_full_name: input.fullName.trim(),
    p_role: input.role,
    p_store_ids: input.role === "owner" ? [] : input.storeIds,
  });
  if (error) return { error: errorMessage(error) };

  if (input.newPassword) {
    if (input.newPassword.length < 8) return { error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" };
    const { error: pwError } = await createAdminClient().auth.admin.updateUserById(input.userId, {
      password: input.newPassword,
    });
    if (pwError) return { error: errorMessage(pwError) };
  }
  return { error: null };
}

export async function setStaffActive(userId: string, active: boolean): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_staff_active", { p_user_id: userId, p_active: active });
  return { error: error ? errorMessage(error) : null };
}
