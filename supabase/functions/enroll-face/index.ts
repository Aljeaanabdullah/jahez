// Jahez — enroll (or re-enroll) an employee's face. Called by HR from the web panel and the app.
// Body: {
//   "employee_id": uuid,
//   "source": "web" | "mobile",
//   "model_version": "dlib-resnet-v1/align-v1",
//   "descriptors": number[3][128],   // one per photo, computed on the device
//   "photos": string[3]              // JPEG, base64
// }
// Rules: caller is HR; the employee is active and has given consent in the app;
// the three photos are the same person; the face is not already enrolled for someone else.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const MODEL_VERSION = "dlib-resnet-v1/align-v1";
const PHOTOS = 3;
/** Photos of one person: every pair closer than this. */
export const SAME_PERSON_MAX = 0.45;
/** Another employee's face closer than this is treated as the same person. */
export const DUPLICATE_MAX = 0.4;
const MAX_PHOTO_BYTES = 600 * 1024;

const distance = (p: number[], q: number[]) => Math.sqrt(p.reduce((s, v, i) => s + (v - q[i]) ** 2, 0));

export function checkDescriptors(descriptors: unknown): string | null {
  if (!Array.isArray(descriptors) || descriptors.length !== PHOTOS) return "invalid_descriptors";
  for (const d of descriptors) {
    if (!Array.isArray(d) || d.length !== 128 || !d.every((v) => typeof v === "number" && Number.isFinite(v))) {
      return "invalid_descriptors";
    }
  }
  const ds = descriptors as number[][];
  for (let i = 0; i < ds.length; i++) {
    for (let j = i + 1; j < ds.length; j++) {
      if (distance(ds[i], ds[j]) > SAME_PERSON_MAX) return "photos_not_same_person";
    }
  }
  return null;
}

export function mean(ds: number[][]): number[] {
  return ds[0].map((_, i) => ds.reduce((s, d) => s + d[i], 0) / ds.length);
}

function decodeJpeg(b64: unknown): Uint8Array | null {
  if (typeof b64 !== "string" || b64.length > MAX_PHOTO_BYTES * 1.4) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const isJpeg = bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    return isJpeg && bytes.length <= MAX_PHOTO_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json(401, { error: "not_signed_in" });
  const { data: caller } = await admin
    .from("employees").select("id, role, is_active").eq("user_id", auth.user.id).maybeSingle();
  if (!caller || !caller.is_active || caller.role !== "hr") return json(403, { error: "hr_only" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const employeeId = String(body.employee_id ?? "");
  if (body.source !== "web" && body.source !== "mobile") return json(400, { error: "invalid_source" });
  if (body.model_version !== MODEL_VERSION) return json(400, { error: "wrong_model_version" });

  const { data: target } = await admin
    .from("employees").select("id, file_number, is_active").eq("id", employeeId).maybeSingle();
  if (!target) return json(404, { error: "not_found" });
  if (!target.is_active) return json(400, { error: "employee_suspended" });

  const { count: consents } = await admin
    .from("consents").select("id", { count: "exact", head: true }).eq("employee_id", employeeId);
  if (!consents) return json(400, { error: "no_consent" });

  const problem = checkDescriptors(body.descriptors);
  if (problem) return json(400, { error: problem });
  const photos = Array.isArray(body.photos) ? body.photos.map(decodeJpeg) : [];
  if (photos.length !== PHOTOS || photos.some((p) => !p)) return json(400, { error: "invalid_photos" });

  const embedding = mean(body.descriptors as number[][]);
  const vector = `[${embedding.join(",")}]`;

  const { data: nearest } = await admin.rpc("nearest_other_face", { p_embedding: vector, p_employee_id: employeeId });
  const other = Array.isArray(nearest) ? nearest[0] : null;
  if (other && other.distance < DUPLICATE_MAX) {
    return json(409, { error: "face_already_enrolled", file_number: other.file_number });
  }

  // Upload the new photos, then point the template at them, then remove the old photos.
  const stamp = Date.now();
  const paths = photos.map((_, i) => `${employeeId}/${stamp}-${i + 1}.jpg`);
  for (let i = 0; i < PHOTOS; i++) {
    const { error } = await admin.storage
      .from("face-enrollment-photos")
      .upload(paths[i], photos[i]!, { contentType: "image/jpeg", upsert: false });
    if (error) {
      await admin.storage.from("face-enrollment-photos").remove(paths.slice(0, i));
      return json(500, { error: "upload_failed" });
    }
  }

  const { data: previous } = await admin
    .from("face_templates").select("photo_paths").eq("employee_id", employeeId).maybeSingle();

  const { error: saveError } = await admin.from("face_templates").upsert(
    {
      employee_id: employeeId,
      embedding: vector,
      model_version: MODEL_VERSION,
      source: body.source,
      enrolled_by: caller.id,
      enrolled_at: new Date().toISOString(),
      photo_paths: paths,
    },
    { onConflict: "employee_id" },
  );
  if (saveError) {
    await admin.storage.from("face-enrollment-photos").remove(paths);
    return json(500, { error: "save_failed" });
  }
  if (previous?.photo_paths?.length) {
    await admin.storage.from("face-enrollment-photos").remove(previous.photo_paths);
  }

  return json(200, { ok: true, file_number: target.file_number });
});
