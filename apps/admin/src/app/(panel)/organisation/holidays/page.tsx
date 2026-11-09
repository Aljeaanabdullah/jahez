import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm, DeleteButton } from "@/components/action-form";
import { Card, Field, Input, Table } from "@/components/ui";
import { createHoliday, deleteHoliday } from "../actions";

export default async function HolidaysPage({ searchParams }: PageProps<"/organisation/holidays">) {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const yearParam = Number((await searchParams).year);
  const thisYear = new Date().getFullYear();
  const year = Number.isInteger(yearParam) && yearParam > 2000 && yearParam < 2100 ? yearParam : thisYear;

  const supabase = await createClient();
  const { data } = await supabase
    .from("public_holidays")
    .select("id, holiday_date, name_ar, name_en")
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`)
    .order("holiday_date");
  const rows = data ?? [];
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Link href={`?year=${year - 1}`} className="rounded-lg border border-line px-3 py-1 hover:bg-primary-soft" aria-label={`${year - 1}`}>
            {lang === "ar" ? "→" : "←"}
          </Link>
          <span className="text-lg font-bold" dir="ltr">
            {year}
          </span>
          <Link href={`?year=${year + 1}`} className="rounded-lg border border-line px-3 py-1 hover:bg-primary-soft" aria-label={`${year + 1}`}>
            {lang === "ar" ? "←" : "→"}
          </Link>
        </div>
        <Table>
          <thead>
            <tr>
              <th>{o.date}</th>
              <th>{o.tabs.holidays}</th>
              <th>
                <span className="sr-only">{o.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted">
                  {o.empty}
                </td>
              </tr>
            )}
            {rows.map((h) => (
              <tr key={h.id}>
                <td>{fmt.format(new Date(`${h.holiday_date}T00:00:00Z`))}</td>
                <td className="font-medium">{lang === "ar" ? h.name_ar : h.name_en}</td>
                <td className="text-end">
                  <DeleteButton
                    action={deleteHoliday.bind(null, h.id)}
                    label={o.delete}
                    confirmText={o.confirmDelete}
                    errors={o.errors}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <Card>
        <h2 className="mb-4 font-bold">{o.newHoliday}</h2>
        <ActionForm action={createHoliday} submitLabel={o.add} savedLabel={o.saved} errors={o.errors} testId="new-holiday" resetOnSuccess>
          <Field label={o.date}>
            <Input name="holiday_date" type="date" required dir="ltr" />
          </Field>
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
