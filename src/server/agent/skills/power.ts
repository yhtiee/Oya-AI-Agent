import { z } from "zod";
import type { SkillDefinition } from "./types";

/* Power & light (SPEC §5.1). Status, reports, alerts and the units estimate. */

const Slots = z.object({
  area: z.string().max(80).optional(),
  status: z.enum(["on", "off"]).optional(),
  units: z.number().optional(),
  watch: z.enum(["power_on", "power_off"]).optional(),
});

export const power: SkillDefinition<z.infer<typeof Slots>> = {
  id: "power",
  phase: "1a",
  flag: "skill_power",
  jobType: "know",
  model: "simple",
  slots: Slots,
  requiredSlots: [],
  tools: [
    "get_power_status",
    "submit_power_report",
    "list_power_clusters",
    "estimate_units_days",
    "create_watch",
    "cancel_watch",
    "list_watches",
    "create_reminder",
    "record_preference",
  ],
  prompt: [
    "Tell people whether power ('light') is on in their power cluster, record their reports, set alerts, and estimate prepaid units.",
    "For any status question call get_power_status. The app shows the status card; say it in one short line using the card's words.",
    "Never present 'uncertain' or 'unknown' as on or off. If reporters are few, say so and invite the user to report with the buttons.",
    "If get_power_status says needsCluster, ask the user to pick their area from the card the app shows. Don't guess an area.",
    "If the user says light came or went, call submit_power_report with on/off. If it says too_soon, they reported in the last 10 minutes.",
    "'Tell me when light comes back' → create_watch power_on (the app asks them to confirm). 'Tell me when it goes' → power_off.",
    "Units: call estimate_units_days. If it says needsUsage, ask once: small flat (about 3 kWh a day) or family home (about 8). Then offer record_preference power_kwh_per_day. Always call the result an estimate. If daysLeft is 2 or less, offer a reminder to buy units (create_reminder).",
    "Never claim to be the DisCo. Never promise when light will return.",
  ].join("\n"),
  examples: [
    'User: "Light don come for Ewet?" → get_power_status. Reply (Pidgin): "See am for the card below. Na wetin neighbours dey report."',
    'User: "Light just go now" → submit_power_report(off). Reply: "Thanks, I don record am. E dey help your neighbours."',
    'User: "Tell me when light comes back" → create_watch(power_on). Reply: "I\'ve set it up below. Confirm and I\'ll tell you."',
    'User: "I have 34 units, how long?" → estimate_units_days(34). If needsUsage: "Is it a small flat or a family home?"',
  ],
  cardRules: [
    { tool: "get_power_status", card: "power_status" },
    { tool: "get_power_status", card: "cluster_picker" },
    { tool: "list_power_clusters", card: "cluster_picker" },
  ],
  statuses: ["draft", "completed"],
  timers: {},
  sortedCriteria: "The user got a status with its freshness, or a report or alert was recorded.",
  refusals: ["presenting uncertain status as on or off", "claiming to be the DisCo", "predicting restoration times"],
};
