"use client";

import { startTransition, useActionState } from "react";
import { Alert, buttonClass, inputClass } from "@/components/ui";

type State = { error?: string; ok?: boolean };

/** Note + approve / reject buttons for one request. */
export function DecisionForm({
  action,
  labels,
  errors,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  labels: { note: string; approve: string; reject: string; decided: string };
  errors: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});
  if (state.ok) return <Alert kind="success">{labels.decided}</Alert>;
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const formData = new FormData(e.currentTarget);
        formData.set("decision", submitter?.value ?? "");
        startTransition(() => formAction(formData));
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span>{labels.note}</span>
        <textarea name="note" maxLength={1000} rows={2} className={inputClass} />
      </label>
      {state.error && <Alert kind="error">{errors[state.error] ?? errors.generic}</Alert>}
      <div className="flex gap-2">
        <button type="submit" value="approve" disabled={pending} className={buttonClass.primary}>
          {labels.approve}
        </button>
        <button type="submit" value="reject" disabled={pending} className={buttonClass.danger}>
          {labels.reject}
        </button>
      </div>
    </form>
  );
}
