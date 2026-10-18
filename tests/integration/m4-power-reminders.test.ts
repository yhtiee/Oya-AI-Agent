import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The M4 features are flagged off in the shared project; force them on for this process only.
process.env.FLAGS_FORCE_ON = "skill_power,watches,reminders,local_alerts";

import { HANDLERS } from "@/server/jobs/handlers";
import { runJobNow } from "@/server/jobs/runner";
import { createTestUser, deleteTestUser, requireIntegrationEnv, service } from "./helpers";

/*
 * M4 acceptance (SPEC §21.4) against the live database:
 *  - the §5.1 status rules, including spoofing (2 new accounts can't flip a watch);
 *  - watches fire once per confirmed change, honour quiet hours and the 4-a-day cap;
 *  - reminders fire when due (one tick), repeat, and stay quiet once cancelled;
 *  - local alerts reach an area through its parents; the digest goes once a day.
 * Reports for "established" reporters are inserted directly (counted, with a weight), because account age can't be
 * faked through the API; new-account reports go through the real submit path.
 */

requireIntegrationEnv();

const users: { id: string }[] = [];
const areaIds: string[] = [];
const alertIds: string[] = [];
let cluster: string;
let parent: string;
let watcher: { id: string };

async function user(label: string) {
  const u = await createTestUser(label);
  users.push(u);
  return u;
}

async function area(name: string, kind: string, parentId: string | null = null) {
  const { data, error } = await service.rpc("upsert_area", {
    p_name: `${name} ${randomUUID().slice(0, 6)}`,
    p_kind: kind,
    p_parent_id: parentId,
    p_geojson: null,
    p_source: "integration-test",
    p_active: true,
  });
  if (error) throw new Error(error.message);
  areaIds.push(data as string);
  return data as string;
}

