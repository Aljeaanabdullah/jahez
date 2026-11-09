import type { ReactNode } from "react";
import { PrefsButtons } from "./prefs-buttons";
import type { Dictionary, Theme } from "@/lib/i18n";

/** Centered card used by the sign-in and change-password screens. */
export function AuthCard({
  t,
  theme,
  title,
  children,
}: {
  t: Dictionary;
  theme: Theme;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <PrefsButtons t={t} theme={theme} />
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-center text-3xl font-bold text-primary">{t.appName}</p>
        <h1 className="mt-2 mb-6 text-center text-lg">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary";
export const primaryButtonClass =
  "w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-on-primary hover:opacity-90 disabled:opacity-60";
