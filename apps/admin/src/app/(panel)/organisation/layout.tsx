import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { NavLink } from "@/components/nav-link";

const tabClass = "rounded-lg px-3 py-1.5 text-sm hover:bg-primary-soft";
const activeTabClass = "rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-on-primary";

export default async function OrganisationLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const tabs = [
    ["/organisation/departments", o.tabs.departments],
    ["/organisation/sites", o.tabs.sites],
    ["/organisation/work-patterns", o.tabs.workPatterns],
    ["/organisation/holidays", o.tabs.holidays],
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">{o.title}</h1>
      <nav aria-label={o.title} className="flex flex-wrap gap-2">
        {tabs.map(([href, label]) => (
          <NavLink key={href} href={href} className={tabClass} activeClassName={activeTabClass}>
            {label}
          </NavLink>
        ))}
      </nav>
      {children}
    </div>
  );
}
