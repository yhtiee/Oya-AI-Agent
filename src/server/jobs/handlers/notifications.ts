import "server-only";
import { isQuietHours } from "@/lib/quiet-hours";
import { lagosParts, nextOccurrence } from "@/lib/reminders/parse-time";
import { isEnabled } from "../../flags";
import { deliverNotification, notifyUser } from "../../notifications/notify";
import { PermanentJobError, type JobHandler } from "../types";

/* Handlers for reminders, watches, the alerts digest and outbound delivery (SPEC §5.1, §5.6, §5.7, §9). */

export const sendOutbound: JobHandler = async (job, { client }) => {
  const id = job.payload.notification_id;
  if (typeof id !== "string") throw new PermanentJobError("send_outbound needs notification_id");
  await deliverNotification(client, id);
};

/**
 * Fires one occurrence of a reminder. The job carries the remind_at it was queued for; if the reminder was
 * cancelled or rescheduled since, the job does nothing. Recurring reminders move to their next occurrence.
 */
export const reminderFire: JobHandler = async (job, { client }) => {
  const { reminder_id: id, remind_at: dueAt } = job.payload as { reminder_id?: string; remind_at?: string };
  if (!id || !dueAt) throw new PermanentJobError("reminder_fire needs reminder_id and remind_at");

  const { data: r } = await client
    .from("reminders")
    .select("id, user_id, title, body, remind_at, rrule, important, status")
    .eq("id", id)
    .maybeSingle();
  if (!r || r.status !== "scheduled" || Date.parse(r.remind_at) !== Date.parse(dueAt)) return;

  const epoch = Math.floor(Date.parse(dueAt) / 1000);
  await notifyUser(client, {
    userId: r.user_id,
    templateKey: "reminder_due",
    payload: { title: r.title, body: r.body, reminder_id: r.id },
    important: r.important,
    idempotencyKey: `reminder:${r.id}:${epoch}`,
  });

  const next = r.rrule ? nextOccurrence(r.rrule, new Date(dueAt)) : null;
  await client
    .from("reminders")
    .update(
      next
        ? { remind_at: next.toISOString(), last_sent_at: new Date().toISOString() }
        : { status: "sent", last_sent_at: new Date().toISOString() },
    )
    .eq("id", r.id)
    .eq("remind_at", r.remind_at);
};

/**
 * Fires the watches for one confirmed power change, once each (SPEC §5.1 step 4, §5.7): quiet 22:00–06:00 unless
 * the user turned on overnight alerts, at most 4 firings a day per watch (claim_watch_fire).
 */
export const watchEval: JobHandler = async (job, { client, now }) => {
  const { change_id: changeId, area_id: areaId, to_status: toStatus } = job.payload as Record<string, string>;
  if (!changeId || !areaId || (toStatus !== "on" && toStatus !== "off")) {
    throw new PermanentJobError("watch_eval needs change_id, area_id and to_status");
  }
  if (!(await isEnabled("watches"))) return;

  const [{ data: watches, error }, { data: area }] = await Promise.all([
    client.rpc("watches_for_power_change", { p_area_id: areaId, p_to_status: toStatus }),
    client.from("areas").select("name").eq("id", areaId).maybeSingle(),
  ]);
  if (error) throw new Error(`watches_for_power_change failed: ${error.message}`);
  const quiet = isQuietHours(now());

  for (const w of (watches ?? []) as { watch_id: string; user_id: string; overnight: boolean }[]) {
    if (quiet && !w.overnight) continue;
    const key = `watch:${w.watch_id}:${changeId}`;
    const { data: existing } = await client.from("notifications").select("id").eq("idempotency_key", key).maybeSingle();
    if (existing) continue; // a retried job: this watch already fired for this change
    const { data: claimed } = await client.rpc("claim_watch_fire", { p_watch_id: w.watch_id });
    if (claimed !== true) continue; // 4 firings today already, or the watch ended
    await notifyUser(client, {
      userId: w.user_id,
      templateKey: toStatus === "on" ? "power_on" : "power_off",
      payload: { area_name: area?.name ?? null, change_id: changeId, watch_id: w.watch_id },
      idempotencyKey: key,
    });
  }
};

/** Morning digest (SPEC §5.6): only users who opted in, only on days with an alert, push / in-app only. */
export const alertsDigest: JobHandler = async (_job, { client, now }) => {
  if (!(await isEnabled("local_alerts"))) return;
  const { data: users } = await client
    .from("profiles")
    .select("id, power_area_id")
    .eq("prefs->notifications->>alerts_digest", "true")
    .not("power_area_id", "is", null)
    .is("deleted_at", null)
    .limit(5000);

  const p = lagosParts(now());
  const day = `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  const endOfDay = Date.parse(`${day}T23:59:59+01:00`);

  for (const u of users ?? []) {
    const { data: alerts } = await client.rpc("local_alerts_for_area", {
      p_area_id: u.power_area_id,
      p_ahead_hours: 24,
    });
    const today = ((alerts ?? []) as { title: string; starts_at: string }[]).filter(
      (a) => Date.parse(a.starts_at) <= endOfDay,
    );
    if (!today.length) continue;
    await notifyUser(client, {
      userId: u.id,
      templateKey: "alerts_digest",
      payload: { count: today.length, first_title: today[0].title, day },
      idempotencyKey: `digest:${u.id}:${day}`,
    });
  }
};
