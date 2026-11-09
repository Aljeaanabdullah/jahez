import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { intervalToMinutes, isRotation } from "@/lib/validation";
import { buttonClass, Table } from "@/components/ui";

type Row = {
  id: string;
  name_ar: string;
  name_en: string;
  kind: "morning" | "afternoon" | "evening" | "one_on_two_off" | "two_on_four_off";
  shift_start: string;
  shift_duration: string;
  cycle_work_days: number | null;
  cycle_off_days: number | null;
  weekly_off_days: number[];
  employees: { count: number }[];
};

export default async function WorkPatternsPage() {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_patterns")
    .select("id, name_ar, name_en, kind, shift_start, shift_duration, cycle_work_days, cycle_off_days, weekly_off_days, employees(count)")
    .order("shift_start")
    .returns<Row[]>();
  const rows = data ?? [];

  const schedule = (p: Row) => {
    const hours = intervalToMinutes(p.shift_duration) / 60;
    const start = p.shift_start.slice(0, 5);
    const tail = isRotation(p.kind)
      ? `${p.cycle_work_days} ${o.daysOn} / ${p.cycle_off_days} ${o.daysOff}`
      : p.weekly_off_days.map((d) => o.weekdays[d as keyof typeof o.weekdays]).join("، ");
    return (
      <>
        <span dir="ltr">{start}</span> · {hours} {o.hours}
        {tail && <span className="block text-xs text-muted">{tail}</span>}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/organisation/work-patterns/new" className={buttonClass.primary}>
          + {o.newPattern}
        </Link>
      </div>
      <Table>
        <thead>
          <tr>
            <th>{o.tabs.workPatterns}</th>
            <th>{o.kind}</th>
            <th>{o.schedule}</th>
            <th>{o.employeesCount}</th>
            <th>
              <span className="sr-only">{o.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted">
                {o.empty}
              </td>
            </tr>
          )}
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="font-medium">{lang === "ar" ? p.name_ar : p.name_en}</td>
              <td>{o.kinds[p.kind]}</td>
              <td>{schedule(p)}</td>
              <td>{p.employees[0]?.count ?? 0}</td>
              <td className="text-end">
                <Link href={`/organisation/work-patterns/${p.id}`} className="text-primary hover:underline">
                  {o.edit}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
