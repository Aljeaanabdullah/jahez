import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { reqT } from "@/lib/i18n-req";
import { Badge, Card } from "@/components/ui";
import { decideRequest } from "./actions";
import { DecisionForm } from "./decision-form";

type InboxRow = {
  id: string;
  request_type: "punch_correction" | "external_mission";
  status: "pending_supervisor" | "pending_hr";
  shift_date: string;
  corrected_punch_type: "check_in" | "check_out" | null;
  corrected_time: string | null;
  reason: string;
  created_at: string;
  employee_id: string;
  file_number: number;
  full_name_ar: string;
  full_name_en: string;
  department_ar: string | null;
  department_en: string | null;
  site_ar: string | null;
  site_en: string | null;
};

// Requests the signed-in supervisor / HR / admin can decide now (Phase 8).
export default async function ApprovalsPage() {
  await requireStaff();
  const { lang } = await getPrefs();
  const t = reqT(lang);
  const supabase = await createClient();
  const { data } = await supabase.rpc("approval_inbox");
  const rows = (data ?? []) as InboxRow[];
  const locale = lang === "ar" ? "ar-KW" : "en-GB";
  const day = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" });
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kuwait" });
  const ar = lang === "ar";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{t.approvalsTitle}</h1>
        <p className="text-sm text-muted">{t.approvalsHint}</p>
      </div>
      {rows.length === 0 && <p className="text-muted" data-testid="inbox-empty">{t.inboxEmpty}</p>}
      {rows.map((r) => (
        <Card key={r.id}>
          <div data-testid="inbox-item" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-bold">{t.types[r.request_type]}</h2>
              <Badge tone="ok">{t.statuses[r.status]}</Badge>
            </div>
            <p>
              <Link href={`/records/${r.employee_id}`} className="font-medium text-primary hover:underline">
                {ar ? r.full_name_ar : r.full_name_en}
              </Link>{" "}
              · <span dir="ltr">{r.file_number}</span>
              {(r.department_ar || r.department_en) && (
                <span className="text-muted"> · {ar ? r.department_ar : r.department_en}</span>
              )}
            </p>
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">{t.shiftDay}</dt>
              <dd>{day.format(new Date(`${r.shift_date}T00:00:00Z`))}</dd>
              {r.request_type === "punch_correction" ? (
                <>
                  <dt className="text-muted">{t.correctedTo}</dt>
                  <dd>
                    {t.punchTypes[r.corrected_punch_type!]} — {time.format(new Date(r.corrected_time!))}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="text-muted">{t.missionSite}</dt>
                  <dd>{ar ? r.site_ar : r.site_en}</dd>
                </>
              )}
              <dt className="text-muted">{t.reason}</dt>
              <dd className="whitespace-pre-wrap">{r.reason}</dd>
              <dt className="text-muted">{t.submittedAt}</dt>
              <dd>{dateTime.format(new Date(r.created_at))}</dd>
            </dl>
            <DecisionForm
              action={decideRequest.bind(null, r.id)}
              labels={{ note: t.note, approve: t.approve, reject: t.reject, decided: t.decided }}
              errors={t.errors}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}
