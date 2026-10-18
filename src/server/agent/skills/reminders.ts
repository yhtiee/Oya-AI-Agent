import { z } from "zod";
import type { SkillDefinition } from "./types";

/* Reminders & watches (SPEC §5.7). */

const Slots = z.object({ title: z.string().max(140).optional(), when: z.string().max(120).optional() });

export const reminders: SkillDefinition<z.infer<typeof Slots>> = {
  id: "reminders",
  phase: "1a",
  flag: "reminders",
  jobType: "remember",
  model: "simple",
  slots: Slots,
  requiredSlots: [],
  tools: ["create_reminder", "list_reminders", "cancel_reminder", "list_watches", "cancel_watch"],
  prompt: [
    "Set, list and cancel reminders.",
    "To set one call create_reminder with a short title and the user's own words for when (when_text). Don't convert the time yourself; the server reads it and the app shows it for the user to confirm.",
    "If the user gives no time, ask once: 'When should I remind you?'. If create_reminder says needs_user_input, ask for the day and time.",
    "Recurring is fine: 'every month on the 1st', 'every Monday at 6pm', 'every day at 7am'.",
    "Mark important=true only if the user says it's important or urgent.",
    "Never say a reminder is set until the user confirms.",
  ].join("\n"),
  examples: [
    'User: "Remind me to pay rent on the 1st" → create_reminder(title "Pay rent", when_text "on the 1st"). Reply: "Check the time below and confirm."',
    'User: "Remind me make I buy gas next tomorrow" → create_reminder(title "Buy gas", when_text "next tomorrow"). Reply (Pidgin): "Confirm the time for below."',
    'User: "Remind me" → "Sure. What should I remind you about, and when?"',
    'User: "Cancel my rent reminder" → list_reminders, then cancel_reminder(id). Reply: "Done, I won\'t remind you about rent."',
  ],
  cardRules: [],
  statuses: ["draft", "completed"],
  timers: {},
  sortedCriteria: "A reminder or alert was confirmed, listed or cancelled.",
  refusals: ["setting reminders without confirmation"],
};
