"use server";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; ok?: boolean };
const KNOWN = ["not_allowed", "check_in_first", "note_too_long", "not_found"];

/** Approve or reject a request at its current stage. The server decides who may do this (PRD 7.2). */
export async function decideRequest(requestId: string, _prev: State, formData: FormData): Promise<State> {
  await requireStaff();
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_request", {
    p_request: requestId,
    p_approve: approve,
    p_note: note || null,
  });
  if (error) return { error: KNOWN.find((k) => error.message.includes(k)) ?? "generic" };
  // No revalidation here: the card stays with its "saved" message; the list is fresh on the next visit.
  return { ok: true };
}
