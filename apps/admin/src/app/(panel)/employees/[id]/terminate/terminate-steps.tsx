"use client";

import { startTransition, useActionState, useState } from "react";
import { Alert, buttonClass, Field, Input } from "@/components/ui";

type FormState = { error?: string; ok?: boolean };

type Texts = {
  step1: string;
  step2: string;
  step3: string;
  download: string;
  downloaded: string;
  deletesWhat: string;
  typeToConfirm: string;
  deleteForever: string;
  downloadFirst: string;
};

/** Download Excel, download PDF, then type the file number to delete. The server re-checks the downloads. */
export function TerminateSteps({
  id,
  fileNumber,
  t,
  errors,
  action,
}: {
  id: string;
  fileNumber: number;
  t: Texts;
  errors: Record<string, string>;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [got, setGot] = useState({ xlsx: false, pdf: false });
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ready = got.xlsx && got.pdf;

  const step = (format: "xlsx" | "pdf", label: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4">
      <span className="font-medium">{label}</span>
      <a
        href={`/employees/${id}/export/${format}`}
        download
        onClick={() => setGot((g) => ({ ...g, [format]: true }))}
        className={got[format] ? buttonClass.secondary : buttonClass.primary}
        data-testid={`download-${format}`}
      >
        {got[format] ? `✓ ${t.downloaded}` : t.download}
      </a>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {step("xlsx", t.step1)}
      {step("pdf", t.step2)}
      <form
        className="flex flex-col gap-3 rounded-xl border border-danger p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(() => formAction(fd));
        }}
      >
        <span className="font-medium">{t.step3}</span>
        <p className="text-sm text-muted">{t.deletesWhat}</p>
        <Field label={t.typeToConfirm}>
          <Input
            name="confirm"
            inputMode="numeric"
            dir="ltr"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={!ready}
            placeholder={String(fileNumber)}
          />
        </Field>
        {!ready && <p className="text-sm text-muted">{t.downloadFirst}</p>}
        {state.error && <Alert kind="error">{errors[state.error] ?? errors.generic}</Alert>}
        <div>
          <button
            type="submit"
            disabled={!ready || pending || typed.trim() !== String(fileNumber)}
            className={buttonClass.danger}
          >
            {t.deleteForever}
          </button>
        </div>
      </form>
    </div>
  );
}
