import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { getCurrentEmployee } from "@/lib/auth";
import { AuthCard } from "@/components/auth-card";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const me = await getCurrentEmployee();
  if (!me || me.role === "employee") redirect("/login");
  const { t, theme } = await getPrefs();
  return (
    <AuthCard t={t} theme={theme} title={t.changePasswordTitle}>
      <ChangePasswordForm t={t} />
    </AuthCard>
  );
}
