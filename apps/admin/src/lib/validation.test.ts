import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";
import {
  intervalToMinutes,
  parseEmployee,
  parseBuilding,
  parseDepartment,
  parseHoliday,
  parseSite,
  parseWorkPattern,
} from "./validation";

const names = { name_ar: "اختبار", name_en: "Test" };

describe("departments", () => {
  it("needs both names", () => {
    expect(parseDepartment({ name_ar: "قسم" })).toEqual({ ok: false, error: "name_required" });
    expect(parseDepartment(names)).toEqual({ ok: true, value: { ...names, supervisor_id: null } });
  });
});

describe("sites and buildings", () => {
  const site = { ...names, latitude: "29.379", longitude: "47.989", radius_m: "200" };

  it("accepts a valid site", () => {
    expect(parseSite(site)).toEqual({
      ok: true,
      value: { ...names, latitude: 29.379, longitude: 47.989, radius_m: 200 },
    });
  });

  it("refuses a missing or impossible location", () => {
    expect(parseSite({ ...site, latitude: "" })).toEqual({ ok: false, error: "location_required" });
    expect(parseSite({ ...site, latitude: "95" })).toEqual({ ok: false, error: "invalid_location" });
    expect(parseSite({ ...site, longitude: "abc" })).toEqual({ ok: false, error: "invalid_location" });
  });

  it("keeps the radius in a sensible range", () => {
    expect(parseSite({ ...site, radius_m: "5" })).toEqual({ ok: false, error: "invalid_radius" });
    expect(parseSite({ ...site, radius_m: "-200" })).toEqual({ ok: false, error: "invalid_radius" });
    expect(parseSite({ ...site, radius_m: "200.5" })).toEqual({ ok: false, error: "invalid_radius" });
    expect(parseBuilding({ ...site, radius_m: "5" }).ok).toBe(true);
    expect(parseBuilding({ ...site, radius_m: "2000" })).toEqual({ ok: false, error: "invalid_radius" });
  });
});

describe("work patterns", () => {
  const morning = {
    ...names,
    kind: "morning",
    shift_start: "07:00",
    shift_hours: "8",
    weekly_off_days: ["5", "6"],
    checkin_opens_before_min: "60",
    grace_period_min: "60",
    checkout_window_after_min: "60",
  };

  it("accepts a fixed morning shift", () => {
    const r = parseWorkPattern(morning);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.shift_duration).toBe("480 minutes");
      expect(r.value.weekly_off_days).toEqual([5, 6]);
      expect(r.value.cycle_work_days).toBeNull();
    }
  });

  it("accepts an evening shift that crosses midnight", () => {
    expect(parseWorkPattern({ ...morning, kind: "evening", shift_start: "22:00" }).ok).toBe(true);
  });

  it("refuses a shift with no duration or a bad time", () => {
    expect(parseWorkPattern({ ...morning, shift_hours: "0" })).toEqual({ ok: false, error: "invalid_duration" });
    expect(parseWorkPattern({ ...morning, shift_hours: "" })).toEqual({ ok: false, error: "invalid_duration" });
    expect(parseWorkPattern({ ...morning, shift_hours: "49" })).toEqual({ ok: false, error: "invalid_duration" });
    expect(parseWorkPattern({ ...morning, shift_start: "25:00" })).toEqual({ ok: false, error: "invalid_time" });
  });

  it("rotation patterns need work and rest days, and allow 48-hour shifts", () => {
    const twoOnFour = { ...morning, kind: "two_on_four_off", shift_hours: "48", cycle_work_days: "2", cycle_off_days: "4" };
    const r = parseWorkPattern(twoOnFour);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.weekly_off_days).toEqual([]);
    expect(parseWorkPattern({ ...twoOnFour, cycle_off_days: "" })).toEqual({ ok: false, error: "rotation_required" });
    expect(parseWorkPattern({ ...twoOnFour, cycle_work_days: "1" })).toEqual({ ok: false, error: "invalid_duration" });
  });

  it("refuses every day off and unknown kinds", () => {
    expect(parseWorkPattern({ ...morning, weekly_off_days: ["1", "2", "3", "4", "5", "6", "7"] })).toEqual({
      ok: false,
      error: "invalid_weekdays",
    });
    expect(parseWorkPattern({ ...morning, kind: "night" })).toEqual({ ok: false, error: "invalid_kind" });
    expect(parseWorkPattern({ ...morning, grace_period_min: "-5" })).toEqual({ ok: false, error: "invalid_window" });
  });
});

describe("holidays", () => {
  it("needs a real date", () => {
    expect(parseHoliday({ ...names, holiday_date: "2027-02-25" }).ok).toBe(true);
    expect(parseHoliday({ ...names, holiday_date: "2027-02-30" })).toEqual({ ok: false, error: "invalid_date" });
    expect(parseHoliday({ ...names, holiday_date: "" })).toEqual({ ok: false, error: "invalid_date" });
  });
});

describe("intervalToMinutes", () => {
  it("reads Postgres intervals", () => {
    expect(intervalToMinutes("08:00:00")).toBe(480);
    expect(intervalToMinutes("2 days")).toBe(2880);
    expect(intervalToMinutes("1 day 12:30:00")).toBe(2190);
    expect(intervalToMinutes("00:00:00")).toBe(0);
  });
});

describe("employees", () => {
  const emp = { file_number: "710500", full_name_ar: "اسم", full_name_en: "Name", phone: "" };

  it("accepts a 6-digit file number and normalises Kuwaiti phone numbers", () => {
    const r = parseEmployee({ ...emp, phone: "9988 7766" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.phone).toBe("+96599887766");
    const r2 = parseEmployee({ ...emp, phone: "+96551234567" });
    if (r2.ok) expect(r2.value.phone).toBe("+96551234567");
  });

  it("refuses bad file numbers and phones", () => {
    expect(parseEmployee({ ...emp, file_number: "71050" })).toEqual({ ok: false, error: "invalid_file_number" });
    expect(parseEmployee({ ...emp, file_number: "71050a" })).toEqual({ ok: false, error: "invalid_file_number" });
    expect(parseEmployee({ ...emp, phone: "12345678" })).toEqual({ ok: false, error: "invalid_phone" });
    expect(parseEmployee({ ...emp, full_name_en: "" })).toEqual({ ok: false, error: "name_required" });
  });
});

describe("password rules", () => {
  it("match the server rules", () => {
    expect(passwordProblem("abc12", 710500)).toBe("too_short");
    expect(passwordProblem("abcdefgh", 710500)).toBe("needs_digit");
    expect(passwordProblem("12345678", 710500)).toBe("needs_letter");
    expect(passwordProblem("ab710500c", 710500)).toBe("contains_file_number");
    expect(passwordProblem("Kuwait2026", 710500)).toBeNull();
    expect(passwordProblem("كلمة2026سر", 710500)).toBeNull();
  });
});
