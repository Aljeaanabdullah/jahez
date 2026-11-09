// Jahez — change the signed-in user's password and clear "must change password".
// Called by the web panel and the mobile app. Body: { "new_password": "..." }
// Rules (PRD, owner decision): at least 8 characters, with letters and digits,
// and not the user's own file number.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

export function passwordProblem(password: unknown, fileNumber?: number): string | null {
  if (typeof password !== "string") return "missing_password";
  if (password.length < 8) return "too_short";
  if (password.length > 72) return "too_long";
  if (!/\p{L}/u.test(password)) return "needs_letter";
  if (!/\p{Nd}/u.test(password)) return "needs_digit";
  if (fileNumber !== undefined && password.includes(String(fileNumber))) return "contains_file_number";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "not_signed_in" });
  const user = userData.user;

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, file_number, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (employeeError) return json(500, { error: "lookup_failed" });
  if (!employee || !employee.is_active) return json(403, { error: "account_disabled" });

  let body: { new_password?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const problem = passwordProblem(body.new_password, employee.file_number);
  if (problem) return json(400, { error: problem });

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: body.new_password as string,
  });
  if (updateError) {
    const weak = /weak|pwned|leaked/i.test(updateError.message);
    return json(400, { error: weak ? "password_rejected" : "update_failed" });
  }

  const { error: flagError } = await admin
    .from("employees")
    .update({ must_change_password: false })
    .eq("id", employee.id);
  if (flagError) return json(500, { error: "update_failed" });

  return json(200, { ok: true });
});
