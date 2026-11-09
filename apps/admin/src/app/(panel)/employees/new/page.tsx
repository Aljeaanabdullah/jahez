import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { empT } from "@/lib/i18n-emp";
import { ActionForm } from "@/components/action-form";
import { Card } from "@/components/ui";
import { createEmployee } from "../actions";
import { EmployeeFields } from "../employee-fields";

export default async function NewEmployeePage() {
  const { lang } = await getPrefs();
  const e = empT(lang);
  const supabase = await createClient();
  const [{ data: departments }, { data: patterns }] = await Promise.all([
    supabase.from("departments").select("id, name_ar, name_en").order(lang === "ar" ? "name_ar" : "name_en"),
    supabase.from("work_patterns").select("id, name_ar, name_en").order("shift_start"),
  ]);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/employees" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {e.back}
      </Link>
      <Card>
        <h1 className="mb-4 text-xl font-bold">{e.newEmployee}</h1>
        <ActionForm action={createEmployee} submitLabel={e.save} errors={e.errors} testId="new-employee">
          <EmployeeFields e={e} lang={lang} departments={departments ?? []} patterns={patterns ?? []} />
        </ActionForm>
      </Card>
    </div>
  );
}
