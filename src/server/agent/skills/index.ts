import type { SkillId } from "../router-schema";
import { localAlerts } from "./local-alerts";
import { paperwork } from "./paperwork";
import { power } from "./power";
import { reminders } from "./reminders";
import type { SkillDefinition } from "./types";

/* Skills available in this build, each behind its flag. The rest are routed but answered with "coming soon". */
export const SKILLS: Partial<Record<SkillId, SkillDefinition>> = {
  paperwork: paperwork as SkillDefinition,
  power: power as SkillDefinition,
  reminders: reminders as SkillDefinition,
  local_alerts: localAlerts as SkillDefinition,
};
