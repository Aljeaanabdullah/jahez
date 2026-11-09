import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm } from "@/components/action-form";
import { Card } from "@/components/ui";
import { createWorkPattern } from "../../actions";
import { NEW_PATTERN, PatternFields } from "../pattern-fields";

export default async function NewWorkPatternPage() {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/organisation/work-patterns" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {o.back}
      </Link>
      <Card>
        <h2 className="mb-4 text-lg font-bold">{o.newPattern}</h2>
        <ActionForm action={createWorkPattern} submitLabel={o.save} errors={o.errors} testId="new-pattern">
          <PatternFields o={o} defaults={NEW_PATTERN} />
        </ActionForm>
      </Card>
    </div>
  );
}
