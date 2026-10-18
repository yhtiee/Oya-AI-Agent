import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LocalAlertsCard } from "@/types/cards";

/* Local alerts (SPEC §5.6): ops-entered from verified sources only; never AI-written or AI-summarised. */

export type AlertRow = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "severe";
  starts_at: string;
  ends_at: string | null;
  source_url: string;
};

/** Alerts for an area (default: the user's cluster) and every area containing it. */
export async function alertsForUser(
  client: SupabaseClient,
  userId: string,
  areaId?: string | null,
): Promise<{ area: { id: string; name: string } | null; alerts: AlertRow[] }> {
  const id =
    areaId ??
    ((await client.from("profiles").select("power_area_id").eq("id", userId).single()).data?.power_area_id as
      string | null);
  if (!id) return { area: null, alerts: [] };
  const [{ data: area }, { data: alerts, error }] = await Promise.all([
    client.from("areas").select("id, name").eq("id", id).maybeSingle(),
    client.rpc("local_alerts_for_area", { p_area_id: id, p_ahead_hours: 72 }),
  ]);
  if (error) throw new Error(`local alerts failed: ${error.message}`);
  return {
    area: area ? { id: area.id as string, name: area.name as string } : null,
    alerts: (alerts ?? []) as AlertRow[],
  };
}

export function buildAlertsCard(areaName: string, alerts: AlertRow[]): LocalAlertsCard {
  return {
    type: "local_alerts",
    id: crypto.randomUUID(),
    areaName,
    alerts: alerts.slice(0, 5).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      severity: a.severity,
      startsAt: new Date(a.starts_at).toISOString(),
      endsAt: a.ends_at ? new Date(a.ends_at).toISOString() : null,
      sourceUrl: a.source_url,
    })),
    source: {
      label: "Posted by Oya from official sources",
      asOf: new Date().toISOString(),
      attribution: "none",
      verified: true,
    },
  };
}
