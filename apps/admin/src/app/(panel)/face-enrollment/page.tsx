import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { faceT } from "@/lib/i18n-face";
import { Alert, Badge, buttonClass, Card, Input } from "@/components/ui";
import { EnrollCapture } from "./enroll-capture";
import { EnrolledFaces } from "./enrolled-faces";

// HR: find an employee and enroll their face. Admin: review enrollment photos.
export default async function FaceEnrollmentPage({ searchParams }: PageProps<"/face-enrollment">) {
  const me = await requireStaff();
  if (me.role !== "hr" && me.role !== "admin") redirect("/");
  const { lang } = await getPrefs();
  const t = faceT(lang);

  if (me.role === "admin") {
    const page = Math.max(1, Number((await searchParams).page) || 1);
    return <EnrolledFaces lang={lang} page={page} />;
  }

  const file = String((await searchParams).file ?? "").trim();
  const supabase = await createClient();
  const { data: emp } = /^\d{6}$/.test(file)
    ? await supabase
        .from("employees")
        .select("id, file_number, full_name_ar, full_name_en, is_active, user_id")
        .eq("file_number", Number(file))
        .maybeSingle()
    : { data: null };
  const { data: status } = emp
    ? await supabase.rpc("face_enrollment_status", { p_employee_id: emp.id })
    : { data: null };
  const s = status?.[0];
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Kuwait" });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <form className="flex gap-2" role="search">
        <Input
          name="file"
          defaultValue={file}
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder={t.search}
          aria-label={t.search}
          dir="ltr"
          className="max-w-48"
        />
        <button type="submit" className={buttonClass.secondary}>
          {t.find}
        </button>
      </form>

      {file && !emp && <Alert kind="error">{t.notFound}</Alert>}

      {emp && (
        <Card className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold">{lang === "ar" ? emp.full_name_ar : emp.full_name_en}</h2>
            <span className="text-muted" dir="ltr">
              {emp.file_number}
            </span>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
            <dt className="text-muted">{t.consent}</dt>
            <dd data-testid="consent-status">
              {s?.has_consent ? (
                <Badge tone="ok">{t.consentGiven(date.format(new Date(s.consent_at)))}</Badge>
              ) : (
                <Badge tone="off">—</Badge>
              )}
            </dd>
            <dt className="text-muted">{t.enrollment}</dt>
            <dd data-testid="enroll-status">
              {s?.enrolled ? (
                <Badge tone="ok">{t.enrolledOn(date.format(new Date(s.enrolled_at)), t.sources[s.source as "web" | "mobile"])}</Badge>
              ) : (
                <Badge tone="off">{t.notEnrolled}</Badge>
              )}
            </dd>
          </dl>

          {!emp.is_active ? (
            <Alert kind="error">{t.suspended}</Alert>
          ) : !emp.user_id ? (
            <Alert kind="error">{t.noLogin}</Alert>
          ) : !s?.has_consent ? (
            <Alert kind="error">{t.consentMissing}</Alert>
          ) : (
            <>
              {s.enrolled && <p className="text-sm text-muted">{t.reEnroll}</p>}
              <EnrollCapture employeeId={emp.id} lang={lang} />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
