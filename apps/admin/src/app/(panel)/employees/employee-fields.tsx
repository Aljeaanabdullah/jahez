import { Field, Input, Select } from "@/components/ui";
import type { EmpText } from "@/lib/i18n-emp";
import type { Lang } from "@/lib/i18n";

type Option = { id: string; name_ar: string; name_en: string };

export type EmployeeDefaults = {
  file_number?: number;
  full_name_ar?: string;
  full_name_en?: string;
  phone?: string | null;
  department_id?: string | null;
  work_pattern_id?: string | null;
  cycle_start_date?: string | null;
};

/** Fields shared by "new employee" and "edit employee". */
export function EmployeeFields({
  e,
  lang,
  departments,
  patterns,
  defaults = {},
  fileNumberLocked = false,
}: {
  e: EmpText;
  lang: Lang;
  departments: Option[];
  patterns: Option[];
  defaults?: EmployeeDefaults;
  fileNumberLocked?: boolean;
}) {
  const name = (o: Option) => (lang === "ar" ? o.name_ar : o.name_en);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={e.fileNumber}>
        <Input
          name="file_number"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          dir="ltr"
          defaultValue={defaults.file_number}
          readOnly={fileNumberLocked}
        />
      </Field>
      <Field label={e.phone} hint={e.phoneHint}>
        <Input name="phone" inputMode="tel" dir="ltr" defaultValue={defaults.phone?.replace(/^\+965/, "") ?? ""} />
      </Field>
      <Field label={e.nameAr}>
        <Input name="full_name_ar" required maxLength={120} defaultValue={defaults.full_name_ar} />
      </Field>
      <Field label={e.nameEn}>
        <Input name="full_name_en" required maxLength={120} dir="ltr" defaultValue={defaults.full_name_en} />
      </Field>
      <Field label={e.department}>
        <Select name="department_id" defaultValue={defaults.department_id ?? ""}>
          <option value="">{e.noDepartment}</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {name(d)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={e.workPattern}>
        <Select name="work_pattern_id" defaultValue={defaults.work_pattern_id ?? ""}>
          <option value="">{e.noPattern}</option>
          {patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {name(p)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={e.cycleStart} hint={e.cycleStartHint}>
        <Input name="cycle_start_date" type="date" dir="ltr" defaultValue={defaults.cycle_start_date ?? ""} />
      </Field>
    </div>
  );
}
