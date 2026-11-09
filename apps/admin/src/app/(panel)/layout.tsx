import type { ReactNode } from "react";
import { requireStaff, type StaffRole } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";
import { signOut } from "@/app/actions/auth";
import { PrefsButtons } from "@/components/prefs-buttons";
import type { Dictionary } from "@/lib/i18n";

type NavKey = keyof Dictionary["nav"];

// Menu per role (docs/PRD.md section 2). Only "Home" is built in Phase 2.
const menu: Record<StaffRole, NavKey[]> = {
  supervisor: ["dashboard", "liveBoard", "approvals", "reports", "emergencies"],
  hr: ["dashboard", "liveBoard", "approvals", "reports", "faceEnrollment"],
  admin: ["dashboard", "liveBoard", "reports", "employees", "faceEnrollment", "organisation", "emergencies", "auditLog"],
};

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const me = await requireStaff();
  const { t, theme, lang } = await getPrefs();
  const name = lang === "ar" ? me.nameAr : me.nameEn;

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-b-0 md:border-e">
        <div className="px-5 py-4">
          <p className="text-2xl font-bold text-primary">{t.appName}</p>
          <p className="text-xs text-muted">{t.panelTitle}</p>
        </div>
        <nav aria-label={t.panelTitle}>
          <ul className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
            {menu[me.role].map((key) => {
              const active = key === "dashboard";
              return (
                <li key={key} className="shrink-0">
                  <span
                    aria-current={active ? "page" : undefined}
                    aria-disabled={active ? undefined : true}
                    className={
                      active
                        ? "flex items-center justify-between gap-2 rounded-lg bg-primary-soft px-3 py-2 font-medium text-primary"
                        : "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-muted"
                    }
                  >
                    {t.nav[key]}
                    {!active && <span className="rounded bg-line px-1.5 text-[10px]">{t.comingSoon}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
          <div>
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted">
              {t.roles[me.role]} · <span dir="ltr">{me.fileNumber}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PrefsButtons t={t} theme={theme} />
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-danger-soft hover:text-danger"
              >
                {t.signOut}
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
