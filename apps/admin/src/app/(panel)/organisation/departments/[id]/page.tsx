import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm, DeleteButton } from "@/components/action-form";
import { Card, Field, Input, Select } from "@/components/ui";
import { deleteDepartment, updateDepartment } from "../../actions";

export default async function DepartmentPage({ params }: PageProps<"/organisation/departments/[id]">) {
  const { id } = await params;
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();

  const { data: dep } = await supabase
    .from("departments").select("id, name_ar, name_en, supervisor_id").eq("id", id).maybeSingle();
  if (!dep) notFound();

  const { data: members } = await supabase
    .from("employees")
    .select("id, file_number, full_name_ar, full_name_en")
    .eq("department_id", id)
    .eq("is_active", true)
    .order("file_number")
    .range(0, 4999);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Link href="/organisation/departments" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {o.back}
      </Link>
      <Card>
        <h2 className="mb-4 text-lg font-bold">{lang === "ar" ? dep.name_ar : dep.name_en}</h2>
        <ActionForm
          action={updateDepartment.bind(null, id)}
          submitLabel={o.save}
          savedLabel={o.saved}
          errors={o.errors}
          testId="edit-department"
        >
          <Field label={o.nameAr}>
            <Input name="name_ar" defaultValue={dep.name_ar} required maxLength={100} />
          </Field>
          <Field label={o.nameEn}>
            <Input name="name_en" defaultValue={dep.name_en} required maxLength={100} dir="ltr" />
          </Field>
          <Field label={o.supervisor} hint={o.supervisorHint}>
            <Select name="supervisor_id" defaultValue={dep.supervisor_id ?? ""}>
              <option value="">{o.noSupervisor}</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.file_number} — {lang === "ar" ? m.full_name_ar : m.full_name_en}
                </option>
              ))}
            </Select>
          </Field>
        </ActionForm>
      </Card>
      <Card>
        <DeleteButton
          action={deleteDepartment.bind(null, id)}
          label={o.delete}
          confirmText={o.confirmDelete}
          errors={o.errors}
        />
      </Card>
    </div>
  );
}
