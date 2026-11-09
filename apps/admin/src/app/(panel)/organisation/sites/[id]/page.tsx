import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPrefs } from "@/lib/prefs";
import { orgT } from "@/lib/i18n-org";
import { ActionForm, DeleteButton } from "@/components/action-form";
import { MapPicker } from "@/components/map/map-picker";
import { Badge, buttonClass, Card, Field, Input, Table } from "@/components/ui";
import { createBuilding, deleteBuilding, deleteSite, setSiteActive, updateSite } from "../../actions";

export default async function SitePage({ params }: PageProps<"/organisation/sites/[id]">) {
  const { id } = await params;
  const { lang } = await getPrefs();
  const o = orgT(lang);
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name_ar, name_en, latitude, longitude, radius_m, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!site) notFound();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, name_ar, name_en, latitude, longitude, radius_m")
    .eq("site_id", id)
    .order("created_at");

  const name = (r: { name_ar: string; name_en: string }) => (lang === "ar" ? r.name_ar : r.name_en);
  const siteCircle = { lat: site.latitude, lng: site.longitude, radius: site.radius_m, tone: "site" as const, label: name(site) };
  const buildingCircles = (buildings ?? []).map((b) => ({
    lat: b.latitude,
    lng: b.longitude,
    radius: b.radius_m,
    tone: "building" as const,
    label: name(b),
  }));
  const mapLabels = { latitude: o.latitude, longitude: o.longitude, radius: o.radius };

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link href="/organisation/sites" className="text-sm text-primary hover:underline">
        <span aria-hidden className="inline-block rtl:rotate-180">←</span> {o.back}
      </Link>

      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold">{name(site)}</h2>
          <Badge tone={site.is_active ? "ok" : "off"}>{site.is_active ? o.active : o.inactive}</Badge>
        </div>
        <ActionForm
          action={updateSite.bind(null, id)}
          submitLabel={o.save}
          savedLabel={o.saved}
          errors={o.errors}
          testId="edit-site"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={o.nameAr}>
              <Input name="name_ar" defaultValue={site.name_ar} required maxLength={100} />
            </Field>
            <Field label={o.nameEn}>
              <Input name="name_en" defaultValue={site.name_en} required maxLength={100} dir="ltr" />
            </Field>
          </div>
          <MapPicker
            defaultValue={{ lat: site.latitude, lng: site.longitude, radius: site.radius_m }}
            defaultRadius={200}
            minRadius={10}
            maxRadius={5000}
            context={buildingCircles}
            labels={{ ...mapLabels, hint: o.mapHint }}
          />
        </ActionForm>
      </Card>

      <Card>
        <h3 className="mb-3 font-bold">{o.buildings}</h3>
        <Table>
          <thead>
            <tr>
              <th>{o.buildings}</th>
              <th>{o.radius}</th>
              <th>
                <span className="sr-only">{o.actions}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(buildings ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="text-muted">
                  {o.empty}
                </td>
              </tr>
            )}
            {(buildings ?? []).map((b) => (
              <tr key={b.id}>
                <td className="font-medium">{name(b)}</td>
                <td dir="ltr" className="text-start">
                  {b.radius_m}
                </td>
                <td className="text-end">
                  <DeleteButton
                    action={deleteBuilding.bind(null, b.id, id)}
                    label={o.delete}
                    confirmText={o.confirmDelete}
                    errors={o.errors}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>

        <h4 className="mt-6 mb-3 font-medium">{o.newBuilding}</h4>
        <ActionForm
          action={createBuilding.bind(null, id)}
          submitLabel={o.add}
          savedLabel={o.saved}
          errors={o.errors}
          testId="new-building"
          resetOnSuccess
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={o.nameAr}>
              <Input name="name_ar" required maxLength={100} />
            </Field>
            <Field label={o.nameEn}>
              <Input name="name_en" required maxLength={100} dir="ltr" />
            </Field>
          </div>
          <MapPicker
            defaultRadius={30}
            minRadius={5}
            maxRadius={1000}
            context={[siteCircle, ...buildingCircles]}
            labels={{ ...mapLabels, hint: o.buildingHint }}
          />
        </ActionForm>
      </Card>

      <Card className="flex flex-col gap-4">
        <p className="text-sm text-muted">{o.deactivateHint}</p>
        <form action={setSiteActive.bind(null, id, !site.is_active)}>
          <button type="submit" className={buttonClass.secondary}>
            {site.is_active ? o.deactivate : o.activate}
          </button>
        </form>
        <DeleteButton action={deleteSite.bind(null, id)} label={o.delete} confirmText={o.confirmDelete} errors={o.errors} />
      </Card>
    </div>
  );
}
