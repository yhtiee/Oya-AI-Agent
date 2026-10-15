"use server";

import { z } from "zod";
import { confirmAndExecute, declineConfirmation } from "../agent/confirmations";
import { getServiceClient } from "../db/service-client";
import { authedAction } from "./authed-action";

/*
 * Confirm-card taps (SPEC §7.6). The confirmation id comes from the card; claim_confirmation checks it belongs to
 * this user and is still pending, so a tapped id from someone else's card does nothing (R13).
 * The reply is stored as an assistant message so it survives a reload.
 */

const Input = z.object({ confirmationId: z.string().uuid(), decision: z.enum(["confirm", "decline"]) });

export const answerConfirmation = authedAction(Input, async ({ confirmationId, decision }, { session }) => {
  const client = getServiceClient();
  const language = session.language === "pcm" ? "pcm" : "en";
  const fn = decision === "confirm" ? confirmAndExecute : declineConfirmation;
  const result = await fn({ client, userId: session.userId, confirmationId, language });

  const { data: conf } = await client
    .from("confirmations")
    .select("conversation_id")
    .eq("id", confirmationId)
    .eq("user_id", session.userId)
    .maybeSingle();
  if (conf) {
    await client.from("messages").insert({
      conversation_id: conf.conversation_id,
      role: "assistant",
      channel: "web",
      text: result.text,
      status: "sent",
    });
  }
  return { ok: result.ok, text: result.text };
});
