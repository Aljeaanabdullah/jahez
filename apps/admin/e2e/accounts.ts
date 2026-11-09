import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import path from "node:path";

const envFile = path.resolve(__dirname, "../.env.local");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const E2E_ACCOUNTS = {
  admin: 799901,
  supervisor: 799902,
  employee: 799903,
} as const;

export type E2ERole = keyof typeof E2E_ACCOUNTS;

export const authFile = (role: E2ERole) => path.resolve(__dirname, `.auth/${role}.json`);

/** Service client (bypasses RLS) used only to create and remove test accounts. */
export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set in apps/admin/.env.local");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const emailFor = (fileNumber: number) => `${fileNumber}@jahez.local`;

/** Removes the e2e accounts and everything the tests created ("E2E …" names). */
export async function cleanUp() {
  const db = serviceClient();
  // Fixed test accounts plus employees created by the tests (799950–799999).
  const numbers: number[] = [...Object.values(E2E_ACCOUNTS)];
  for (let n = 799950; n <= 799999; n++) numbers.push(n);
  const { data: rows } = await db.from("employees").select("id, user_id").in("file_number", numbers);
  for (const row of rows ?? []) {
    await db.from("employees").delete().eq("id", row.id);
    if (row.user_id) await db.auth.admin.deleteUser(row.user_id);
  }
  // Logins left behind without an employee row.
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of users?.users ?? []) {
    if (numbers.some((n) => u.email === emailFor(n))) await db.auth.admin.deleteUser(u.id);
  }
  const { data: e2eSites } = await db.from("sites").select("id").like("name_en", "E2E%");
  const siteIds = (e2eSites ?? []).map((s) => s.id);
  if (siteIds.length) {
    await db.from("buildings").delete().in("site_id", siteIds);
    await db.from("sites").delete().in("id", siteIds);
  }
  await db.from("departments").delete().like("name_en", "E2E%");
  await db.from("work_patterns").delete().like("name_en", "E2E%");
  await db.from("public_holidays").delete().like("name_en", "E2E%");
}
