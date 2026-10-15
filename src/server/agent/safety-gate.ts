import type { EmergencyMatch } from "@/lib/safety/emergency";
import type { RouterOutput } from "./router-schema";

/*
 * Safety gate (SPEC §7.2 step 5, §15.4). Combines the keyword pre-filter with the router's label.
 * Pure, so the eval runner checks exactly this logic.
 *
 *   emergency ≥ 0.7         → EmergencyCard, stop
 *   emergency < 0.7         → EmergencyCard alongside the normal reply
 *   self_harm               → supportive flow, stop (text kept only in safety_events)
 *   prohibited              → fixed refusal
 *   medical_advice          → Get help redirect, no advice
 *
 * The keyword pre-filter can only add safety, never remove it: a keyword emergency shows the card even if the
 * router says ok, and a keyword self-harm match starts the supportive flow on its own.
 */

export type GateDecision =
  | { action: "emergency_stop" }
  | { action: "emergency_and_continue" }
  | { action: "self_harm" }
  | { action: "prohibited" }
  | { action: "medical_redirect" }
  | { action: "continue" };

export function safetyGate(
  prefilter: EmergencyMatch,
  routed: Pick<RouterOutput, "safety" | "safetyConfidence"> | null,
): GateDecision {
  if (prefilter?.kind === "self_harm" || routed?.safety === "self_harm") return { action: "self_harm" };
  if (routed?.safety === "emergency") {
    return routed.safetyConfidence >= 0.7 ? { action: "emergency_stop" } : { action: "emergency_and_continue" };
  }
  if (prefilter?.kind === "emergency") return { action: "emergency_and_continue" };
  if (routed?.safety === "prohibited") return { action: "prohibited" };
  if (routed?.safety === "medical_advice") return { action: "medical_redirect" };
  return { action: "continue" };
}

/** True if this decision means an EmergencyCard is shown (for logging safety_events). */
export function showsEmergencyCard(d: GateDecision): boolean {
  return d.action === "emergency_stop" || d.action === "emergency_and_continue";
}
