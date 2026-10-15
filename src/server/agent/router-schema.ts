import { z } from "zod";

/*
 * Router output (SPEC §7.2 step 4). Written in the subset every provider's structured output accepts
 * (§10.1a): no unions, no records, slots as a JSON string the server parses and the skill re-validates.
 * Pure, so the eval runner and tests share it.
 */

export const SKILL_IDS = [
  "power",
  "paperwork",
  "get_help",
  "artisans",
  "food",
  "local_alerts",
  "reminders",
  "web_answers",
] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export const SAFETY_LABELS = ["ok", "emergency", "self_harm", "prohibited", "medical_advice"] as const;
export type SafetyLabel = (typeof SAFETY_LABELS)[number];

export const RouterOutput = z.object({
  language: z.enum(["en", "pcm", "ibb", "yo", "ig", "ha", "other"]),
  safety: z.enum(SAFETY_LABELS),
  safetyConfidence: z.number().min(0).max(1),
  scope: z.enum(["in_scope", "general_everyday", "off_scope"]),
  skill: z.enum(SKILL_IDS).nullable(),
  targetTaskId: z.string().nullable(),
  pendingConfirmationReply: z.enum(["yes", "no", "change", "none"]),
  intent: z.string().max(80),
  slotsJson: z.string().max(2000),
  confidence: z.number().min(0).max(1),
});
export type RouterOutput = z.infer<typeof RouterOutput>;

/** The bootstrap safety-only call (§20.1): just the label, so it fits in the reserved budget. */
export const SafetyOutput = z.object({
  safety: z.enum(SAFETY_LABELS),
  safetyConfidence: z.number().min(0).max(1),
});
export type SafetyOutput = z.infer<typeof SafetyOutput>;

/** Parses slotsJson leniently: anything that isn't a JSON object becomes {}. */
export function parseSlots(slotsJson: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(slotsJson || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A skill-less, safe default when the router can't run (button mode, outage). */
export const ROUTER_UNAVAILABLE: RouterOutput = {
  language: "en",
  safety: "ok",
  safetyConfidence: 0,
  scope: "in_scope",
  skill: null,
  targetTaskId: null,
  pendingConfirmationReply: "none",
  intent: "unknown",
  slotsJson: "{}",
  confidence: 0,
};
