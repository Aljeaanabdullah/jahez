"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/app/actions/auth";
import { errorMessage, type Dictionary } from "@/lib/i18n";
import { inputClass, primaryButtonClass } from "@/components/auth-card";

export function ChangePasswordForm({ t }: { t: Dictionary }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm">{t.changePasswordIntro}</p>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{t.newPassword}</span>
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          dir="ltr"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm">{t.confirmPassword}</span>
        <input
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          dir="ltr"
          className={inputClass}
        />
      </label>
      <p className="text-xs text-muted">{t.passwordRules}</p>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errorMessage(t, state.error)}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? t.saving : t.save}
      </button>
    </form>
  );
}
