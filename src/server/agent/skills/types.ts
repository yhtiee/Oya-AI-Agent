import type { z } from "zod";
import type { TaskStatus } from "../../tasks/transitions";
import type { TimerName } from "../../tasks/timers";
import type { SkillId } from "../router-schema";

/* Skill definition (SPEC §7.4). Skills never call providers, payments or messaging directly; they call tools. */

export type CardRule = { tool: string; card: "info" };

export interface SkillDefinition<Slots = Record<string, unknown>> {
  id: SkillId;
  phase: "1a" | "1b" | "2" | "3";
  flag: string;
  jobType: "know" | "get_done" | "book" | "find" | "remember" | "get_help" | "buy_pay";
  model: "simple" | "complex";
  slots: z.ZodType<Slots>;
  requiredSlots: (keyof Slots)[];
  tools: string[];
  prompt: string;
  /** Short worked examples for the cached prefix (Appendix C). */
  examples: string[];
  cardRules: CardRule[];
  statuses: TaskStatus[];
  timers: Partial<Record<TimerName, number>>;
  sortedCriteria: string;
  refusals: string[];
}
