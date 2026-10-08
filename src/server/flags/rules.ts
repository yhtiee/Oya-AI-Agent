import { z } from "zod";
import type { AppEnv } from "../env.schema";

/** Shape of `feature_flags.rules`. Every field is optional; an empty object means "no extra conditions". */
export const flagRulesSchema = z
  .object({
    /** Only on in these environments. */
    env: z.array(z.enum(["development", "staging", "production", "test"])).optional(),
    /** Targeting: on for these users… */
    user_ids: z.array(z.uuid()).optional(),
    /** …or for users in these areas… */
    area_ids: z.array(z.uuid()).optional(),
    /** …or for this share of users (stable per user and flag). */
    percentage: z.number().min(0).max(100).optional(),
  })
  .strict();

export type FlagRules = z.infer<typeof flagRulesSchema>;

export type FlagRow = { key: string; enabled: boolean; rules: unknown };

export type FlagContext = {
  env: AppEnv;
  userId?: string | null;
  areaId?: string | null;
};

/**
 * A flag is on when it's enabled, the environment matches, and (if any targeting is set)
 * the user matches at least one target. Malformed rules fail closed.
 */
export function evaluateFlag(flag: FlagRow | undefined, ctx: FlagContext): boolean {
  if (!flag?.enabled) return false;

  const parsed = flagRulesSchema.safeParse(flag.rules ?? {});
  if (!parsed.success) return false;
  const rules = parsed.data;

  if (rules.env && !rules.env.includes(ctx.env)) return false;

  const targeted = rules.user_ids !== undefined || rules.area_ids !== undefined || rules.percentage !== undefined;
  if (!targeted) return true;

  if (ctx.userId && rules.user_ids?.includes(ctx.userId)) return true;
  if (ctx.areaId && rules.area_ids?.includes(ctx.areaId)) return true;
  if (ctx.userId && rules.percentage !== undefined) return bucket(flag.key, ctx.userId) < rules.percentage;
  return false;
}

/** Stable 0–99 bucket for a user and flag (FNV-1a), so a rollout doesn't flicker between requests. */
export function bucket(flagKey: string, userId: string): number {
  let hash = 0x811c9dc5;
  for (const ch of `${flagKey}:${userId}`) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}
