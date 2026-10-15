import type { SkillId } from "../router-schema";
import { paperwork } from "./paperwork";
import type { SkillDefinition } from "./types";

/* Skills available in this build. The rest are routed but answered with "coming soon" until their milestone. */
export const SKILLS: Partial<Record<SkillId, SkillDefinition>> = {
  paperwork: paperwork as SkillDefinition,
};
