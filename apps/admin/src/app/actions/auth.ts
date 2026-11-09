"use server";

import { redirect } from "next/navigation";
import { createClient, emailFor } from "@/lib/supabase/server";

export type FormState = { error?: string; fileNumber?: string };

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const fileNumber = String(formData.get("fileNumber") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fail = (error: string): FormState => ({ error, fileNumber });
  if (!/^\d{6}$/.test(fileNumber)) return fail("invalid_file_number");
  if (!password) return fail("invalid_credentials");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailFor(fileNumber),
    password,
  });
  if (error || !data.user) return fail("invalid_credentials");

  const { data: me } = await supabase
    .from("employees")
    .select("role, is_active, must_change_password")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!me || !me.is_active) {
    await supabase.auth.signOut();
    return fail("account_disabled");
  }
  if (me.role === "employee") {
    await supabase.auth.signOut();
    return fail("employee_web_denied");
  }

  redirect(me.must_change_password ? "/change-password" : "/");
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (newPassword !== confirm) return { error: "mismatch" };

  const supabase = await createClient();
  const { data: session } = await supabase.auth.getSession();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user || !session.session) redirect("/login");

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/change-password`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ new_password: newPassword }),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { error: body.error ?? "generic" };
  }

  // The password changed, so sign in again with it to get a fresh session.
  const { data: me } = await supabase.from("employees").select("file_number").eq("user_id", user.user.id).single();
  if (me) {
    await supabase.auth.signInWithPassword({ email: emailFor(me.file_number), password: newPassword });
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
