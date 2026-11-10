import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { reqT } from "@/lib/i18n-req";
import { Alert, buttonClass, Input } from "@/components/ui";

// Supervisor / HR / admin: find any employee's record by file number (PRD 2: supervisors see every employee).
export default async function RecordsPage({ searchParams }: PageProps<"/records">) {
  await requireStaff();
  const { lang } = await getPrefs();
  const t = reqT(lang);
  const file = String((await searchParams).file ?? "").trim();
  if (/^\d{6}$/.test(file)) {
    const supabase = await createClient();
    const { data: emp } = await supabase.from("employees").select("id").eq("file_number", Number(file)).maybeSingle();
    if (emp) redirect(`/records/${emp.id}`);
  }
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{t.recordsTitle}</h1>
        <p className="text-sm text-muted">{t.recordsHint}</p>
      </div>
      <form className="flex gap-2" role="search">
        <Input
          name="file"
          defaultValue={file}
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          placeholder={t.search}
          aria-label={t.search}
          dir="ltr"
          className="max-w-48"
        />
        <button type="submit" className={buttonClass.secondary}>
          {t.find}
        </button>
      </form>
      {file && <Alert kind="error">{t.notFound}</Alert>}
    </div>
  );
}
