"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { Alert, buttonClass } from "./ui";

type FormState = { error?: string; ok?: boolean };
type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * A form bound to a server action, with an error / "saved" message and a pending button.
 * With `resetOnSuccess`, the fields are cleared after each successful save (for "add" forms).
 */
export function ActionForm({
  action,
  submitLabel,
  savedLabel,
  errors,
  children,
  className = "flex flex-col gap-4",
  testId,
  resetOnSuccess = false,
}: {
  action: Action;
  submitLabel: string;
  savedLabel?: string;
  errors: Record<string, string>;
  children: ReactNode;
  className?: string;
  testId?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState & { saves?: number }, FormData>(
    async (prev, formData) => {
      const result = await action(prev, formData);
      return { ...result, saves: (prev.saves ?? 0) + (result.ok ? 1 : 0) };
    },
    {},
  );
  return (
    // Submitted through onSubmit (not `action=`) so React does not clear the fields
    // when the server refuses the input: the user fixes the mistake instead of retyping.
    <form
      className={className}
      data-testid={testId}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      <div key={resetOnSuccess ? (state.saves ?? 0) : 0} className="contents">
        {children}
      </div>
      {state.error && <Alert kind="error">{errors[state.error] ?? errors.generic}</Alert>}
      {state.ok && savedLabel && <Alert kind="success">{savedLabel}</Alert>}
      <div>
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Delete button that asks for confirmation and shows why a delete was refused. */
export function DeleteButton({
  action,
  label,
  confirmText,
  errors,
}: {
  action: (prev: FormState) => Promise<FormState>;
  label: string;
  confirmText: string;
  errors: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState<FormState>(action, {});
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
      className="flex flex-col items-start gap-2"
    >
      <button type="submit" disabled={pending} className={buttonClass.danger}>
        {label}
      </button>
      {state.error && <Alert kind="error">{errors[state.error] ?? errors.generic}</Alert>}
    </form>
  );
}
