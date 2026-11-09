import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type StaffRole = "supervisor" | "hr" | "admin";

export type CurrentEmployee = {
  id: string;
  fileNumber: number;
  nameAr: string;
  nameEn: string;
  role: "employee" | StaffRole;
  mustChangePassword: boolean;
};

/** The signed-in employee, or null. RLS lets each user read only their own row (staff read all). */
export async function getCurrentEmployee(): Promise<CurrentEmployee | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("employees")
    .select("id, file_number, full_name_ar, full_name_en, role, must_change_password, is_active")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!data || !data.is_active) return null;

  return {
    id: data.id,
    fileNumber: data.file_number,
    nameAr: data.full_name_ar,
    nameEn: data.full_name_en,
    role: data.role,
    mustChangePassword: data.must_change_password,
  };
}

/**
 * Gate for every page of the web panel: signed in, active, staff role,
 * and password already changed. Redirects otherwise.
 */
export async function requireStaff(): Promise<CurrentEmployee & { role: StaffRole }> {
  const me = await getCurrentEmployee();
  if (!me || me.role === "employee") redirect("/login");
  if (me.mustChangePassword) redirect("/change-password");
  return me as CurrentEmployee & { role: StaffRole };
}

/** Gate for admin-only pages and actions (organisation, employees, …). */
export async function requireAdmin(): Promise<CurrentEmployee & { role: "admin" }> {
  const me = await requireStaff();
  if (me.role !== "admin") redirect("/");
  return me as CurrentEmployee & { role: "admin" };
}
