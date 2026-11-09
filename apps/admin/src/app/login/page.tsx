import { redirect } from "next/navigation";
import { getPrefs } from "@/lib/prefs";
import { getCurrentEmployee } from "@/lib/auth";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const me = await getCurrentEmployee();
  if (me && me.role !== "employee") {
    redirect(me.mustChangePassword ? "/change-password" : "/");
  }
  const { t, theme } = await getPrefs();
  return (
    <AuthCard t={t} theme={theme} title={t.panelTitle}>
      <LoginForm t={t} />
    </AuthCard>
  );
}
