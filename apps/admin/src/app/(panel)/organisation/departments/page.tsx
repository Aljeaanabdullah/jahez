import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, Table } from "@/components/ui";
import { createDepartment } from "../actions";

type Row = {
  id: string;
  name_ar: string;
  name_en: string;
  supervisor: { file_number: number; full_name_ar: string; full_name_en: string } | null;
  members: { count: number }[];
};

export default async function DepartmentsPage() {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select(
      "id, name_ar, name_en, supervisor:employees!departments_supervisor_id_fkey(file_number, full_name_ar, full_name_en), members:employees!employees_department_id_fkey(count)",
    )
    .order(lang === "ar" ? "name_ar" : "name_en")
    .returns<Row[]>();
  const rows = data ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <Table>
        <thead>
          <tr>
            <th>{o.tabs.departments}</th>
            <th>{o.supervisor}</th>
            <th>{o.employeesCount}</th>
            <th>
              <span className="sr-only">{o.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="text-muted">
                {o.empty}
              </td>
            </tr>
          )}
          {rows.map((d) => (
            <tr key={d.id}>
              <td className="font-medium">{lang === "ar" ? d.name_ar : d.name_en}</td>
              <td>
                {d.supervisor ? (
                  <>
                    {lang === "ar" ? d.supervisor.full_name_ar : d.supervisor.full_name_en}{" "}
                    <span className="text-muted" dir="ltr">
                      ({d.supervisor.file_number})
                    </span>
                  </>
                ) : (
                  <span className="text-muted">{o.noSupervisor}</span>
                )}
              </td>
              <td>{d.members[0]?.count ?? 0}</td>
              <td className="text-end">
                <Link href={`/organisation/departments/${d.id}`} className="text-primary hover:underline">
                  {o.edit}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Card>
        <h2 className="mb-4 font-bold">{o.newDepartment}</h2>
        <ActionForm action={createDepartment} submitLabel={o.add} savedLabel={o.saved} errors={o.errors} testId="new-department" resetOnSuccess>
          <Field label={o.nameAr}>
            <Input name="name_ar" required maxLength={100} />
          </Field>
          <Field label={o.nameEn}>
            <Input name="name_en" required maxLength={100} dir="ltr" />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
