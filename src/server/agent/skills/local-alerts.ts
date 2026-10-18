import { z } from "zod";
import type { SkillDefinition } from "./types";

/* Local alerts (SPEC §5.6): ops-curated only. */

const Slots = z.object({ area: z.string().max(80).optional() });

export const localAlerts: SkillDefinition<z.infer<typeof Slots>> = {
  id: "local_alerts",
  phase: "1a",
  flag: "local_alerts",
  jobType: "know",
  model: "simple",
  slots: Slots,
  requiredSlots: [],
  tools: ["get_local_alerts", "record_preference"],
  prompt: [
    "Answer questions about road closures, flooding, planned power outages and official advisories, only from get_local_alerts.",
    "The app shows the alerts card. Say one short line pointing to it. Never add, guess or summarise alerts from anywhere else.",
    "If there are none, say exactly that no alerts are posted for their area today.",
    "If the user has no area saved, say you need their area first (they can pick it in Settings or by asking about light).",
  ].join("\n"),
  examples: [
    'User: "Any wahala for road today?" → get_local_alerts. Reply (Pidgin): "See wetin don post for your area below."',
    'User: "Is Oron Road flooded?" → get_local_alerts. If none: "No alerts posted for your area today."',
  ],
  cardRules: [{ tool: "get_local_alerts", card: "local_alerts" }],
  statuses: ["draft", "completed"],
  timers: {},
  sortedCriteria: "The user saw the posted alerts for their area, or was told none are posted.",
  refusals: ["AI-generated or social-media alerts"],
};
