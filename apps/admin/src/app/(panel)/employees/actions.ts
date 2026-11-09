"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, type CurrentEmployee } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordProblem } from "@/lib/password";
import { isRotation, parseEmployee } from "@/lib/validation";

// Every action re-checks the admin role; RLS checks it again for the admin's own queries.
// The service client is used only where the admin's session cannot act
// (log-ins, passwords, storage files, the audit log of exports).

export type FormState = { error?: string; ok?: boolean };

const emailFor = (fileNumber: number) => `${fileNumber}@jahez.local`;

type Target = {
  id: string;
  file_number: number;
  role: "employee" | "supervisor" | "hr" | "admin";
  user_id: string | null;
  is_active: boolean;
};

async function loadTarget(id: string): Promise<Target | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("id, file_number, role, user_id, is_active")
    .eq("id", id)
    .maybeSingle();
  return data as Target | null;
}

/** Shared guards: never act on your own account or on the system admin. */
function guard(me: CurrentEmployee, target: Target | null): string | null {
  if (!target) return "not_found";
  if (target.id === me.id) return "own_account";
  if (target.role === "admin") return "admin_account";
  return null;
}

async function rotationNeedsDate(patternId: string | null, cycle: string | null) {
  if (!patternId) return false;
  const supabase = await createClient();
  const { data } = await supabase.from("work_patterns").select("kind").eq("id", patternId).maybeSingle();
  return !!data && isRotation(data.kind) && !cycle;
}

const refresh = (id?: string) => {
  revalidatePath("/employees");
  if (id) revalidatePath(`/employees/${id}`);
};

// ------------------------------------------------------------------ details

export async function createEmployee(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { error: parsed.error };
  if (await rotationNeedsDate(parsed.value.work_pattern_id, parsed.value.cycle_start_date)) {
    return { error: "cycle_required" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("employees").insert(parsed.value).select("id").single();
  if (error) return { error: error.code === "23505" ? "duplicate_file_number" : "generic" };
  refresh();
  redirect(`/employees/${data.id}`);
}

export async function updateEmployee(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const parsed = parseEmployee(formData);
  if (!parsed.ok) return { error: parsed.error };
  if (await rotationNeedsDate(parsed.value.work_pattern_id, parsed.value.cycle_start_date)) {
    return { error: "cycle_required" };
  }
  const target = await loadTarget(id);
  if (!target) return { error: "not_found" };
  // The file number is the log-in name; it cannot change once a log-in exists.
  if (target.user_id && parsed.value.file_number !== target.file_number) return { error: "invalid_file_number" };
  if (target.id === me.id && parsed.value.file_number !== target.file_number) return { error: "own_account" };

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update(parsed.value).eq("id", id);
  if (error) return { error: error.code === "23505" ? "duplicate_file_number" : "generic" };
  refresh(id);
  return { ok: true };
}

// ------------------------------------------------------------------ role and password

export async function setRole(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const target = await loadTarget(id);
  const blocked = guard(me, target);
  if (blocked) return { error: blocked };

  const role = String(formData.get("role") ?? "");
  if (!["employee", "supervisor", "hr"].includes(role)) return { error: "invalid_role" };

  const supabase = await createClient();
  if (target!.role === "supervisor" && role !== "supervisor") {
    const { count } = await supabase
      .from("departments").select("id", { count: "exact", head: true }).eq("supervisor_id", id);
    if ((count ?? 0) > 0) return { error: "supervises_department" };
  }
  const { error } = await supabase.from("employees").update({ role }).eq("id", id);
  if (error) return { error: "generic" };
  refresh(id);
  return { ok: true };
}

export async function setPassword(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const target = await loadTarget(id);
  const blocked = guard(me, target);
  if (blocked) return { error: blocked };

  const password = String(formData.get("password") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) return { error: "mismatch" };
  const problem = passwordProblem(password, target!.file_number);
  if (problem) return { error: problem };

  const admin = createAdminClient();
  if (target!.user_id) {
    const { error } = await admin.auth.admin.updateUserById(target!.user_id, { password });
    if (error) return { error: /weak|pwned|leaked/i.test(error.message) ? "password_rejected" : "generic" };
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: emailFor(target!.file_number),
      password,
      email_confirm: true,
      app_metadata: { file_number: target!.file_number },
      // A suspended employee gets a log-in that stays blocked until re-enabled.
      ...(target!.is_active ? {} : { ban_duration: "876000h" }),
    });
    if (error || !data.user) {
      return { error: error && /weak|pwned|leaked/i.test(error.message) ? "password_rejected" : "generic" };
    }
    const supabase = await createClient();
    const { error: linkError } = await supabase.from("employees").update({ user_id: data.user.id }).eq("id", id);
    if (linkError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { error: "generic" };
    }
  }

  const supabase = await createClient();
  await supabase.from("employees").update({ must_change_password: true }).eq("id", id);
  refresh(id);
  return { ok: true };
}

