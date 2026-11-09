import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { empT } from "@/lib/i18n-emp";
import { Alert, Badge, buttonClass, Input, Select, Table } from "@/components/ui";

const PAGE_SIZE = 50;

type Row = {
  id: string;
  file_number: number;
  full_name_ar: string;
  full_name_en: string;
  role: "employee" | "supervisor" | "hr" | "admin";
  is_active: boolean;
  user_id: string | null;
  department: { name_ar: string; name_en: string } | null;
};

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const q = one("q").trim();
  const dep = one("department");
  const site = one("site");
  const role = one("role");
  const status = one("status");
  const page = Math.max(1, Number(one("page")) || 1);
  const terminated = one("terminated");

  const { lang } = await getPrefs();
  const e = empT(lang);
  const supabase = await createClient();

  const [{ data: departments }, { data: sites }] = await Promise.all([
    supabase.from("departments").select("id, name_ar, name_en").order(lang === "ar" ? "name_ar" : "name_en"),
    supabase.from("sites").select("id, name_ar, name_en").order("created_at"),
  ]);

  const siteJoin = site ? ", employee_sites!inner(site_id)" : "";
  let query = supabase
    .from("employees")
    .select(
      `id, file_number, full_name_ar, full_name_en, role, is_active, user_id, department:departments!employees_department_id_fkey(name_ar, name_en)${siteJoin}`,
      { count: "exact" },
    );
  if (q) {
    query = /^\d+$/.test(q)
      ? query.gte("file_number", Number(q.padEnd(6, "0"))).lte("file_number", Number(q.padEnd(6, "9")))
      : query.or(`full_name_ar.ilike.%${q.replace(/[%,()]/g, "")}%,full_name_en.ilike.%${q.replace(/[%,()]/g, "")}%`);
  }
  if (dep) query = query.eq("department_id", dep);
  if (site) query = query.eq("employee_sites.site_id", site);
  if (role) query = query.eq("role", role);
  if (status === "active") query = query.eq("is_active", true).not("user_id", "is", null);
  if (status === "suspended") query = query.eq("is_active", false);
  if (status === "no_login") query = query.is("user_id", null);

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query
    .order("file_number")
    .range(from, from + PAGE_SIZE - 1)
    .returns<Row[]>();
  const rows = data ?? [];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, department: dep, site, role, status })) if (v) params.set(k, v);
    params.set("page", String(p));
    return `/employees?${params}`;
  };
  const name = (r: { name_ar: string; name_en: string }) => (lang === "ar" ? r.name_ar : r.name_en);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{e.title}</h1>
        <Link href="/employees/new" className={buttonClass.primary}>
          + {e.newEmployee}
        </Link>
      </div>

      {terminated && <Alert kind="success">{e.terminated(terminated)}</Alert>}

      <form className="grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-7" role="search">
        <Input name="q" defaultValue={q} placeholder={e.search} aria-label={e.search} className="lg:col-span-2" />
        <Select name="department" defaultValue={dep} aria-label={e.department}>
          <option value="">{e.allDepartments}</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {name(d)}
            </option>
          ))}
        </Select>
        <Select name="site" defaultValue={site} aria-label={e.sites}>
          <option value="">{e.allSites}</option>
          {(sites ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {name(s)}
            </option>
          ))}
        </Select>
        <Select name="role" defaultValue={role} aria-label={e.role}>
          <option value="">{e.allRoles}</option>
          {(["employee", "supervisor", "hr", "admin"] as const).map((r) => (
            <option key={r} value={r}>
              {e.roles[r]}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 lg:col-span-2">
          <Select name="status" defaultValue={status} aria-label={e.status}>
            <option value="">{e.allStatuses}</option>
            {(["active", "suspended", "no_login"] as const).map((s) => (
              <option key={s} value={s}>
                {e.statuses[s]}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClass.secondary}>
            {e.searchButton}
          </button>
        </div>
      </form>

      <p className="text-sm text-muted" data-testid="result-count">
        {e.results(total)}
      </p>

      <Table>
        <thead>
          <tr>
            <th>{e.fileNumber}</th>
            <th>{lang === "ar" ? e.nameAr : e.nameEn}</th>
            <th>{e.department}</th>
            <th>{e.role}</th>
            <th>{e.status}</th>
            <th>
              <span className="sr-only">{e.open}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                {e.empty}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id}>
              <td dir="ltr" className="text-start tabular-nums">
                {r.file_number}
              </td>
              <td className="font-medium">{lang === "ar" ? r.full_name_ar : r.full_name_en}</td>
              <td>{r.department ? name(r.department) : <span className="text-muted">—</span>}</td>
              <td>{e.roles[r.role]}</td>
              <td>
                {!r.is_active ? (
                  <Badge tone="off">{e.statuses.suspended}</Badge>
                ) : !r.user_id ? (
                  <Badge tone="off">{e.statuses.no_login}</Badge>
                ) : (
                  <Badge tone="ok">{e.statuses.active}</Badge>
                )}
              </td>
              <td className="text-end">
                <Link href={`/employees/${r.id}`} className="text-primary hover:underline">
                  {e.open}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label={e.page(page, pages)}>
          {page > 1 ? (
            <Link href={link(page - 1)} className={buttonClass.secondary}>
              {e.previous}
            </Link>
          ) : (
            <span className={`${buttonClass.secondary} opacity-50`}>{e.previous}</span>
          )}
          <span className="text-sm text-muted">{e.page(page, pages)}</span>
          {page < pages ? (
            <Link href={link(page + 1)} className={buttonClass.secondary}>
              {e.next}
            </Link>
          ) : (
            <span className={`${buttonClass.secondary} opacity-50`}>{e.next}</span>
          )}
        </nav>
      )}
    </>
  );
}
