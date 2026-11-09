"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  parseBuilding,
  parseDepartment,
  parseHoliday,
  parseSite,
  parseWorkPattern,
} from "@/lib/validation";

// Every action re-checks the admin role here, and RLS checks it again in the database.

export type FormState = { error?: string; ok?: boolean };

const BASE = "/organisation";

async function db() {
  await requireAdmin();
  return createClient();
}

async function count(table: string, column: string, value: string): Promise<number> {
  const supabase = await createClient();
  const { count: n, error } = await supabase.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return n ?? 0;
}

// ------------------------------------------------------------------ departments

export async function createDepartment(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseDepartment(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase
    .from("departments")
    .insert({ name_ar: parsed.value.name_ar, name_en: parsed.value.name_en });
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/departments`);
  return { ok: true };
}

export async function updateDepartment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseDepartment(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { supervisor_id, ...names } = parsed.value;

  const { data: current } = await supabase.from("departments").select("supervisor_id").eq("id", id).maybeSingle();
  if (!current) return { error: "not_found" };

  if (supervisor_id) {
    const { data: member } = await supabase
      .from("employees").select("id, role").eq("id", supervisor_id).eq("department_id", id).maybeSingle();
    if (!member) return { error: "supervisor_not_in_department" };
  }

  const { error } = await supabase.from("departments").update({ ...names, supervisor_id }).eq("id", id);
  if (error) return { error: "generic" };

  if (current.supervisor_id !== supervisor_id) {
    // New supervisor gets the supervisor role (HR and admin keep theirs).
    if (supervisor_id) {
      await supabase.from("employees").update({ role: "supervisor" }).eq("id", supervisor_id).eq("role", "employee");
    }
    // The previous supervisor goes back to employee if they supervise nothing else.
    if (current.supervisor_id) {
      const stillSupervises = await count("departments", "supervisor_id", current.supervisor_id);
      if (stillSupervises === 0) {
        await supabase.from("employees").update({ role: "employee" }).eq("id", current.supervisor_id).eq("role", "supervisor");
      }
    }
  }

  revalidatePath(`${BASE}/departments`);
  return { ok: true };
}

export async function deleteDepartment(id: string, _prev: FormState): Promise<FormState> {
  const supabase = await db();
  if ((await count("employees", "department_id", id)) > 0) return { error: "department_in_use" };
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/departments`);
  redirect(`${BASE}/departments`);
}

// ------------------------------------------------------------------ sites

export async function createSite(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseSite(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { data, error } = await supabase.from("sites").insert(parsed.value).select("id").single();
  if (error || !data) return { error: "generic" };
  revalidatePath(`${BASE}/sites`);
  redirect(`${BASE}/sites/${data.id}`);
}

export async function updateSite(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseSite(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.from("sites").update(parsed.value).eq("id", id);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/sites`);
  revalidatePath(`${BASE}/sites/${id}`);
  return { ok: true };
}

export async function setSiteActive(id: string, active: boolean) {
  const supabase = await db();
  await supabase.from("sites").update({ is_active: active }).eq("id", id);
  revalidatePath(`${BASE}/sites`);
  revalidatePath(`${BASE}/sites/${id}`);
}

export async function deleteSite(id: string, _prev: FormState): Promise<FormState> {
  const supabase = await db();
  const inUse =
    (await count("employee_sites", "site_id", id)) +
    (await count("attendance_punches", "site_id", id)) +
    (await count("requests", "mission_site_id", id)) +
    (await count("emergencies", "site_id", id));
  if (inUse > 0) return { error: "site_in_use" };
  const { error } = await supabase.from("sites").delete().eq("id", id);
  if (error) return { error: error.code === "23503" ? "site_in_use" : "generic" };
  revalidatePath(`${BASE}/sites`);
  redirect(`${BASE}/sites`);
}

// ------------------------------------------------------------------ buildings

export async function createBuilding(siteId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseBuilding(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.from("buildings").insert({ ...parsed.value, site_id: siteId });
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/sites/${siteId}`);
  return { ok: true };
}

export async function deleteBuilding(id: string, siteId: string, _prev: FormState): Promise<FormState> {
  const supabase = await db();
  const { error } = await supabase.from("buildings").delete().eq("id", id);
  if (error) return { error: error.code === "23503" ? "building_in_use" : "generic" };
  revalidatePath(`${BASE}/sites/${siteId}`);
  return { ok: true };
}

// ------------------------------------------------------------------ work patterns

export async function createWorkPattern(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseWorkPattern(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.from("work_patterns").insert(parsed.value);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/work-patterns`);
  redirect(`${BASE}/work-patterns`);
}

export async function updateWorkPattern(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseWorkPattern(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.from("work_patterns").update(parsed.value).eq("id", id);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/work-patterns`);
  return { ok: true };
}

export async function deleteWorkPattern(id: string, _prev: FormState): Promise<FormState> {
  const supabase = await db();
  if ((await count("employees", "work_pattern_id", id)) > 0) return { error: "pattern_in_use" };
  const { error } = await supabase.from("work_patterns").delete().eq("id", id);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/work-patterns`);
  redirect(`${BASE}/work-patterns`);
}

// ------------------------------------------------------------------ holidays

export async function createHoliday(_prev: FormState, formData: FormData): Promise<FormState> {
  const supabase = await db();
  const parsed = parseHoliday(formData);
  if (!parsed.ok) return { error: parsed.error };
  const { error } = await supabase.from("public_holidays").insert(parsed.value);
  if (error) return { error: error.code === "23505" ? "duplicate_date" : "generic" };
  revalidatePath(`${BASE}/holidays`);
  return { ok: true };
}

export async function deleteHoliday(id: string, _prev: FormState): Promise<FormState> {
  const supabase = await db();
  const { error } = await supabase.from("public_holidays").delete().eq("id", id);
  if (error) return { error: "generic" };
  revalidatePath(`${BASE}/holidays`);
  return { ok: true };
}
