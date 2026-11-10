import type { Lang } from "@/lib/i18n";
import { attT } from "@/lib/i18n-att";
import { createClient } from "@/lib/supabase/server";
import { Card, Table } from "@/components/ui";

type Row = {
  day: string;
  kind: "work" | "continued" | "holiday" | "off" | "before_hire";
  shift_start: string | null;
  shift_end: string | null;
  arrival: "pending" | "on_time" | "late" | "absent" | null;
  departure: "pending" | "done" | "missing" | "not_applicable" | null;
  check_in_at: string | null;
  check_out_at: string | null;
  late_minutes: number;
  early_leave_minutes: number;
};

/** Kuwait calendar date, `days` days before today. */
function kuwaitDay(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" }).format(d);
}

/** Last 31 days of an employee's attendance, newest first (rules engine, Phase 7). */
export async function AttendanceHistory({ employeeId, lang, hasPattern }: { employeeId: string; lang: Lang; hasPattern: boolean }) {
  const t = attT(lang);
  if (!hasPattern) {
    return (
      <Card>
        <h2 className="mb-2 font-bold">{t.title}</h2>
        <p className="text-sm text-muted">{t.noPattern}</p>
      </Card>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("attendance_history", {
    p_employee: employeeId,
    p_from: kuwaitDay(30),
    p_to: kuwaitDay(0),
  });
  const rows = ((data ?? []) as Row[]).slice().reverse();
  const locale = lang === "ar" ? "ar-KW" : "en-GB";
  const dayFmt = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuwait" });
  const time = (s: string | null) => (s ? timeFmt.format(new Date(s)) : "—");
  const late = rows.filter((r) => r.arrival === "late").length;
  const absent = rows.filter((r) => r.arrival === "absent").length;
  const missing = rows.filter((r) => r.departure === "missing").length;

  return (
    <Card>
      <h2 className="mb-1 font-bold">{t.title}</h2>
      <p className="mb-2 text-sm text-muted">{t.hint}</p>
      <p className="mb-4 text-sm font-medium" data-testid="attendance-totals">
        {t.totals(late, absent, missing)}
      </p>
      <Table>
        <thead>
          <tr>
            <th>{t.day}</th>
            <th>{t.shift}</th>
            <th>{t.checkIn}</th>
            <th>{t.checkOut}</th>
            <th>{t.status}</th>
          </tr>
        </thead>
        <tbody data-testid="attendance-rows">
          {rows.map((r) => {
            const notes: { text: string; bad?: boolean }[] = [];
            if (r.kind !== "work") notes.push({ text: t.kinds[r.kind] });
            else if (r.arrival === "late") notes.push({ text: t.lateBy(r.late_minutes), bad: true });
            else if (r.arrival) notes.push({ text: t.arrival[r.arrival], bad: r.arrival === "absent" });
            if (r.departure === "missing") notes.push({ text: t.departure.missing, bad: true });
            if (r.early_leave_minutes > 0) notes.push({ text: t.earlyBy(r.early_leave_minutes) });
            return (
              <tr key={r.day} className={r.kind === "work" ? "" : "text-muted"}>
                <td className="whitespace-nowrap">{dayFmt.format(new Date(`${r.day}T00:00:00Z`))}</td>
                <td className="whitespace-nowrap">{r.shift_start ? `${time(r.shift_start)} – ${time(r.shift_end)}` : "—"}</td>
                <td>{time(r.check_in_at)}</td>
                <td>{time(r.check_out_at)}</td>
                <td>
                  {notes.map((n, i) => (
                    <span key={i} className={`block ${n.bad ? "text-danger" : ""}`}>
                      {n.text}
                    </span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
