import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service client that bypasses RLS. Server-only, and only after requireAdmin():
 * used for things the database cannot do from the admin's own session
 * (creating log-ins, setting passwords, deleting storage files, writing the audit log).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
