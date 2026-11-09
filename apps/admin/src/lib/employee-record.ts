import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lang } from "./i18n";

// The full record of one employee, exported (Excel + PDF) before end of service.
// Attendance totals (late / absent) are added once the rules engine exists (Phase 7).

export type EmployeeRecord = {
  employee: {
    file_number: number;
    full_name_ar: string;
    full_name_en: string;
    phone: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    department: string;
    work_pattern: string;
    sites: string;
    device: string;
  };
  punches: { date: string; time: string; type: string; site: string; result: string; reason: string }[];
  requests: { created: string; type: string; date: string; status: string; reason: string }[];
  exportedAt: string;
};

const labels = {
  ar: {
    title: "سجل الموظف",
    exportedAt: "تاريخ التصدير",
    info: "البيانات",
    punches: "سجل التبصيم",
    requests: "الطلبات",
    none: "لا يوجد",
    fields: {
      file_number: "رقم الملف",
      full_name_ar: "الاسم بالعربي",
      full_name_en: "الاسم بالإنجليزي",
      phone: "الجوال",
      role: "الدور",
      is_active: "الحالة",
      created_at: "تاريخ الإضافة",
      department: "القسم",
      work_pattern: "نمط العمل",
      sites: "المواقع المسموحة",
      device: "الجوال المرتبط",
    },
    punchCols: { date: "التاريخ", time: "الوقت", type: "النوع", site: "الموقع", result: "النتيجة", reason: "سبب الرفض" },
    requestCols: { created: "تاريخ الطلب", type: "النوع", date: "يوم الوردية", status: "الحالة", reason: "السبب" },
    values: {
      check_in: "دخول",
      check_out: "خروج",
      accepted: "مقبولة",
      rejected: "مرفوضة",
      punch_correction: "تصحيح بصمة",
      external_mission: "مهمة خارجية",
      pending_supervisor: "بانتظار المشرف",
      pending_hr: "بانتظار الموارد البشرية",
      approved: "مقبول",
      cancelled: "ملغى",
      employee: "موظف",
      supervisor: "مشرف",
      hr: "موارد بشرية",
      admin: "مدير النظام",
      active: "يعمل",
      suspended: "موقوف",
    } as Record<string, string>,
  },
  en: {
    title: "Employee record",
    exportedAt: "Exported on",
    info: "Details",
    punches: "Punches",
    requests: "Requests",
    none: "None",
    fields: {
      file_number: "File number",
      full_name_ar: "Name in Arabic",
      full_name_en: "Name in English",
      phone: "Mobile",
      role: "Role",
      is_active: "Status",
      created_at: "Added on",
      department: "Department",
      work_pattern: "Work pattern",
      sites: "Allowed sites",
      device: "Bound phone",
    },
    punchCols: { date: "Date", time: "Time", type: "Type", site: "Site", result: "Result", reason: "Refusal reason" },
    requestCols: { created: "Requested on", type: "Type", date: "Shift day", status: "Status", reason: "Reason" },
    values: {
      check_in: "In",
      check_out: "Out",
      accepted: "Accepted",
      rejected: "Refused",
      punch_correction: "Punch correction",
      external_mission: "External mission",
      pending_supervisor: "Waiting for supervisor",
      pending_hr: "Waiting for HR",
      approved: "Approved",
      cancelled: "Cancelled",
      employee: "Employee",
      supervisor: "Supervisor",
      hr: "HR",
      admin: "System admin",
      active: "Active",
      suspended: "Suspended",
    } as Record<string, string>,
  },
};

export const recordLabels = (lang: Lang) => labels[lang];

type Named = { name_ar: string; name_en: string } | null;

export async function loadEmployeeRecord(supabase: SupabaseClient, id: string, lang: Lang): Promise<EmployeeRecord | null> {
  const L = labels[lang];
  const pick = (n: Named) => (n ? (lang === "ar" ? n.name_ar : n.name_en) : "—");
  const v = (key: string) => L.values[key] ?? key;
  const tz = "Asia/Kuwait";
  const fmtDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const { data: emp } = await supabase
    .from("employees")
    .select(
      "id, file_number, full_name_ar, full_name_en, phone, role, is_active, created_at, department:departments!employees_department_id_fkey(name_ar, name_en), pattern:work_patterns(name_ar, name_en), employee_sites(site:sites(name_ar, name_en)), device:devices(platform, model, bound_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!emp) return null;

  const e = emp as unknown as {
    file_number: number;
    full_name_ar: string;
    full_name_en: string;
    phone: string | null;
    role: string;
    is_active: boolean;
    created_at: string;
    department: Named;
    pattern: Named;
    employee_sites: { site: Named }[];
    device: { platform: string; model: string | null; bound_at: string } | null;
  };

  const { data: punches } = await supabase
    .from("attendance_punches")
    .select("punched_at, punch_type, result, reject_reason, site:sites(name_ar, name_en)")
    .eq("employee_id", id)
    .order("punched_at")
    .range(0, 9999);

  const { data: requests } = await supabase
    .from("requests")
    .select("created_at, request_type, shift_date, status, reason")
    .eq("employee_id", id)
    .order("created_at")
    .range(0, 9999);

  return {
    employee: {
      file_number: e.file_number,
      full_name_ar: e.full_name_ar,
      full_name_en: e.full_name_en,
      phone: e.phone,
      role: v(e.role),
      is_active: e.is_active,
      created_at: fmtDate(e.created_at),
      department: pick(e.department),
      work_pattern: pick(e.pattern),
      sites: e.employee_sites.map((s) => pick(s.site)).join("، ") || L.none,
      device: e.device ? `${e.device.model ?? e.device.platform} (${fmtDate(e.device.bound_at)})` : L.none,
    },
    punches: ((punches ?? []) as unknown as { punched_at: string; punch_type: string; result: string; reject_reason: string | null; site: Named }[]).map((p) => ({
      date: fmtDate(p.punched_at),
      time: fmtTime(p.punched_at),
      type: v(p.punch_type),
      site: pick(p.site),
      result: v(p.result),
      reason: p.reject_reason ?? "",
    })),
    requests: (requests ?? []).map((r) => ({
      created: fmtDate(r.created_at),
      type: v(r.request_type),
      date: r.shift_date,
      status: v(r.status),
      reason: r.reason,
    })),
    exportedAt: `${fmtDate(new Date().toISOString())} ${fmtTime(new Date().toISOString())}`,
  };
}

/** Rows of [label, value] for the details block. */
export function detailRows(record: EmployeeRecord, lang: Lang): [string, string][] {
  const L = labels[lang];
  const e = record.employee;
  return [
    [L.fields.file_number, String(e.file_number)],
    [L.fields.full_name_ar, e.full_name_ar],
    [L.fields.full_name_en, e.full_name_en],
    [L.fields.phone, e.phone ?? L.none],
    [L.fields.role, e.role],
    [L.fields.is_active, e.is_active ? L.values.active : L.values.suspended],
    [L.fields.created_at, e.created_at],
    [L.fields.department, e.department],
    [L.fields.work_pattern, e.work_pattern],
    [L.fields.sites, e.sites],
    [L.fields.device, e.device],
  ];
}
