import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GroundingSources } from "./grounding";
import { template, type Lang } from "./templates";
import { executeConfirmation } from "./tools/registry";
import type { ToolContext } from "./tools/types";

/*
 * Confirm / decline a pending confirmation (SPEC §7.6). Used by "yes" in chat and by Confirm-card taps.
 * claim_confirmation succeeds once, so double taps, retries and cross-user ids can't run anything twice
 * (or at all, for someone else's confirmation).
 */

export type ConfirmOutcome = { ok: true; text: string; tool: string } | { ok: false; text: string };

type Claimed = {
  id: string;
  conversation_id: string;
  task_id: string | null;
  summary_text: string;
  action_payload: { tool: string; input: unknown };
};

export async function confirmAndExecute(input: {
  client: SupabaseClient;
  userId: string;
  confirmationId: string;
  language: Lang;
}): Promise<ConfirmOutcome> {
  const { client, userId, confirmationId, language } = input;
  const { data, error } = await client.rpc("claim_confirmation", {
    p_confirmation_id: confirmationId,
    p_user_id: userId,
  });
  if (error) throw new Error(`claim_confirmation failed: ${error.message}`);
  const claimed = (data as Claimed[] | null)?.[0];
  if (!claimed) return { ok: false, text: template("confirmationGone", language) };

  const ctx: ToolContext = {
    client,
    userId,
    conversationId: claimed.conversation_id,
    taskId: claimed.task_id,
    language,
    sources: new GroundingSources(),
    results: [],
    cards: [],
  };
  const done = await executeConfirmation(claimed, ctx);
  return { ok: true, text: template("confirmed", language), tool: done.tool };
}

export async function declineConfirmation(input: {
  client: SupabaseClient;
  userId: string;
  confirmationId: string;
  language: Lang;
}): Promise<ConfirmOutcome> {
  const { data, error } = await input.client
    .from("confirmations")
    .update({ status: "declined" })
    .eq("id", input.confirmationId)
    .eq("user_id", input.userId)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`decline failed: ${error.message}`);
  if (!data?.length) return { ok: false, text: template("confirmationGone", input.language) };
  return { ok: true, text: template("declined", input.language), tool: "decline" };
}
