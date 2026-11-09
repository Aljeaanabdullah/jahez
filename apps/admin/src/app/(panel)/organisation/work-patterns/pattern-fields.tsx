"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui";
import { isRotation, PATTERN_KINDS } from "@/lib/validation";
import type { OrgText } from "@/lib/i18n-org";

export type PatternDefaults = {
  name_ar: string;
  name_en: string;
  kind: string;
  shift_start: string;
  shift_hours: number;
  cycle_work_days: number | null;
  cycle_off_days: number | null;
  weekly_off_days: number[];
  checkin_opens_before_min: number;
  grace_period_min: number;
  checkout_window_after_min: number;
};

export const NEW_PATTERN: PatternDefaults = {
  name_ar: "",
  name_en: "",
  kind: "morning",
  shift_start: "07:00",
  shift_hours: 8,
  cycle_work_days: null,
  cycle_off_days: null,
  weekly_off_days: [5, 6],
  checkin_opens_before_min: 60,
  grace_period_min: 60,
  checkout_window_after_min: 60,
};

/** Fields for a work pattern. Rotation types ask for days on/off; fixed types for weekly days off. */
export function PatternFields({ o, defaults }: { o: OrgText; defaults: PatternDefaults }) {
  const [kind, setKind] = useState(defaults.kind);
  const rotation = isRotation(kind);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={o.nameAr}>
          <Input name="name_ar" defaultValue={defaults.name_ar} required maxLength={100} />
        </Field>
        <Field label={o.nameEn}>
          <Input name="name_en" defaultValue={defaults.name_en} required maxLength={100} dir="ltr" />
        </Field>
        <Field label={o.kind}>
          <Select name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {PATTERN_KINDS.map((k) => (
              <option key={k} value={k}>
                {o.kinds[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={o.shiftStart}>
          <Input name="shift_start" type="time" defaultValue={defaults.shift_start} required dir="ltr" />
        </Field>
        <Field label={o.shiftHours} hint={o.shiftHoursHint}>
          <Input
            name="shift_hours"
            type="number"
            min={0.25}
            max={48}
            step={0.25}
            defaultValue={defaults.shift_hours}
            required
            dir="ltr"
          />
        </Field>
      </div>

      {rotation ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={o.cycleWorkDays}>
            <Input name="cycle_work_days" type="number" min={1} max={14} defaultValue={defaults.cycle_work_days ?? (kind === "two_on_four_off" ? 2 : 1)} required dir="ltr" />
          </Field>
          <Field label={o.cycleOffDays}>
            <Input name="cycle_off_days" type="number" min={1} max={14} defaultValue={defaults.cycle_off_days ?? (kind === "two_on_four_off" ? 4 : 2)} required dir="ltr" />
          </Field>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-sm font-medium">{o.weeklyOffDays}</legend>
          <div className="flex flex-wrap gap-3">
            {([7, 1, 2, 3, 4, 5, 6] as const).map((d) => (
              <label key={d} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm">
                <input type="checkbox" name="weekly_off_days" value={d} defaultChecked={defaults.weekly_off_days.includes(d)} className="accent-primary" />
                {o.weekdays[d]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <Field label={o.checkinOpens}>
          <Input name="checkin_opens_before_min" type="number" min={0} max={360} defaultValue={defaults.checkin_opens_before_min} required dir="ltr" />
        </Field>
        <Field label={o.grace}>
          <Input name="grace_period_min" type="number" min={0} max={240} defaultValue={defaults.grace_period_min} required dir="ltr" />
        </Field>
        <Field label={o.checkoutWindow}>
          <Input name="checkout_window_after_min" type="number" min={0} max={360} defaultValue={defaults.checkout_window_after_min} required dir="ltr" />
        </Field>
      </div>
    </>
  );
}
