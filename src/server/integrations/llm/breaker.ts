import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderName } from "./config";

/*
 * Circuit breaker reads (30-second in-memory cache per instance) and outcome reporting (SPEC §10.1a).
 * The state machine itself is public.llm_breaker_record in Postgres, so instances agree without the tick.
 */

export type BreakerState = "closed" | "open" | "half_open";

const TTL_MS = 30_000;
const cache = new Map<ProviderName, { state: BreakerState; openUntil: number | null; at: number }>();

function effective(entry: { state: BreakerState; openUntil: number | null }, now: number): BreakerState {
  // An open breaker past its open_until is half-open, even before the cache refreshes.
  if (entry.state === "open" && entry.openUntil !== null && entry.openUntil <= now) return "half_open";
  return entry.state;
}

export async function breakerState(client: SupabaseClient, provider: ProviderName): Promise<BreakerState> {
  const hit = cache.get(provider);
  const now = Date.now();
  if (hit && now - hit.at < TTL_MS) return effective(hit, now);

  const { data, error } = await client.rpc("llm_breaker_states");
  if (error) return hit ? effective(hit, now) : "closed"; // never block calls on a breaker read failure
  const rows = (data ?? []) as { provider: ProviderName; state: BreakerState; open_until: string | null }[];
  for (const row of rows) {
    cache.set(row.provider, {
      state: row.state,
      openUntil: row.open_until ? Date.parse(row.open_until) : null,
      at: now,
    });
  }
  // No row yet means the breaker has never tripped: closed. Always refresh the entry so it isn't re-read every call.
  if (!rows.some((r) => r.provider === provider)) cache.set(provider, { state: "closed", openUntil: null, at: now });
  return effective(cache.get(provider)!, now);
}

/** Half-open: 1 call in 10 is sent to the primary as a probe (§10.1a). */
export function shouldProbe(random: () => number = Math.random): boolean {
  return random() < 0.1;
}

export async function recordOutcome(
  client: SupabaseClient,
  provider: ProviderName,
  ok: boolean,
  probe: boolean,
): Promise<void> {
  const { data } = await client.rpc("llm_breaker_record", { p_provider: provider, p_ok: ok, p_probe: probe });
  if (typeof data === "string") {
    const prev = cache.get(provider);
    cache.set(provider, {
      state: data as BreakerState,
      openUntil: data === "open" ? Date.now() + 10 * 60_000 : (prev?.openUntil ?? null),
      at: Date.now(),
    });
  }
}

/** Tests only. */
export function resetBreakerCache() {
  cache.clear();
}
