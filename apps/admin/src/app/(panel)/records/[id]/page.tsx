import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { reqT } from "@/lib/i18n-req";
import { AttendanceHistory } from "@/components/attendance-history";
import { Badge, Card, Table } from "@/components/ui";

const MONTH = /^(\d{4})-(\d{2})$/;
type Named = { name_ar: string; name_en: string } | null;

/** "YYYY-MM" of now in Kuwait. */
function thisMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait", year: "numeric", month: "2-digit" }).format(new Date());
}
function shiftMonth(m: string, by: number) {
  const [, y, mo] = MONTH.exec(m)!;
  const d = new Date(Date.UTC(Number(y), Number(mo) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthRange(m: string) {
  const [, y, mo] = MONTH.exec(m)!;
  const last = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
}

// One employee's month: attendance, punches (photos for supervisor / admin only, PRD 4.4) and requests.
export default async function RecordPage({ params, searchParams }: PageProps<"/records/[id]">) {
  const me = await requireStaff();
  const { id } = await params;
  const { lang } = await getPrefs();
  const t = reqT(lang);
  const ar = lang === "ar";
  const name = (o: Named) => (o ? (ar ? o.name_ar : o.name_en) : "—");
  const current = thisMonth();
  const asked = String((await searchParams).month ?? "");
  const month = MONTH.test(asked) && asked <= current ? asked : current;
  const { from, to } = monthRange(month);
  const supabase = await createClient();

  const { data: emp } = await supabase
    .from("employees")
    .select("id, file_number, full_name_ar, full_name_en, work_pattern_id, departments!employees_department_id_fkey(name_ar, name_en)")
    .eq("id", id)
    .maybeSingle();
  if (!emp) notFound();

  const startUtc = new Date(`${from}T00:00:00+03:00`).toISOString();
  const endUtc = new Date(new Date(`${to}T00:00:00+03:00`).getTime() + 86_400_000).toISOString();
  const [{ data: punches }, { data: requests }] = await Promise.all([
    supabase
      .from("attendance_punches")
      .select("id, punch_type, punched_at, result, reject_reason, photo_path, source, client_report, sites(name_ar, name_en)")
      .eq("employee_id", id)
      .gte("punched_at", startUtc)
      .lt("punched_at", endUtc)
      .order("punched_at", { ascending: false }),
    supabase
      .from("requests")
      .select("id, request_type, status, shift_date, corrected_punch_type, corrected_time, sites(name_ar, name_en)")
      .eq("employee_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const canSeePhotos = me.role === "supervisor" || me.role === "admin";
  const paths = canSeePhotos ? (punches ?? []).map((p) => p.photo_path).filter((p): p is string => !!p) : [];
  const { data: signed } = paths.length
    ? await supabase.storage.from("punch-photos").createSignedUrls(paths, 300)
    : { data: [] };
  const urlOf = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const locale = ar ? "ar-KW" : "en-GB";
  const monthName = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" });
  const day = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuwait" });
  const dept = emp.departments as unknown as Named;
  const navClass = "rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-primary-soft";

  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <Link href="/records" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {t.back}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{ar ? emp.full_name_ar : emp.full_name_en}</h1>
        <span className="text-muted" dir="ltr">
          {emp.file_number}
        </span>
        {dept && <Badge tone="ok">{name(dept)}</Badge>}
      </div>

      <div className="flex items-center gap-2" data-testid="month-nav">
        <Link href={`/records/${id}?month=${shiftMonth(month, -1)}`} className={navClass}>
          {t.prevMonth}
        </Link>
        {month < current && (
          <Link href={`/records/${id}?month=${shiftMonth(month, 1)}`} className={navClass}>
            {t.nextMonth}
          </Link>
        )}
      </div>

      <AttendanceHistory
        employeeId={id}
        lang={lang}
        hasPattern={!!emp.work_pattern_id}
        from={from}
        to={to}
        title={t.monthTitle(monthName)}
      />

      <Card>
        <h2 className="mb-1 font-bold">{t.punchesTitle}</h2>
        {!canSeePhotos && <p className="mb-3 text-sm text-muted">{t.photosHidden}</p>}
        {(punches ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t.punchesNone}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>{t.time}</th>
                <th>{t.type}</th>
                <th>{t.result}</th>
                <th>{t.site}</th>
                {canSeePhotos && <th>{t.photo}</th>}
              </tr>
            </thead>
            <tbody data-testid="punch-rows">
              {(punches ?? []).map((p) => {
                const url = p.photo_path ? urlOf.get(p.photo_path) : undefined;
                const mission = (p.client_report as { by_mission?: boolean } | null)?.by_mission;
                return (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{dateTime.format(new Date(p.punched_at))}</td>
                    <td>
                      {t.punchTypes[p.punch_type as "check_in" | "check_out"]}
                      {p.source === "correction" && <span className="block text-xs text-primary">{t.corrected}</span>}
                    </td>
                    <td className={p.result === "accepted" ? "" : "text-danger"}>
                      {p.result === "accepted" ? t.accepted : t.rejected}
                      {p.reject_reason && (
                        <span className="block text-xs" dir="ltr">
                          {p.reject_reason}
                        </span>
                      )}
                    </td>
                    <td>
                      {p.sites ? name(p.sites as unknown as Named) : "—"}
                      {mission && <span className="block text-xs text-muted">{t.byMission}</span>}
                    </td>
                    {canSeePhotos && (
                      <td>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                            <img src={url} alt={t.photo} className="size-14 rounded object-cover" />
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">{t.requestsTitle}</h2>
        {(requests ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t.requestsNone}</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>{t.type}</th>
                <th>{t.shiftDay}</th>
                <th>{t.correctedTo}</th>
                <th>{t.status}</th>
              </tr>
            </thead>
            <tbody data-testid="request-rows">
              {(requests ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{t.types[r.request_type as keyof typeof t.types]}</td>
                  <td className="whitespace-nowrap">{day.format(new Date(`${r.shift_date}T00:00:00Z`))}</td>
                  <td>
                    {r.request_type === "punch_correction"
                      ? `${t.punchTypes[r.corrected_punch_type as "check_in" | "check_out"]} — ${time.format(new Date(r.corrected_time!))}`
                      : name(r.sites as unknown as Named)}
                  </td>
                  <td>{t.statuses[r.status as keyof typeof t.statuses]}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
