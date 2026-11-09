import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { Badge, buttonClass, Table } from "@/components/ui";

type Row = {
  id: string;
  name_ar: string;
  name_en: string;
  radius_m: number;
  is_active: boolean;
  buildings: { count: number }[];
  employee_sites: { count: number }[];
};

export default async function SitesPage() {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();
  const { data } = await supabase
    .from("sites")
    .select("id, name_ar, name_en, radius_m, is_active, buildings(count), employee_sites(count)")
    .order("created_at")
    .returns<Row[]>();
  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href="/organisation/sites/new" className={buttonClass.primary}>
          + {o.newSite}
        </Link>
      </div>
      <Table>
        <thead>
          <tr>
            <th>{o.site}</th>
            <th>{o.radius}</th>
            <th>{o.buildings}</th>
            <th>{o.enabledEmployees}</th>
            <th>{o.status}</th>
            <th>
              <span className="sr-only">{o.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                {o.empty}
              </td>
            </tr>
          )}
          {rows.map((s) => (
            <tr key={s.id}>
              <td className="font-medium">{lang === "ar" ? s.name_ar : s.name_en}</td>
              <td dir="ltr" className="text-start">
                {s.radius_m}
              </td>
              <td>{s.buildings[0]?.count ?? 0}</td>
              <td>{s.employee_sites[0]?.count ?? 0}</td>
              <td>
                <Badge tone={s.is_active ? "ok" : "off"}>{s.is_active ? o.active : o.inactive}</Badge>
              </td>
              <td className="text-end">
                <Link href={`/organisation/sites/${s.id}`} className="text-primary hover:underline">
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
