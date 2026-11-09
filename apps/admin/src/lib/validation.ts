// Server-side checks for the organisation forms. Pure functions, unit-tested.
// Each returns { ok: true, value } or { ok: false, error } where error is a key in i18n-org.

export type Failure = { ok: false; error: string };
export type Result<T> = { ok: true; value: T } | Failure;

const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (error: string): Failure => ({ ok: false, error });

type Input = FormData | Record<string, unknown>;

function read(input: Input, key: string): string {
  const raw = input instanceof FormData ? input.get(key) : input[key];
  return typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw).trim();
}

function readAll(input: Input, key: string): string[] {
  if (input instanceof FormData) return input.getAll(key).map(String);
  const raw = input[key];
  return Array.isArray(raw) ? raw.map(String) : raw == null ? [] : [String(raw)];
}

function names(input: Input): Result<{ name_ar: string; name_en: string }> {
  const name_ar = read(input, "name_ar");
  const name_en = read(input, "name_en");
  if (!name_ar || !name_en) return fail("name_required");
  if (name_ar.length > 100 || name_en.length > 100) return fail("name_too_long");
  return ok({ name_ar, name_en });
}

function point(input: Input, minRadius: number, maxRadius: number) {
  const latitude = Number(read(input, "latitude"));
  const longitude = Number(read(input, "longitude"));
  const radius_m = Number(read(input, "radius_m"));
  if (!read(input, "latitude") || !read(input, "longitude")) return fail("location_required");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return fail("invalid_location");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return fail("invalid_location");
  if (!Number.isInteger(radius_m) || radius_m < minRadius || radius_m > maxRadius) return fail("invalid_radius");
  return ok({ latitude, longitude, radius_m });
}

// ------------------------------------------------------------------ departments
export function parseDepartment(input: Input) {
  const n = names(input);
  if (!n.ok) return n;
  const supervisor = read(input, "supervisor_id");
  return ok({ ...n.value, supervisor_id: supervisor || null });
}

// ------------------------------------------------------------------ sites
export function parseSite(input: Input) {
  const n = names(input);
  if (!n.ok) return n;
  const p = point(input, 10, 5000);
  if (!p.ok) return p;
  return ok({ ...n.value, ...p.value });
}

// ------------------------------------------------------------------ buildings
export function parseBuilding(input: Input) {
  const n = names(input);
  if (!n.ok) return n;
  const p = point(input, 5, 1000);
  if (!p.ok) return p;
  return ok({ ...n.value, ...p.value });
}

// ------------------------------------------------------------------ work patterns
export const PATTERN_KINDS = ["morning", "afternoon", "evening", "one_on_two_off", "two_on_four_off"] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];
export const isRotation = (kind: string) => kind === "one_on_two_off" || kind === "two_on_four_off";

const minutes = (input: Input, key: string, max: number): number | null => {
  const raw = read(input, key);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
};

export function parseWorkPattern(input: Input) {
  const n = names(input);
  if (!n.ok) return n;

  const kind = read(input, "kind");
  if (!PATTERN_KINDS.includes(kind as PatternKind)) return fail("invalid_kind");

  const shift_start = read(input, "shift_start");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(shift_start)) return fail("invalid_time");

  const hours = Number(read(input, "shift_hours"));
  if (!Number.isFinite(hours) || hours <= 0 || hours > 48 || Math.round(hours * 4) !== hours * 4) {
    return fail("invalid_duration");
  }

  let cycle_work_days: number | null = null;
  let cycle_off_days: number | null = null;
  let weekly_off_days: number[] = [];
  if (isRotation(kind)) {
    cycle_work_days = Number(read(input, "cycle_work_days"));
    cycle_off_days = Number(read(input, "cycle_off_days"));
    const valid = (d: number) => Number.isInteger(d) && d >= 1 && d <= 14;
    if (!valid(cycle_work_days) || !valid(cycle_off_days)) return fail("rotation_required");
    if (hours > cycle_work_days * 24) return fail("invalid_duration");
  } else {
    weekly_off_days = readAll(input, "weekly_off_days").map(Number);
    if (weekly_off_days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return fail("invalid_weekdays");
    weekly_off_days = [...new Set(weekly_off_days)].sort();
    if (weekly_off_days.length === 7) return fail("invalid_weekdays");
  }

  const opens = minutes(input, "checkin_opens_before_min", 360);
  const grace = minutes(input, "grace_period_min", 240);
  const checkout = minutes(input, "checkout_window_after_min", 360);
  if (opens === null || grace === null || checkout === null) return fail("invalid_window");

  return ok({
    ...n.value,
    kind: kind as PatternKind,
    shift_start,
    shift_duration: `${hours * 60} minutes`,
    cycle_work_days,
    cycle_off_days,
    weekly_off_days,
    checkin_opens_before: `${opens} minutes`,
    grace_period: `${grace} minutes`,
    checkout_window_after: `${checkout} minutes`,
  });
}

// ------------------------------------------------------------------ holidays
export function parseHoliday(input: Input) {
  const n = names(input);
  if (!n.ok) return n;
  const holiday_date = read(input, "holiday_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) return fail("invalid_date");
  const d = new Date(`${holiday_date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== holiday_date) return fail("invalid_date");
  return ok({ ...n.value, holiday_date });
}

/** Postgres interval text ("08:00:00", "2 days", "1 day 12:00:00") -> minutes. */
export function intervalToMinutes(interval: string): number {
  let total = 0;
  const days = /(-?\d+)\s+days?/.exec(interval);
  if (days) total += Number(days[1]) * 24 * 60;
  const time = /(\d+):(\d{2}):(\d{2})/.exec(interval);
  if (time) total += Number(time[1]) * 60 + Number(time[2]) + Math.round(Number(time[3]) / 60);
  return total;
}

// ------------------------------------------------------------------ employees
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEmployee(input: Input) {
  const file_number = Number(read(input, "file_number"));
  if (!/^\d{6}$/.test(read(input, "file_number")) || file_number < 100000) return fail("invalid_file_number");

  const full_name_ar = read(input, "full_name_ar");
  const full_name_en = read(input, "full_name_en");
  if (!full_name_ar || !full_name_en) return fail("name_required");
  if (full_name_ar.length > 120 || full_name_en.length > 120) return fail("name_too_long");

  const rawPhone = read(input, "phone").replace(/[\s-]/g, "");
  let phone: string | null = null;
  if (rawPhone) {
    const local = rawPhone.replace(/^(\+965|00965)/, "");
    if (!/^[569]\d{7}$/.test(local)) return fail("invalid_phone");
    phone = `+965${local}`;
  }

  const department_id = read(input, "department_id") || null;
  const work_pattern_id = read(input, "work_pattern_id") || null;
  if ((department_id && !uuidRe.test(department_id)) || (work_pattern_id && !uuidRe.test(work_pattern_id))) {
    return fail("generic");
  }

  const cycle = read(input, "cycle_start_date");
  if (cycle && !/^\d{4}-\d{2}-\d{2}$/.test(cycle)) return fail("invalid_date");

  return ok({
    file_number,
    full_name_ar,
    full_name_en,
    phone,
    department_id,
    work_pattern_id,
    cycle_start_date: cycle || null,
  });
}
