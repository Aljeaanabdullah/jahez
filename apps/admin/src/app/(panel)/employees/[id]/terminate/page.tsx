import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { empT } from "@/lib/i18n-emp";
import { Card } from "@/components/ui";
import { terminateEmployee } from "../../actions";
import { TerminateSteps } from "./terminate-steps";

export default async function TerminatePage({ params }: PageProps<"/employees/[id]/terminate">) {
  const { id } = await params;
  const me = await requireAdmin();
  const { lang } = await getPrefs();
  const e = empT(lang);
  const supabase = await createClient();
  const { data: emp } = await supabase
    .from("employees").select("id, file_number, full_name_ar, full_name_en, role").eq("id", id).maybeSingle();
  if (!emp) notFound();
  if (emp.id === me.id || emp.role === "admin") redirect(`/employees/${id}`);

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <Link href={`/employees/${id}`} className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {lang === "ar" ? emp.full_name_ar : emp.full_name_en}
      </Link>
      <Card>
        <h1 className="mb-2 text-xl font-bold">
          {e.terminateTitle}: {lang === "ar" ? emp.full_name_ar : emp.full_name_en}{" "}
          <span className="text-muted" dir="ltr">
            ({emp.file_number})
          </span>
        </h1>
        <p className="mb-5 text-sm text-muted">{e.terminateIntro}</p>
        <TerminateSteps
          id={id}
          fileNumber={emp.file_number}
          errors={e.errors}
          action={terminateEmployee.bind(null, id)}
          t={{
            step1: e.step1,
            step2: e.step2,
            step3: e.step3,
            download: e.download,
            downloaded: e.downloaded,
            deletesWhat: e.deletesWhat,
            typeToConfirm: e.typeToConfirm,
            deleteForever: e.deleteForever,
            downloadFirst: e.downloadFirst,
          }}
        />
      </Card>
    </div>
  );
}
