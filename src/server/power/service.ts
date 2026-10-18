import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClusterPickerCard, PowerStatusCard } from "@/types/cards";
import type { Lang } from "../agent/templates";

/*
 * Power & light (SPEC §5.1). Shared by the chat tools and the card taps, so both apply the same rules.
 * The status algorithm itself lives in Postgres (compute_power_status); this reads and presents it.
 */

export type PowerStatusResult =
  | { needsCluster: true; clusters: { id: string; name: string }[] }
  | {
      needsCluster: false;
      area: { id: string; name: string };
      status: "on" | "off" | "uncertain" | "unknown";
      confidence: number;
      lastChangeAt: string | null;
      reportersCount: number;
      activeReporters7d: number;
      computedAt: string | null;
    };

export async function listClusters(
  client: SupabaseClient,
  query?: string,
  limit = 12,
): Promise<{ id: string; name: string }[]> {
  let q = client
    .from("areas")
    .select("id, name")
    .eq("kind", "power_cluster")
    .eq("active", true)
    .order("name")
    .limit(limit);
  if (query?.trim()) q = q.ilike("name", `%${query.trim().replace(/[%_]/g, "")}%`);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string }[];
}

/** The area to use: the one asked for if it's a cluster the user may see, else their saved cluster. */
async function resolveArea(client: SupabaseClient, userId: string, areaId?: string | null) {
  const id =
    areaId ??
    ((await client.from("profiles").select("power_area_id").eq("id", userId).single()).data?.power_area_id as
      string | null);
  if (!id) return null;
  const { data } = await client.from("areas").select("id, name, kind").eq("id", id).eq("active", true).maybeSingle();
  return data && data.kind === "power_cluster" ? { id: data.id as string, name: data.name as string } : null;
}

export async function getPowerStatus(
  client: SupabaseClient,
  userId: string,
  areaId?: string | null,
): Promise<PowerStatusResult> {
  const area = await resolveArea(client, userId, areaId);
  if (!area) return { needsCluster: true, clusters: await listClusters(client) };

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: s }, { data: reporters }] = await Promise.all([
    client
      .from("power_status")
      .select("status, confidence, last_change_at, reporters_count, computed_at")
      .eq("area_id", area.id)
      .maybeSingle(),
    client
      .from("power_reports")
      .select("reporter_user_id")
      .eq("area_id", area.id)
      .gte("reported_at", since)
      .limit(1000),
  ]);
  const active = new Set((reporters ?? []).map((r) => r.reporter_user_id).filter(Boolean)).size;
  return {
    needsCluster: false,
    area,
    status: (s?.status as "on" | "off" | "uncertain" | "unknown" | undefined) ?? "unknown",
    confidence: Number(s?.confidence ?? 0),
    lastChangeAt: (s?.last_change_at as string | null) ?? null,
    reportersCount: Number(s?.reporters_count ?? 0),
    activeReporters7d: active,
    computedAt: (s?.computed_at as string | null) ?? null,
  };
}

/** Confidence in words (SPEC §7.8: "Always put tool-reported uncertainty into words"). Never says on/off when unsure. */
export function confidenceText(status: string, confidence: number, lang: Lang): string {
  if (status === "unknown") return lang === "pcm" ? "No recent report" : "No recent reports";
  if (status === "uncertain") return lang === "pcm" ? "Reports no agree" : "Reports disagree";
  if (confidence >= 0.9) return lang === "pcm" ? "Most neighbours agree" : "Most neighbours agree";
  if (confidence >= 0.7) return lang === "pcm" ? "Many neighbours agree" : "Fairly sure";
  return lang === "pcm" ? "No too sure" : "Not very sure";
}

export function buildPowerCard(r: Extract<PowerStatusResult, { needsCluster: false }>, lang: Lang): PowerStatusCard {
  const asOf = r.computedAt ?? new Date().toISOString();
  return {
    type: "power_status",
    id: crypto.randomUUID(),
    areaId: r.area.id,
    areaName: r.area.name,
    status: r.status,
    confidenceText: confidenceText(r.status, r.confidence, lang),
    lastChangeAt: r.lastChangeAt ? new Date(r.lastChangeAt).toISOString() : null,
    reportersCount: r.reportersCount,
    fewReporters: r.activeReporters7d < 3,
    source: {
      label: r.reportersCount === 1 ? "Reported by 1 neighbour" : `Reported by ${r.reportersCount} neighbours`,
      asOf: new Date(asOf).toISOString(),
      attribution: "none",
      verified: true,
    },
  };
}

export function buildClusterPicker(clusters: { id: string; name: string }[], lang: Lang): ClusterPickerCard {
  return {
    type: "cluster_picker",
    id: crypto.randomUUID(),
    clusters: clusters.slice(0, 12),
    note: clusters.length
      ? lang === "pcm"
        ? "Which one be your area? Pick am once, I go remember."
        : "Which is your area? Pick it once and I'll remember."
      : lang === "pcm"
        ? "We never map areas for here yet. Our team dey work on am."
        : "We haven't mapped power areas here yet. Our team is on it.",
  };
}

export type ReportOutcome = "recorded" | "too_soon" | "rate_limited" | "no_cluster";

/** A one-tap report (SPEC §5.1): at most one per user per cluster per 10 minutes. */
export async function reportPower(
  client: SupabaseClient,
  userId: string,
  status: "on" | "off",
  areaId?: string | null,
): Promise<{ result: ReportOutcome; changed: boolean }> {
  const { data, error } = await client.rpc("submit_power_report_for", {
    p_user_id: userId,
    p_status: status,
    p_area_id: areaId ?? null,
    p_via: "app",
  });
  if (error) throw new Error(`report failed: ${error.message}`);
  const r = data as { result: ReportOutcome; changed?: boolean };
  return { result: r.result, changed: Boolean(r.changed) };
}

export async function setPowerCluster(
  client: SupabaseClient,
  userId: string,
  areaId: string,
): Promise<{ id: string; name: string }> {
  const { data: area } = await client.from("areas").select("id, name, kind, active").eq("id", areaId).maybeSingle();
  if (!area || area.kind !== "power_cluster" || !area.active) throw new Error("not an active power area");
  const { error } = await client.from("profiles").update({ power_area_id: areaId }).eq("id", userId);
  if (error) throw new Error(error.message);
  return { id: area.id as string, name: area.name as string };
}

/** Watches for power coming back / going off in a cluster (SPEC §5.7). Reuses an active watch of the same kind. */
export async function createPowerWatch(
  client: SupabaseClient,
  userId: string,
  type: "power_on" | "power_off",
  areaId: string,
): Promise<{ id: string; created: boolean }> {
  const { data: existing } = await client
    .from("watches")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("area_id", areaId)
    .eq("active", true)
    .maybeSingle();
  if (existing) return { id: existing.id as string, created: false };
  const { data, error } = await client
    .from("watches")
    .insert({ user_id: userId, type, area_id: areaId })
    .select("id")
    .single();
  if (error) throw new Error(error.code === "23514" ? "You already have 10 active alerts." : error.message);
  return { id: data.id as string, created: true };
}

export async function cancelWatch(client: SupabaseClient, userId: string, watchId: string): Promise<boolean> {
  const { data } = await client
    .from("watches")
    .update({ active: false })
    .eq("id", watchId)
    .eq("user_id", userId)
    .select("id");
  return Boolean(data?.length);
}