/** An established reporter's report: counted, at a given weight, `minutesAgo` in the past. */
async function report(areaId: string, userId: string, status: "on" | "off", weight: number, minutesAgo = 1) {
  const { error } = await service.from("power_reports").insert({
    reporter_user_id: userId,
    area_id: areaId,
    status,
    source: "user",
    via: "app",
    weight_at_report: weight,
    counted: true,
    reported_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function compute(areaId: string) {
  const { data, error } = await service.rpc("compute_power_status", { p_area_id: areaId });
  if (error) throw new Error(error.message);
  return data as { status: string; changed: boolean; change_id: string | null; to_status: string | null };
}

const ctx = (now = () => new Date()) => ({ client: service, workerId: `test-${randomUUID().slice(0, 6)}`, now });

/** Runs a queued job right away, before the shared project's tick can pick it up. */
async function runQueued(dedupeKey: string, now?: () => Date) {
  const { data } = await service.rpc("find_jobs", { p_dedupe_like: dedupeKey });
  const job = (data as { id: string; status: string }[])[0];
  if (!job) throw new Error(`no job ${dedupeKey}`);
  return { id: job.id, outcome: await runJobNow(job.id, ctx(now), HANDLERS) };
}

async function notificationsFor(userId: string, template?: string) {
  let q = service
    .from("notifications")
    .select("id, channel, template_key, status, payload, idempotency_key")
    .eq("user_id", userId);
  if (template) q = q.eq("template_key", template);
  return (await q).data ?? [];
}

beforeAll(async () => {
  parent = await area("Test neighbourhood", "neighbourhood");
  cluster = await area("Test cluster", "power_cluster", parent);
  watcher = await user("m4-watcher");
  await service.from("watches").insert({ user_id: watcher.id, type: "power_on", area_id: cluster });
});

afterAll(async () => {
  // Delete only jobs that point at this test's areas, reminders or notifications.
  const ids = users.map((u) => u.id);
  const [{ data: reminders }, { data: notes }] = await Promise.all([
    service.from("reminders").select("id").in("user_id", ids),
    service.from("notifications").select("id").in("user_id", ids),
  ]);
  const mine = [
    ...(reminders ?? []).map((r) => r.id as string),
    ...(notes ?? []).map((n) => n.id as string),
    ...areaIds,
  ];
  const own: string[] = [];
  for (const pattern of ["watch_eval:%", "reminder:%", "notify:%"]) {
    const { data } = await service.rpc("find_jobs", { p_dedupe_like: pattern, p_limit: 500 });
    for (const j of (data ?? []) as { id: string; payload: Record<string, unknown> }[]) {
      const payload = JSON.stringify(j.payload);
      if (mine.some((id) => payload.includes(id))) own.push(j.id);
    }
  }
  if (own.length) await service.rpc("delete_jobs", { p_ids: own });
  if (alertIds.length) await service.from("local_alerts").delete().in("id", alertIds);
  for (const u of users) await deleteTestUser(u.id);
  // Children before parents (areas.parent_id is on delete restrict).
  await service
    .from("areas")
    .delete()
    .in(
      "id",
      areaIds.filter((id) => id !== parent),
    );
  await service.from("areas").delete().eq("id", parent);
});

describe("§5.1 power status rules", () => {
  it("two brand-new accounts can't flip the status or fire a watch (spoofing)", async () => {
    const a = await user("m4-new-a");
    const b = await user("m4-new-b");
    await service.from("profiles").update({ power_area_id: cluster }).in("id", [a.id, b.id]);
    for (const u of [a, b]) {
      const { data } = await service.rpc("submit_power_report_for", {
        p_user_id: u.id,
        p_status: "on",
        p_area_id: null,
        p_via: "app",
      });
      expect(data).toMatchObject({ result: "recorded", counted: false, changed: false });
    }
    const { data: s } = await service
      .from("power_status")
      .select("status, confirmed_status")
      .eq("area_id", cluster)
      .single();
    expect(s).toEqual({ status: "unknown", confirmed_status: null });
    const { data: jobs } = await service.rpc("find_jobs", { p_dedupe_like: "watch_eval:%" });
    expect(((jobs ?? []) as { payload: { area_id: string } }[]).filter((j) => j.payload.area_id === cluster)).toEqual(
      [],
    );
  });

  it("a second report from the same person within 10 minutes is refused", async () => {
    const c = await user("m4-repeat");
    await service.from("profiles").update({ power_area_id: cluster }).eq("id", c.id);
    await service.rpc("submit_power_report_for", { p_user_id: c.id, p_status: "off", p_area_id: null, p_via: "app" });
    const { data } = await service.rpc("submit_power_report_for", {
      p_user_id: c.id,
      p_status: "on",
      p_area_id: null,
      p_via: "app",
    });
    expect(data).toEqual({ result: "too_soon" });
  });

  it("in bootstrap mode, three reporters below full trust agree but don't confirm a change", async () => {
    const own = await area("Bootstrap cluster", "power_cluster", parent);
    const rs = await Promise.all([user("m4-b1"), user("m4-b2"), user("m4-b3")]);
    for (const r of rs) await report(own, r.id, "on", 0.9);
    const out = await compute(own);
    expect(out.status).toBe("on"); // the score says on…
    expect(out.changed).toBe(false); // …but no confirmed change without a reporter of weight >= 1.0
  });

  it("disagreeing reports are 'uncertain', never on or off", async () => {
    const own = await area("Split cluster", "power_cluster", parent);
    const [x, y] = await Promise.all([user("m4-x"), user("m4-y")]);
    await report(own, x.id, "on", 1.0);
    await report(own, y.id, "off", 1.0);
    expect(await compute(own)).toMatchObject({ status: "uncertain", changed: false });
  });

  it("reports older than 6 hours leave the status unknown", async () => {
    const own = await area("Stale cluster", "power_cluster", parent);
    const z = await user("m4-z");
    await report(own, z.id, "on", 1.0, 7 * 60);
    expect(await compute(own)).toMatchObject({ status: "unknown", changed: false });
  });

  it("two reporters within 30 minutes, one trusted, confirm a change; trust moves for agree/disagree", async () => {
    const [p, q, dissent] = await Promise.all([user("m4-p"), user("m4-q"), user("m4-dissent")]);
    await service.from("profiles").update({ reporter_trust: 1.0 }).eq("id", p.id);
    await service.from("profiles").update({ reporter_trust: 0.5 }).in("id", [q.id, dissent.id]);
    await report(cluster, p.id, "on", 1.0, 5);
    await report(cluster, q.id, "on", 0.5, 3);
    await report(cluster, dissent.id, "off", 0.3, 2);
    const out = await compute(cluster);
    expect(out).toMatchObject({ status: "on", changed: true, to_status: "on" });

    const { data: trust } = await service
      .from("profiles")
      .select("id, reporter_trust")
      .in("id", [p.id, q.id, dissent.id]);
    const t = Object.fromEntries((trust ?? []).map((r) => [r.id, Number(r.reporter_trust)]));
    expect(t[p.id]).toBe(1); // capped at 1.0
    expect(t[q.id]).toBeCloseTo(0.6, 5);
    expect(t[dissent.id]).toBeCloseTo(0.35, 5);
  });
});

describe("watches", () => {
  it("fire once per confirmed change, even if the job runs again", async () => {
    const { data: change } = await service
      .from("power_status_changes")
      .select("id")
      .eq("area_id", cluster)
      .order("changed_at", { ascending: false })
      .limit(1)
      .single();
    const key = `watch_eval:${change!.id}`;
    const noon = () => new Date("2026-10-18T11:00:00Z"); // 12:00 in Lagos, outside quiet hours
    const first = await runQueued(key, noon);
    expect(first.outcome).toBe("done");

    // Replay the same change (a duplicate job or a retried tick): no second notification.
    const { data: again } = await service
      .rpc("enqueue_job", {
        p_type: "watch_eval",
        p_payload: { change_id: change!.id, area_id: cluster, to_status: "on" },
        p_dedupe_key: `${key}:replay`,
      })
      .single<{ id: string }>();
    await runJobNow(again!.id, ctx(noon), HANDLERS);
    await service.rpc("delete_jobs", { p_ids: [again!.id] });

    const sent = await notificationsFor(watcher.id, "power_on");
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ channel: "push", idempotency_key: expect.stringContaining(change!.id) });
  });

  it("stay quiet overnight unless the user turned on overnight alerts", async () => {
    const own = await area("Night cluster", "power_cluster", parent);
    const [sleeper, pumper, r1, r2] = await Promise.all([
      user("m4-sleeper"),
      user("m4-pumper"),
      user("m4-n1"),
      user("m4-n2"),
    ]);
    await service
      .from("profiles")
      .update({ prefs: { power: { overnight_alerts: true } } })
      .eq("id", pumper.id);
    await service.from("watches").insert([
      { user_id: sleeper.id, type: "power_on", area_id: own },
      { user_id: pumper.id, type: "power_on", area_id: own },
    ]);
    await report(own, r1.id, "on", 1.0, 4);
    await report(own, r2.id, "on", 1.0, 2);
    const out = await compute(own);
    expect(out.changed).toBe(true);
    const night = () => new Date("2026-10-18T22:30:00Z"); // 23:30 in Lagos
    await runQueued(`watch_eval:${out.change_id}`, night);
    expect(await notificationsFor(sleeper.id, "power_on")).toHaveLength(0);
    expect(await notificationsFor(pumper.id, "power_on")).toHaveLength(1);
  });

  it("fire at most 4 times a day", async () => {
    const { data: w } = await service.from("watches").select("id").eq("user_id", watcher.id).single();
    const claims = [];
    for (let i = 0; i < 6; i++) claims.push((await service.rpc("claim_watch_fire", { p_watch_id: w!.id })).data);
    // The first change above already used one firing today.
    expect(claims.filter(Boolean).length).toBe(3);
  });
});

describe("reminders", () => {
  it("fire when due: queued by the tick and delivered in the same pass", async () => {
    const owner = await user("m4-reminder");
    const due = new Date(Date.now() - 1000).toISOString();
    const { data: r } = await service
      .from("reminders")
      .insert({ user_id: owner.id, title: "Buy gas", remind_at: due })
      .select("id")
      .single();
    const t0 = Date.now();
    expect((await service.rpc("enqueue_due_reminders", { p_horizon_s: 90 })).data).toBeGreaterThanOrEqual(1);
    const fired = await runQueued(`reminder:${r!.id}:%`);
    expect(fired.outcome).toBe("done");
    expect(Date.now() - t0).toBeLessThan(60_000);

    const notes = await notificationsFor(owner.id, "reminder_due");
    expect(notes).toHaveLength(1);
    expect(notes[0].payload).toMatchObject({ title: "Buy gas", reminder_id: r!.id });
    const { data: after } = await service.from("reminders").select("status, last_sent_at").eq("id", r!.id).single();
    expect(after!.status).toBe("sent");

    // The notification's own delivery job: push with no subscription still lands in the inbox as sent.
    const delivered = await runQueued(`notify:${notes[0].id}`);
    expect(delivered.outcome).toBe("done");
    const { data: n } = await service.from("notifications").select("status").eq("id", notes[0].id).single();
    expect(n!.status).toBe("sent");
  });

  it("a repeating reminder moves to its next occurrence instead of ending", async () => {
    const owner = await user("m4-repeat-reminder");
    const due = new Date(Date.now() - 1000);
    const { data: r } = await service
      .from("reminders")
      .insert({
        user_id: owner.id,
        title: "Units",
        remind_at: due.toISOString(),
        rrule: "FREQ=DAILY;BYHOUR=8;BYMINUTE=0;BYSECOND=0",
      })
      .select("id")
      .single();
    await service.rpc("enqueue_due_reminders", { p_horizon_s: 90 });
    await runQueued(`reminder:${r!.id}:%`);
    const { data: after } = await service.from("reminders").select("status, remind_at").eq("id", r!.id).single();
    expect(after!.status).toBe("scheduled");
    expect(Date.parse(after!.remind_at)).toBeGreaterThan(Date.now());
  });

  it("a cancelled reminder never fires", async () => {
    const owner = await user("m4-cancel");
    const { data: r } = await service
      .from("reminders")
      .insert({ user_id: owner.id, title: "Never", remind_at: new Date(Date.now() - 1000).toISOString() })
      .select("id")
      .single();
    await service.rpc("enqueue_due_reminders", { p_horizon_s: 90 });
    await service.from("reminders").update({ status: "cancelled" }).eq("id", r!.id);
    await runQueued(`reminder:${r!.id}:%`);
    expect(await notificationsFor(owner.id)).toHaveLength(0);
  });

  it("important reminders also queue an SMS for users with a phone (mock mode)", async () => {
    const owner = await user("m4-important");
    await service
      .from("profiles")
      .update({ phone_e164: `+23481${Math.floor(10000000 + Math.random() * 89999999)}` })
      .eq("id", owner.id);
    const { data: r } = await service
      .from("reminders")
      .insert({
        user_id: owner.id,
        title: "Clinic appointment",
        remind_at: new Date(Date.now() - 1000).toISOString(),
        important: true,
      })
      .select("id")
      .single();
    await service.rpc("enqueue_due_reminders", { p_horizon_s: 90 });
    await runQueued(`reminder:${r!.id}:%`);
    const notes = await notificationsFor(owner.id, "reminder_due");
    expect(notes.map((n) => n.channel).sort()).toEqual(["push", "sms"]);
    const sms = notes.find((n) => n.channel === "sms")!;
    await runQueued(`notify:${sms.id}`);
    const { data: s } = await service.from("notifications").select("status, external_id").eq("id", sms.id).single();
    expect(s!.status).toBe("sent");
    expect(s!.external_id).toMatch(/^mock-sms-/);
  });
});

describe("local alerts", () => {
  it("reach a cluster through its parent area, and the digest goes once a day to opted-in users", async () => {
    const reader = await user("m4-reader");
    await service
      .from("profiles")
      .update({ power_area_id: cluster, prefs: { notifications: { alerts_digest: true } } })
      .eq("id", reader.id);
    const { data: alert } = await service
      .from("local_alerts")
      .insert({
        area_ids: [parent],
        title: "Planned outage on Ikot Ekpene Road",
        body: "PHED maintenance, 10am to 4pm.",
        severity: "warning",
        source_url: "https://example.gov.ng/notice",
        verified_by: reader.id,
        starts_at: new Date(Date.now() - 3600_000).toISOString(),
        ends_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select("id")
      .single();
    alertIds.push(alert!.id);

    const { data: forCluster } = await service.rpc("local_alerts_for_area", { p_area_id: cluster, p_ahead_hours: 72 });
    expect(((forCluster ?? []) as { id: string }[]).map((a) => a.id)).toContain(alert!.id);

    const { data: job } = await service
      .rpc("enqueue_job", {
        p_type: "alerts_digest",
        p_payload: {},
        p_dedupe_key: `alerts_digest:test-${randomUUID()}`,
      })
      .single<{ id: string }>();
    await runJobNow(job!.id, ctx(), HANDLERS);
    const { data: job2 } = await service
      .rpc("enqueue_job", {
        p_type: "alerts_digest",
        p_payload: {},
        p_dedupe_key: `alerts_digest:test-${randomUUID()}`,
      })
      .single<{ id: string }>();
    await runJobNow(job2!.id, ctx(), HANDLERS);
    await service.rpc("delete_jobs", { p_ids: [job!.id, job2!.id] });

    const digests = await notificationsFor(reader.id, "alerts_digest");
    expect(digests).toHaveLength(1);
    expect(digests[0].payload).toMatchObject({ count: 1, first_title: "Planned outage on Ikot Ekpene Road" });
  });
});
