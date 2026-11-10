import type { Lang } from "./i18n";

// Texts for the attendance record (Phase 7).
const ar = {
  title: "سجل الحضور — آخر 31 يوماً",
  hint: "يُحسب حسب نمط الدوام. الغياب ونسيان الانصراف يُسجَّلان تلقائياً كل 10 دقائق.",
  day: "اليوم",
  shift: "الوردية",
  checkIn: "الحضور",
  checkOut: "الانصراف",
  status: "الحالة",
  noPattern: "لا يوجد نمط دوام لهذا الموظف.",
  kinds: { off: "راحة", holiday: "عطلة رسمية", continued: "ضمن الوردية السابقة", before_hire: "قبل إضافة الموظف" },
  arrival: { pending: "لم يحضر بعد", on_time: "في الوقت", late: "متأخر", absent: "غائب" },
  departure: { pending: "", done: "", missing: "لم يسجّل الانصراف", not_applicable: "" },
  lateBy: (m: number) => `متأخر ${m} دقيقة`,
  earlyBy: (m: number) => `خرج قبل النهاية بـ ${m} دقيقة`,
  totals: (late: number, absent: number, missing: number) =>
    `تأخير: ${late} · غياب: ${absent} · بدون انصراف: ${missing}`,
};

const en: typeof ar = {
  title: "Attendance — last 31 days",
  hint: "Computed from the work pattern. Absences and missing check-outs are recorded automatically every 10 minutes.",
  day: "Day",
  shift: "Shift",
  checkIn: "Check-in",
  checkOut: "Check-out",
  status: "Status",
  noPattern: "This employee has no work pattern.",
  kinds: { off: "Day off", holiday: "Public holiday", continued: "Part of the previous shift", before_hire: "Before the employee was added" },
  arrival: { pending: "Not in yet", on_time: "On time", late: "Late", absent: "Absent" },
  departure: { pending: "", done: "", missing: "No check-out", not_applicable: "" },
  lateBy: (m: number) => `Late by ${m} min`,
  earlyBy: (m: number) => `Left ${m} min early`,
  totals: (late: number, absent: number, missing: number) =>
    `Late: ${late} · Absent: ${absent} · No check-out: ${missing}`,
};

export const attText = { ar, en };
export type AttText = typeof ar;
export const attT = (lang: Lang) => attText[lang];
