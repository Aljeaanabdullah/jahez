import type { ComponentProps, ReactNode } from "react";

// Small shared building blocks for the panel screens.

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>{children}</section>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export const buttonClass = {
  primary: "rounded-lg bg-primary px-4 py-2 font-medium text-on-primary hover:opacity-90 disabled:opacity-60",
  secondary: "rounded-lg border border-line px-4 py-2 hover:bg-primary-soft disabled:opacity-60",
  danger: "rounded-lg border border-danger px-4 py-2 text-danger hover:bg-danger-soft disabled:opacity-60",
};

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const cls =
    kind === "error" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary";
  return (
    <p role={kind === "error" ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm ${cls}`}>
      {children}
    </p>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "off"; children: ReactNode }) {
  const cls = tone === "ok" ? "bg-primary-soft text-primary" : "bg-line text-muted";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-start [&_th]:font-medium [&_th]:text-muted [&_thead]:bg-background [&_tr]:border-b [&_tr]:border-line [&_tbody_tr:last-child]:border-0">
        {children}
      </table>
    </div>
  );
}
