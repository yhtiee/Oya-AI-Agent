import { z } from "zod";
import type { SkillDefinition } from "./types";

/*
 * M3 stub skill: answers only from published, verified guides (kb_documents) and can propose remembering a
 * preference (to exercise confirmations end to end). The full paperwork skill (checklists, reminders, the
 * KB-gap path) arrives in M5 with verified content.
 */

const Slots = z.object({ process: z.string().max(60).optional() });

export const paperwork: SkillDefinition<z.infer<typeof Slots>> = {
  id: "paperwork",
  phase: "1a",
  flag: "skill_paperwork",
  jobType: "know",
  model: "simple",
  slots: Slots,
  requiredSlots: [],
  tools: [
    "list_kb_documents",
    "get_kb_document",
    "search_kb_text",
    "record_preference",
    "escalate_to_human",
    "get_user_context",
  ],
  prompt: [
    "Help with Nigerian government processes (NIN, passport, driver's licence, vehicle papers, CAC business name, tax ID).",
    "Answer ONLY from guides returned by get_kb_document. Find the slug with list_kb_documents or search_kb_text first.",
    "If a guide exists, say one short line and let the card show the fees, steps and links. Don't repeat fees in text.",
    "If no guide exists, say plainly that Oya hasn't checked this process yet and offer a teammate (escalate_to_human with reason kb_gap).",
    "Never ask for or repeat NIN, BVN, passport numbers or document scans. Never recommend agents or touts.",
    "Say 'official fee' and warn that anyone charging more isn't official.",
    "If the user states a lasting preference (e.g. 'always answer in Pidgin'), you may propose record_preference.",
  ].join("\n"),
  examples: [
    'User: "How much is passport renewal?" → call search_kb_text("passport renewal"), then get_kb_document(slug). Reply: "Here\'s the official process and fee. Pay only on the official portal."',
    'User: "Wetin I need for driver licence?" → list_kb_documents, then get_kb_document. Reply (Pidgin): "See wetin you need below. Na only the official fee you go pay."',
    'User: "How do I get a C of O?" (no guide) → escalate_to_human(kb_gap). Reply: "Oya hasn\'t checked that process yet. I\'ve asked a teammate to look into it."',
    'User: "Always talk to me in Pidgin" → record_preference(language, pcm). Reply: "I go ask you to confirm am below."',
  ],
  cardRules: [{ tool: "get_kb_document", card: "info" }],
  statuses: ["draft", "completed"],
  timers: {},
  sortedCriteria: "The question was answered from a verified guide, or a teammate was asked to check a missing one.",
  refusals: ["filling or submitting forms", "agents or touts", "collecting ID numbers"],
};
