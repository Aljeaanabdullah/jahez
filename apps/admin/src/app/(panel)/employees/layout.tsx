import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";

export default async function EmployeesLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <div className="flex flex-col gap-5">{children}</div>;
}
