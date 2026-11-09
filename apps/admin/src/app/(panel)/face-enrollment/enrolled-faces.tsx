import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { faceT } from "@/lib/i18n-face";
import type { Lang } from "@/lib/i18n";
import { buttonClass, Card } from "@/components/ui";

const PAGE_SIZE = 20;

type Row = {
  employee_id: string;
  enrolled_at: string;
  source: "web" | "mobile";
  photo_paths: string[];
  employee: { file_number: number; full_name_ar: string; full_name_en: string } | null;
  enroller: { full_name_ar: string; full_name_en: string } | null;
};

/** Admin only: enrollment photos for review (storage RLS lets only the admin open them). */
export async function EnrolledFaces({ lang, page }: { lang: Lang; page: number }) {
  const t = faceT(lang);
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await supabase
    .from("face_templates")
    .select(
      "employee_id, enrolled_at, source, photo_paths, employee:employees!face_templates_employee_id_fkey(file_number, full_name_ar, full_name_en), enroller:employees!face_templates_enrolled_by_fkey(full_name_ar, full_name_en)",
      { count: "exact" },
    )
    .order("enrolled_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<Row[]>();
  const rows = data ?? [];

  const paths = rows.flatMap((r) => r.photo_paths);
  const { data: signed } = paths.length
    ? await supabase.storage.from("face-enrollment-photos").createSignedUrls(paths, 300)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const name = (n: { full_name_ar: string; full_name_en: string } | null) => (n ? (lang === "ar" ? n.full_name_ar : n.full_name_en) : "—");
  const date = new Intl.DateTimeFormat(lang === "ar" ? "ar-KW" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" });
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold">{t.reviewTitle}</h1>
        <p className="text-sm text-muted">{t.reviewIntro}</p>
      </div>
      {rows.length === 0 && <p className="text-muted">{t.empty}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((r) => (
          <Card key={r.employee_id} className="flex flex-col gap-3">
            <div>
              <Link href={`/employees/${r.employee_id}`} className="font-bold text-primary hover:underline">
                {name(r.employee)}
              </Link>{" "}
              <span className="text-muted" dir="ltr">
                {r.employee?.file_number}
              </span>
              <p className="text-xs text-muted">
                {date.format(new Date(r.enrolled_at))} · {t.sources[r.source]} · {t.enrolledBy}: {name(r.enroller)}
              </p>
            </div>
            <div className="flex gap-2">
              {r.photo_paths.map((p, i) =>
                urlFor.get(p) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p} src={urlFor.get(p)!} alt={t.photo(i + 1)} className="size-24 rounded-lg border border-line object-cover" />
                ) : null,
              )}
            </div>
          </Card>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex justify-center gap-3">
          {page > 1 && (
            <Link href={`?page=${page - 1}`} className={buttonClass.secondary}>
              ←
            </Link>
          )}
          <span className="text-sm text-muted">
            {page} / {pages}
          </span>
          {page < pages && (
            <Link href={`?page=${page + 1}`} className={buttonClass.secondary}>
              →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
