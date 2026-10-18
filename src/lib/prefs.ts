import { z } from "zod";

/*
 * profiles.prefs (SPEC §12.2, §7.7): structured memory only. Every field optional; unknown keys are kept so
 * nothing a newer build wrote is lost by an older one. Shared by the server and the settings UI.
 */

export const Prefs = z
  .object({
    power: z
      .object({
        kwh_per_day: z.number().positive().max(200).optional(),
        overnight_alerts: z.boolean().optional(),
      })
      .partial()
      .optional(),
    notifications: z
      .object({
        /** Morning local-alerts digest, push / in-app only, only on days with an alert (SPEC §5.6). */
        alerts_digest: z.boolean().optional(),
      })
      .partial()
      .optional(),
    language: z.enum(["en", "pcm"]).optional(),
    notification_channel: z.string().max(40).optional(),
    budget_default_kobo: z.string().max(20).optional(),
    overnight_power_alerts: z.string().max(10).optional(),
  })
  .passthrough();
export type Prefs = z.infer<typeof Prefs>;

export function parsePrefs(raw: unknown): Prefs {
  const r = Prefs.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/** Deep-merges a patch into prefs (one level of nesting is all prefs use). */
export function mergePrefs(current: unknown, patch: Partial<Prefs>): Prefs {
  const base = parsePrefs(current) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...((base[k] as object) ?? {}), ...v } : v;
  }
  return Prefs.parse(out);
}
