import "server-only";
import { generateStructured, type LlmMeta } from "../integrations/llm";
import type { TurnContext } from "./context";
import { loadPrompt } from "./prompts";
import { routerMessages } from "./router-input";
import {
  RouterOutput,
  SafetyOutput,
  type RouterOutput as Routed,
  type SafetyOutput as SafetyLabel,
} from "./router-schema";

/*
 * Router (SPEC §7.2 step 4): one structured call labelling language, safety, scope, skill, the reply to a
 * pending confirmation, and slots. The model sees redacted text only (R14).
 */

const YES = /^(yes|yeah|yep|yes please|ok|okay|oya|go ahead|do am|sure|confirm|na so|abeg do am)[.!]*$/i;
const NO = /^(no|nope|cancel|leave am|no need|abeg no|stop)[.!]*$/i;

/**
 * Short yes/no replies to a pending confirmation don't need a model call (tap first, AI second, §20.1).
 * Returns null when the router is needed.
 */
export function quickRoute(text: string, ctx: Pick<TurnContext, "pendingConfirmation" | "language">): Routed | null {
  if (!ctx.pendingConfirmation) return null;
  const t = text.trim();
  const reply = YES.test(t) ? "yes" : NO.test(t) ? "no" : null;
  if (!reply) return null;
  return {
    language: ctx.language,
    safety: "ok",
    safetyConfidence: 1,
    scope: "in_scope",
    skill: null,
    targetTaskId: null,
    pendingConfirmationReply: reply,
    intent: reply === "yes" ? "confirm" : "decline",
    slotsJson: "{}",
    confidence: 1,
  };
}

export async function routeMessage(text: string, ctx: TurnContext, meta: LlmMeta): Promise<Routed> {
  const out = await generateStructured(
    { purpose: "router", schema: RouterOutput, system: loadPrompt("router"), messages: routerMessages(text, ctx) },
    meta,
  );
  // Never trust a task id the model produced: it must be one of the user's active tasks.
  if (out.targetTaskId && !ctx.activeTasks.some((t) => t.id === out.targetTaskId)) out.targetTaskId = null;
  if (!ctx.pendingConfirmation) out.pendingConfirmationReply = "none";
  if (out.scope !== "in_scope") out.skill = null;
  return out;
}

/** The safety-only call used in button mode (§20.1). */
export async function classifySafety(text: string, meta: LlmMeta): Promise<SafetyLabel> {
  return generateStructured(
    {
      purpose: "safety_classifier",
      schema: SafetyOutput,
      system: loadPrompt("safety"),
      messages: [{ role: "user", content: text }],
      maxOutputTokens: 800,
    },
    meta,
  );
}
