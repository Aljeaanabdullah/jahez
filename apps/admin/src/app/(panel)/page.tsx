import { requireStaff } from "@/lib/auth";
import { getPrefs } from "@/lib/prefs";

export default async function DashboardPage() {
  const me = await requireStaff();
  const { t, lang } = await getPrefs();
  return (
    <section className="max-w-2xl rounded-2xl border border-line bg-surface p-6">
      <h1 className="text-2xl font-bold">
        {t.welcome}، {lang === "ar" ? me.nameAr : me.nameEn}
      </h1>
      <p className="mt-2 text-muted">{t.dashboardIntro}</p>
    </section>
  );
}