// ------------------------------------------------------------------ sites and device

export async function setSites(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const wanted = new Set(formData.getAll("site_id").map(String));
  const supabase = await createClient();
  const { data: current } = await supabase.from("employee_sites").select("site_id").eq("employee_id", id);
  const have = new Set((current ?? []).map((r) => r.site_id));

  const toAdd = [...wanted].filter((s) => !have.has(s));
  const toRemove = [...have].filter((s) => !wanted.has(s));
  if (toAdd.length) {
    const { error } = await supabase.from("employee_sites").insert(toAdd.map((site_id) => ({ employee_id: id, site_id })));
    if (error) return { error: "generic" };
  }
  if (toRemove.length) {
    const { error } = await supabase.from("employee_sites").delete().eq("employee_id", id).in("site_id", toRemove);
    if (error) return { error: "generic" };
  }
  refresh(id);
  return { ok: true };
}

export async function unbindDevice(id: string, _prev: FormState): Promise<FormState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("devices").delete().eq("employee_id", id);
  if (error) return { error: "generic" };
  refresh(id);
  return { ok: true };
}

// ------------------------------------------------------------------ suspend

export async function setActive(id: string, active: boolean, _prev: FormState): Promise<FormState> {
  const me = await requireAdmin();
  const target = await loadTarget(id);
  const blocked = guard(me, target);
  if (blocked) return { error: blocked };

  const supabase = await createClient();
  const { error } = await supabase.from("employees").update({ is_active: active }).eq("id", id);
  if (error) return { error: "generic" };
  if (target!.user_id) {
    // Banning also ends any open session at its next refresh.
    await createAdminClient().auth.admin.updateUserById(target!.user_id, {
      ban_duration: active ? "none" : "876000h",
    });
  }
  refresh(id);
  return { ok: true };
}

// ------------------------------------------------------------------ end of service

export async function terminateEmployee(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const target = await loadTarget(id);
  const blocked = guard(me, target);
  if (blocked) return { error: blocked };
  if (String(formData.get("confirm") ?? "").trim() !== String(target!.file_number)) return { error: "confirm_mismatch" };

  const admin = createAdminClient();

  // Both exports must have been downloaded by this admin in the last 2 hours.
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: exports } = await admin
    .from("audit_log")
    .select("action")
    .eq("table_name", "employees")
    .eq("record_id", id)
    .eq("actor_user_id", me.userId)
    .in("action", ["export_xlsx", "export_pdf"])
    .gte("created_at", since);
  const done = new Set((exports ?? []).map((e) => e.action));
  if (!done.has("export_xlsx") || !done.has("export_pdf")) return { error: "export_first" };

  // Photos in both private buckets (stored under "<employee id>/").
  for (const bucket of ["punch-photos", "face-enrollment-photos"]) {
    const { data: files } = await admin.storage.from(bucket).list(id, { limit: 1000 });
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${id}/${f.name}`));
  }

  // Deleting the employee removes their phone, face template, consents, enabled sites,
  // punches, requests, notifications and emergency records (ON DELETE CASCADE).
  const supabase = await createClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) return { error: "generic" };
  if (target!.user_id) await admin.auth.admin.deleteUser(target!.user_id);

  refresh();
  redirect(`/employees?terminated=${target!.file_number}`);
}
