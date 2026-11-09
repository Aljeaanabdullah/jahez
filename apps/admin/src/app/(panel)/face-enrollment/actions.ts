"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MODEL_VERSION } from "@/lib/face/engine-constants";

export type EnrollResult = { ok?: boolean; error?: string; fileNumber?: number };

/** Sends the three photos and descriptors to the enroll-face Edge Function, as the signed-in HR user. */
export async function enrollFace(
  employeeId: string,
  photos: string[],
  descriptors: number[][],
): Promise<EnrollResult> {
  const me = await requireStaff();
  if (me.role !== "hr") return { error: "hr_only" };

  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { error: "generic" };

  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enroll-face`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ employee_id: employeeId, source: "web", model_version: MODEL_VERSION, photos, descriptors }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string; file_number?: number };
  revalidatePath("/face-enrollment");
  if (!res.ok) return { error: body.error ?? "generic", fileNumber: body.file_number };
  return { ok: true };
}
