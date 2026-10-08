import "server-only";
import { hasServiceClient, getServiceClient } from "./db/service-client";
import { getEnv } from "./env";
import { evaluateFlag, type FlagContext, type FlagRow } from "./flags/rules";

/** Every flag key the code knows about (SPEC §20). Seeded by the feature_flags migration. */
export const FLAG_KEYS = [
  // Phase 1a
  "skill_power",
  "skill_paperwork",
  "skill_get_help",
  "skill_artisans",
  "skill_food",
  "local_alerts",
  "reminders",
  "watches",
  "whatsapp_provider_channel",
  "whatsapp_user_notifications",
  "voice_notes",
  "web_answers",
  "kb_web_fallback",
  "unverified_fallback",
  "llm_fallback",
  "bootstrap_mode",
  "phone_otp",
  // Phase 1b
  "payments",
  "telegram_channel",
  "visitor_mode",
  "offline_outbox",
  "provider_team",
  "power_typical_return",
  "handoff_rides",
  "whatsapp_user_requests",
  "missed_call_reports",
  "provider_voice_alerts",
  // Phase 2+
  "guarantee",
  "autonomy",
  "provider_tools",
  "lang_ibb",
  "voice_local_languages",
  "group_requests",
  "kb_vectors",
  "ai_calls",
  "escrow",
  "missions",
  "health_stock_check",
  "insights",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

const TTL_MS = 30_000;
let cache: { at: number; rows: Map<string, FlagRow> } | undefined;

async function loadFlags(): Promise<Map<string, FlagRow>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  if (!hasServiceClient()) return new Map();

  const { data, error } = await getServiceClient().from("feature_flags").select("key, enabled, rules");
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "feature_flags load failed", error: error.message }));
    // Keep serving the last good copy rather than flipping everything off on a blip.
    return cache?.rows ?? new Map();
  }
  cache = { at: Date.now(), rows: new Map(data.map((row) => [row.key, row as FlagRow])) };
  return cache.rows;
}

/**
 * Is this feature on for this context? Fails closed: unknown flags, a missing service key
 * or an unreachable database all mean "off" (R12).
 */
export async function isEnabled(key: FlagKey, ctx: Omit<FlagContext, "env"> = {}): Promise<boolean> {
  const env = getEnv();
  // BOOTSTRAP_MODE mirrors the flag for boot-time config (SPEC §21.3).
  if (key === "bootstrap_mode" && env.BOOTSTRAP_MODE !== undefined) return env.BOOTSTRAP_MODE;
  const rows = await loadFlags();
  return evaluateFlag(rows.get(key), { ...ctx, env: env.APP_ENV });
}

/** For tests and the ops console after an update. */
export function clearFlagCache() {
  cache = undefined;
}
