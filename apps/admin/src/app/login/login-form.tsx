"use client";

import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions/auth";
import { errorMessage, type Dictionary } from "@/lib/i18n";
import { inputClass, primaryButtonClass } from "@/components/auth-card";

export function LoginForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{t.fileNumber}</span>
        <input
          name="fileNumber"
          inputMode="numeric"
          autoComplete="username"
          pattern="\d{6}"
          maxLength={6}
          defaultValue={state.fileNumber}
          key={state.fileNumber ?? ""}
          required
          dir="ltr"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{t.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className={inputClass}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(t, state.error)}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? t.signingIn : t.signIn}
      </button>
    </form>
  );
}
