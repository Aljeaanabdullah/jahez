import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { empT } from "@/lib/i18n-emp";
import { ActionForm, DeleteButton } from "@/components/action-form";
import { Badge, buttonClass, Card, Field, Input, Select } from "@/components/ui";
import { setActive, setPassword, setRole, setSites, unbindDevice, updateEmployee } from "../actions";
import { EmployeeFields } from "../employee-fields";

export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const { lang } = await getPrefs();
  const e = empT(lang);
  const supabase = await createClient();

  const { data: emp } = await supabase
    .from("employees")
    .select(
      "id, file_number, full_name_ar, full_name_en, phone, role, department_id, work_pattern_id, cycle_start_date, is_active, user_id, must_change_password",
    )
    .eq("id", id)
    .maybeSingle();
  if (!emp) notFound();

  const [{ data: departments }, { data: patterns }, { data: sites }, { data: enabled }, { data: device }] =
    await Promise.all([
      supabase.from("departments").select("id, name_ar, name_en").order(lang === "ar" ? "name_ar" : "name_en"),
      supabase.from("work_patterns").select("id, name_ar, name_en").order("shift_start"),
      supabase.from("sites").select("id, name_ar, name_en, is_active").order("created_at"),
      supabase.from("employee_sites").select("site_id").eq("employee_id", id),
      supabase.from("devices").select("platform, model, bound_at").eq("employee_id", id).maybeSingle(),
    ]);
  const enabledIds = new Set((enabled ?? []).map((r) => r.site_id));

  const isSelf = emp.id === me.id;
  const isAdmin = emp.role === "admin";
  const locked = isSelf || isAdmin;
  const lockedNote = isSelf ? e.yourAccount : e.errors.admin_account;
  const name = (o: { name_ar: string; name_en: string }) => (lang === "ar" ? o.name_ar : o.name_en);
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", { dateStyle: "medium", timeZone: "Asia/Kuwait" });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/employees" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {e.back}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{lang === "ar" ? emp.full_name_ar : emp.full_name_en}</h1>
        <span className="text-muted" dir="ltr">
          {emp.file_number}
        </span>
        <Badge tone={emp.is_active ? "ok" : "off"}>{emp.is_active ? e.statuses.active : e.statuses.suspended}</Badge>
        <Badge tone="ok">{e.roles[emp.role as keyof typeof e.roles]}</Badge>
      </div>

      {/* Details */}
      <Card>
        <h2 className="mb-4 font-bold">{e.details}</h2>
        <ActionForm
          action={updateEmployee.bind(null, id)}
          submitLabel={e.save}
          savedLabel={e.saved}
          errors={e.errors}
          testId="edit-employee"
        >
          <EmployeeFields
            e={e}
            lang={lang}
            departments={departments ?? []}
            patterns={patterns ?? []}
            defaults={emp}
            fileNumberLocked={!!emp.user_id}
          />
        </ActionForm>
      </Card>

      {/* Role and password */}
      <Card>
        <h2 className="mb-4 font-bold">{e.roleAndPassword}</h2>
        {locked ? (
          <p className="text-sm text-muted">{lockedNote}</p>
        ) : (
          <div className="flex flex-col gap-6">
            <ActionForm
              action={setRole.bind(null, id)}
              submitLabel={e.saveRole}
              savedLabel={e.saved}
              errors={e.errors}
              testId="role"
            >
              <Field label={e.role} hint={e.supervisorHint}>
                <Select name="role" defaultValue={emp.role}>
                  {(["employee", "supervisor", "hr"] as const).map((r) => (
                    <option key={r} value={r}>
                      {e.roles[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </ActionForm>

            <div className="border-t border-line pt-5">
              <p className="mb-3 text-sm">
                {emp.user_id ? (
                  <>
                    <Badge tone="ok">{e.hasLogin}</Badge>{" "}
                    {emp.must_change_password && <span className="text-muted">{e.mustChange}</span>}
                  </>
                ) : (
                  <span className="text-muted">{e.noLogin}</span>
                )}
              </p>
              <ActionForm
                action={setPassword.bind(null, id)}
                submitLabel={e.setPassword}
                savedLabel={e.passwordSaved}
                errors={e.errors}
                testId="password"
                resetOnSuccess
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={e.password}>
                    <Input name="password" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
                  </Field>
                  <Field label={e.confirmPassword}>
                    <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required dir="ltr" />
                  </Field>
                </div>
                <p className="text-xs text-muted">{e.passwordRules}</p>
              </ActionForm>
            </div>
          </div>
        )}
      </Card>

      {/* Sites */}
      <Card>
        <h2 className="mb-1 font-bold">{e.sites}</h2>
        <p className="mb-4 text-sm text-muted">{e.sitesHint}</p>
        <ActionForm action={setSites.bind(null, id)} submitLabel={e.saveSites} savedLabel={e.saved} errors={e.errors} testId="sites">
          <div className="flex flex-col gap-2">
            {(sites ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <input type="checkbox" name="site_id" value={s.id} defaultChecked={enabledIds.has(s.id)} className="size-4 accent-primary" />
                <span>{name(s)}</span>
                {!s.is_active && <Badge tone="off">{e.inactiveSite}</Badge>}
              </label>
            ))}
          </div>
        </ActionForm>
      </Card>

      {/* Device */}
      <Card>
        <h2 className="mb-3 font-bold">{e.device}</h2>
        {device ? (
          <div className="flex flex-col gap-3">
            <p data-testid="device-info">
              <span dir="ltr">{device.model ?? device.platform}</span> ·{" "}
              <span className="text-muted">
                {e.boundAt}: {date.format(new Date(device.bound_at))}
              </span>
            </p>
            <DeleteButton action={unbindDevice.bind(null, id)} label={e.unbind} confirmText={e.unbindConfirm} errors={e.errors} />
          </div>
        ) : (
          <p className="text-sm text-muted">{e.noDevice}</p>
        )}
      </Card>

      {/* Account */}
      <Card>
        <h2 className="mb-3 font-bold">{e.account}</h2>
        {locked ? (
          <p className="text-sm text-muted">{lockedNote}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{e.suspendHint}</p>
            {emp.is_active ? (
              <DeleteButton action={setActive.bind(null, id, false)} label={e.suspend} confirmText={e.suspendConfirm} errors={e.errors} />
            ) : (
              <DeleteButton action={setActive.bind(null, id, true)} label={e.resume} errors={e.errors} variant="secondary" />
            )}
            <div className="border-t border-line pt-4">
              <Link href={`/employees/${id}/terminate`} className={buttonClass.danger}>
                {e.terminate}
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
