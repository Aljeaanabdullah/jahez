// Jahez — punch in / out (Phase 6). Every attempt is checked here, on the server, and recorded.
// Body: {
//   "device_identifier": string,
//   "location": { "lat": number, "lng": number, "accuracy": number },
//   "report": { "vpn": bool, "mock_location": bool, "rooted": bool,
//               "liveness": { "challenge": string, "passed": bool } },
//   "descriptor": number[128],          // computed on the phone (owner decision, Phase 6)
//   "model_version": "dlib-resnet-v1/align-v1",
//   "photo": string                     // JPEG, base64, kept for review
// }
// The server decides in/out, uses its own clock, and returns the result with a reason.
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
/** Same person if the distance to the enrolled face is at most this. */
export const FACE_MAX_DISTANCE = 0.5;
/** GPS readings less precise than this are refused. */
export const MAX_ACCURACY_M = 100;
/** PRD 4.3: 5 failed attempts in a row lock punching for 5 minutes. */
export const LOCK_AFTER = 5;
export const LOCK_MINUTES = 5;
const MAX_PHOTO_BYTES = 600 * 1024;

type Body = {
  device_identifier?: unknown;
  location?: { lat?: unknown; lng?: unknown; accuracy?: unknown };
  report?: { vpn?: unknown; mock_location?: unknown; rooted?: unknown; liveness?: { challenge?: unknown; passed?: unknown } };
  descriptor?: unknown;
  model_version?: unknown;
  photo?: unknown;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Kuwait calendar date of an instant (shift dates are refined by the rules engine in Phase 7). */
export function kuwaitDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" }).format(d);
}

function decodeJpeg(b64: unknown): Uint8Array | null {
  if (typeof b64 !== "string" || b64.length > MAX_PHOTO_BYTES * 1.4) return null;
  try {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8 ? bytes : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "not_signed_in" });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date();

  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return json(401, { error: "not_signed_in" });
  const { data: me } = await db
    .from("employees").select("id, is_active").eq("user_id", auth.user.id).maybeSingle();
  if (!me || !me.is_active) return json(403, { error: "account_disabled" });

  // Lock after 5 refused attempts in a row, for 5 minutes after the last one.
  const { data: recent } = await db
    .from("attendance_punches")
    .select("result, punched_at")
    .eq("employee_id", me.id)
    .order("punched_at", { ascending: false })
    .limit(LOCK_AFTER);
  if (recent && recent.length === LOCK_AFTER && recent.every((p) => p.result === "rejected")) {
    const unlockAt = new Date(new Date(recent[0].punched_at).getTime() + LOCK_MINUTES * 60_000);
    if (unlockAt > now) return json(429, { error: "locked", unlock_at: unlockAt.toISOString() });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_body" });
  }
  const lat = num(body.location?.lat);
  const lng = num(body.location?.lng);
  const accuracy = num(body.location?.accuracy);
  const descriptor = body.descriptor;
  const validDescriptor =
    Array.isArray(descriptor) && descriptor.length === 128 && descriptor.every((v) => num(v) !== null);
  if (lat === null || lng === null || accuracy === null || !validDescriptor || typeof body.device_identifier !== "string") {
    return json(400, { error: "invalid_body" });
  }
  const photo = decodeJpeg(body.photo);
  if (!photo) return json(400, { error: "invalid_photo" });

  // ----- checks, in order; the first failure is the recorded reason
  let reason: string | null = null;
  let siteId: string | null = null;
  let site: { name_ar: string; name_en: string } | null = null;
  let distanceM: number | null = null;
  let faceDistance: number | null = null;

  const { data: device } = await db
    .from("devices").select("id, device_identifier").eq("employee_id", me.id).maybeSingle();
  const { count: consents } = await db
    .from("consents").select("id", { count: "exact", head: true }).eq("employee_id", me.id);

  if (!consents) reason = "no_consent";
  else if (!device || device.device_identifier !== body.device_identifier) reason = "wrong_device";
  else if (body.report?.vpn === true) reason = "vpn";
  else if (body.report?.mock_location === true) reason = "mock_location";
  else if (body.report?.rooted === true) reason = "rooted";
  else if (body.report?.liveness?.passed !== true) reason = "liveness_failed";
  else if (accuracy > MAX_ACCURACY_M) reason = "weak_gps";
  else if (body.model_version !== MODEL_VERSION) reason = "wrong_model_version";

  if (!reason) {
    const { data: near } = await db.rpc("sites_near", { p_employee_id: me.id, p_lat: lat, p_lng: lng });
    const nearest = Array.isArray(near) ? near[0] : null;
    if (!nearest) reason = "no_site";
    else {
      distanceM = Math.round(nearest.distance_m);
      site = { name_ar: nearest.name_ar, name_en: nearest.name_en };
      if (nearest.distance_m > nearest.radius_m) reason = "outside_site";
      else siteId = nearest.site_id;
    }
  }

  if (!reason) {
    const { data: dist, error } = await db.rpc("face_distance", {
      p_employee_id: me.id,
      p_embedding: `[${(descriptor as number[]).join(",")}]`,
    });
    if (error || dist === null || dist === undefined) reason = "not_enrolled";
    else {
      faceDistance = Number(dist);
      if (faceDistance > FACE_MAX_DISTANCE) reason = "face_mismatch";
    }
  }

  // In or out: the opposite of the last accepted punch.
  const { data: lastAccepted } = await db
    .from("attendance_punches")
    .select("punch_type")
    .eq("employee_id", me.id)
    .eq("result", "accepted")
    .order("punched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const punchType = lastAccepted?.punch_type === "check_in" ? "check_out" : "check_in";

  // Keep the photo of every attempt for review (deleted after 3 months, Phase 12).
  const photoPath = `${me.id}/${now.getTime()}.jpg`;
  const { error: uploadError } = await db.storage
    .from("punch-photos").upload(photoPath, photo, { contentType: "image/jpeg" });

  const { error: insertError } = await db.from("attendance_punches").insert({
    employee_id: me.id,
    punch_type: punchType,
    punched_at: now.toISOString(),
    shift_date: kuwaitDate(now),
    site_id: siteId,
    latitude: lat,
    longitude: lng,
    accuracy_m: accuracy,
    device_id: device?.id ?? null,
    result: reason ? "rejected" : "accepted",
    reject_reason: reason,
    face_score: faceDistance,
    liveness_passed: body.report?.liveness?.passed === true,
    photo_path: uploadError ? null : photoPath,
    client_report: { ...(body.report ?? {}), device_identifier: body.device_identifier },
  });
  if (insertError) return json(500, { error: "save_failed" });

  return json(200, {
    result: reason ? "rejected" : "accepted",
    reason,
    punch_type: punchType,
    punched_at: now.toISOString(),
    site,
    distance_m: distanceM,
  });
});
