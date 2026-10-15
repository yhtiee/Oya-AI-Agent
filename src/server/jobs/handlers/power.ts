import "server-only";
import type { JobHandler } from "../types";

/*
 * Recomputes power status for every active cluster that had a report in the last 6 hours, or still shows
 * a status other than unknown (so stale clusters decay to unknown). SPEC §5.1: every 10 minutes.
 * Firing watches on a confirmed change lands with watches (M5).
 */
export const powerStatusRecompute: JobHandler = async (_job, { client }) => {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const [reported, shown] = await Promise.all([
    client.from("power_reports").select("area_id").gte("reported_at", since).limit(5000),
    client.from("power_status").select("area_id").neq("status", "unknown").limit(5000),
  ]);
  if (reported.error) throw new Error(`read reports failed: ${reported.error.message}`);
  if (shown.error) throw new Error(`read status failed: ${shown.error.message}`);

  const areas = new Set([...reported.data, ...shown.data].map((r) => r.area_id as string));
  for (const areaId of areas) {
    const { error } = await client.rpc("compute_power_status", { p_area_id: areaId });
    if (error) throw new Error(`compute ${areaId} failed: ${error.message}`);
  }
};
