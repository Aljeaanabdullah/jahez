import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { intervalToMinutes } from "@/lib/validation";
import { ActionForm, DeleteButton } from "@/components/action-form";
import { Card } from "@/components/ui";
import { deleteWorkPattern, updateWorkPattern } from "../../actions";
import { PatternFields } from "../pattern-fields";

export default async function WorkPatternPage({ params }: PageProps<"/organisation/work-patterns/[id]">) {
  const { id } = await params;
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("work_patterns")
    .select("id, name_ar, name_en, kind, shift_start, shift_duration, cycle_work_days, cycle_off_days, weekly_off_days, checkin_opens_before, grace_period, checkout_window_after")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/organisation/work-patterns" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {o.back}
      </Link>
      <Card>
        <h2 className="mb-4 text-lg font-bold">{lang === "ar" ? p.name_ar : p.name_en}</h2>
        <ActionForm
          action={updateWorkPattern.bind(null, id)}
          submitLabel={o.save}
          savedLabel={o.saved}
          errors={o.errors}
          testId="edit-pattern"
        >
          <PatternFields
            o={o}
            defaults={{
              name_ar: p.name_ar,
              name_en: p.name_en,
              kind: p.kind,
              shift_start: String(p.shift_start).slice(0, 5),
              shift_hours: intervalToMinutes(p.shift_duration) / 60,
              cycle_work_days: p.cycle_work_days,
              cycle_off_days: p.cycle_off_days,
              weekly_off_days: p.weekly_off_days ?? [],
              checkin_opens_before_min: intervalToMinutes(p.checkin_opens_before),
              grace_period_min: intervalToMinutes(p.grace_period),
              checkout_window_after_min: intervalToMinutes(p.checkout_window_after),
            }}
          />
        </ActionForm>
      </Card>
      <Card>
        <DeleteButton action={deleteWorkPattern.bind(null, id)} label={o.delete} confirmText={o.confirmDelete} errors={o.errors} />
      </Card>
    </div>
  );
}
