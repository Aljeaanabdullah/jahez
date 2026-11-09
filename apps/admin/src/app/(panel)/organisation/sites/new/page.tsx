import Link from "next/link";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm } from "@/components/action-form";
import { MapPicker } from "@/components/map/map-picker";
import { Card, Field, Input } from "@/components/ui";
import { createSite } from "../../actions";

export default async function NewSitePage() {
  const { lang } = await getPrefs();
  const o = orgT(lang);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/organisation/sites" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {o.back}
      </Link>
      <Card>
        <h2 className="mb-4 text-lg font-bold">{o.newSite}</h2>
        <ActionForm action={createSite} submitLabel={o.save} errors={o.errors} testId="new-site">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={o.nameAr}>
              <Input name="name_ar" required maxLength={100} />
            </Field>
            <Field label={o.nameEn}>
              <Input name="name_en" required maxLength={100} dir="ltr" />
            </Field>
          </div>
          <MapPicker
            defaultRadius={200}
            minRadius={10}
            maxRadius={5000}
            labels={{ latitude: o.latitude, longitude: o.longitude, radius: o.radius, hint: o.mapHint }}
          />
        </ActionForm>
      </Card>
    </div>
  );
}
