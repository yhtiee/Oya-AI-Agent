import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HANDLERS } from "@/server/jobs/handlers";
import { runJob, runJobNow } from "@/server/jobs/runner";
import type { Job } from "@/server/jobs/types";
import { ingestWebhook } from "@/server/jobs/webhooks";
import { transitionTask, TransitionError } from "@/server/tasks/engine";
import { allTransitions, canTransition, TASK_STATUSES, type TaskStatus } from "@/server/tasks/transitions";
import { asUser, createTestUser, deleteTestUser, requireIntegrationEnv, service, token } from "./helpers";

/*
 * M2 acceptance (SPEC §21.4): every allowed transition works and every illegal one is rejected by Postgres,
 * timers fire and respect their anchors, and a killed tick causes no duplicate side effects.
 * Runs against the linked project; everything created here is deleted in afterAll.
 */

requireIntegrationEnv();

let alice: { id: string; email: string };
let bob: { id: string; email: string };
const jobIds = new Set<string>();
const areaIds: string[] = [];
const providerIds: string[] = [];
const ctx = () => ({ client: service, workerId: `test-${randomUUID().slice(0, 6)}`, now: () => new Date() });

beforeAll(async () => {
  alice = await createTestUser("tasks-alice");
  bob = await createTestUser("tasks-bob");
});

afterAll(async () => {
  const { data } = await service.rpc("task_timer_jobs", { p_task_ids: await allTaskIds() });
  for (const j of (data ?? []) as { id: string }[]) jobIds.add(j.id);
  if (jobIds.size) await service.rpc("delete_jobs", { p_ids: [...jobIds] });
  if (providerIds.length) await service.from("providers").delete().in("id", providerIds);
  await deleteTestUser(alice?.id);
  await deleteTestUser(bob?.id);
  if (areaIds.length) await service.from("areas").delete().in("id", areaIds);
});

async function allTaskIds(): Promise<string[]> {
  const ids = [alice?.id, bob?.id].filter(Boolean);
  const { data } = await service.from("tasks").select("id").in("user_id", ids);
  return (data ?? []).map((t) => t.id as string);
}

async function makeTask(status: TaskStatus = "draft", extra: Record<string, unknown> = {}, userId = alice.id) {
  const { data, error } = await service
    .from("tasks")
    .insert({
      user_id: userId,
      skill_id: "artisans",
      job_type: "book",
      title: "Fix the kitchen tap",
      status,
      completed_at: status === "completed" || status === "disputed" ? new Date().toISOString() : null,
      ...extra,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

const outcomeFor = (to: TaskStatus) =>
  to === "cancelled" ? "user_cancelled" : to === "failed" ? "no_supply" : to === "expired" ? "expired" : undefined;

describe("transition_task", () => {
  it("accepts every allowed transition (SPEC §8.2)", async () => {
    const pairs = allTransitions();
    const results = await Promise.all(
      pairs.map(async ([from, to]) => {
        const id = await makeTask(from);
        const r = await transitionTask({
          taskId: id,
          to,
          actor: { type: "system" },
          outcome: outcomeFor(to),
          client: service,
        });
        return { from, to, r };
      }),
    );
    for (const { from, to, r } of results) {
      expect(r.from).toBe(from);
      expect(r.to).toBe(to);
      expect(r.version).toBe(2);
    }
    expect(results).toHaveLength(pairs.length);
  });

  it("rejects illegal transitions in the database, not just in TypeScript", async () => {
    const illegal = TASK_STATUSES.flatMap((from) =>
      TASK_STATUSES.filter((to) => !canTransition(from, to)).map((to) => [from, to] as const),
    );
    const results = await Promise.all(
      illegal.map(async ([from, to]) => {
        const id = await makeTask(from);
        const { error } = await service.rpc("transition_task", {
          p_task_id: id,
          p_to: to,
          p_expected_version: 1,
          p_actor_type: "system",
          p_actor_id: null,
          p_outcome: outcomeFor(to) ?? null,
        });
        return { from, to, code: error?.code };
      }),
    );
    for (const r of results) expect(r, `${r.from} -> ${r.to}`).toMatchObject({ code: "22023" });
  });

  it("raises PT409 on a stale version", async () => {
    const id = await makeTask("draft");
    const { error } = await service.rpc("transition_task", {
      p_task_id: id,
      p_to: "needs_info",
      p_expected_version: 7,
      p_actor_type: "system",
      p_actor_id: null,
    });
    expect(error?.code).toBe("PT409");
  });

  it("retries concurrent transitions so both land (two providers replying at once)", async () => {
    const id = await makeTask("awaiting_responses");
    const both = await Promise.all(
      [1, 2].map((wave) =>
        transitionTask({
          taskId: id,
          to: "awaiting_responses",
          actor: { type: "system" },
          payload: { wave },
          client: service,
        }),
      ),
    );
    expect(both.map((r) => r.version).sort()).toEqual([2, 3]);
    const { data } = await service.from("tasks").select("version").eq("id", id).single();
    expect(data?.version).toBe(3);
  });

  it("refuses direct status updates, even with the service role", async () => {
    const id = await makeTask("draft");
    const { error } = await service.from("tasks").update({ status: "completed" }).eq("id", id);
    expect(error?.code).toBe("42501");
    const ok = await service.from("tasks").update({ title: "Fix the bathroom tap" }).eq("id", id);
    expect(ok.error).toBeNull();
  });

  it("needs an outcome for terminal statuses and sets closed_at", async () => {
    const id = await makeTask("draft");
    await expect(
      transitionTask({ taskId: id, to: "cancelled", actor: { type: "user" }, client: service }),
    ).rejects.toThrow(/needs an outcome/);
    await transitionTask({
      taskId: id,
      to: "cancelled",
      actor: { type: "user" },
      outcome: "user_cancelled",
      client: service,
    });
    const { data } = await service.from("tasks").select("status, outcome, closed_at").eq("id", id).single();
    expect(data).toMatchObject({ status: "cancelled", outcome: "user_cancelled" });
    expect(data?.closed_at).not.toBeNull();
  });

  it("allows disputes only within 72 hours of completion", async () => {
    const old = await makeTask("completed", { completed_at: new Date(Date.now() - 73 * 3600_000).toISOString() });
    await expect(
      transitionTask({ taskId: old, to: "disputed", actor: { type: "user" }, client: service }),
    ).rejects.toThrow(/dispute window/);
    const recent = await makeTask("completed");
    const r = await transitionTask({ taskId: recent, to: "disputed", actor: { type: "user" }, client: service });
    expect(r.to).toBe("disputed");
  });

  it("checks the expected current status", async () => {
    const id = await makeTask("booked");
    const err = await transitionTask({
      taskId: id,
      to: "cancelled",
      from: ["confirming"],
      outcome: "user_cancelled",
      actor: { type: "user" },
      client: service,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(TransitionError);
    expect(err.code).toBe("unexpected_status");
  });

  it("writes a status_change event and sets completed_at", async () => {
    const id = await makeTask("awaiting_confirmation");
    const r = await transitionTask({
      taskId: id,
      to: "completed",
      actor: { type: "user", id: alice.id },
      client: service,
    });
    const { data: ev } = await service.from("task_events").select("*").eq("id", r.eventId).single();
    expect(ev).toMatchObject({
      task_id: id,
      type: "status_change",
      from_status: "awaiting_confirmation",
      to_status: "completed",
      actor_type: "user",
      actor_id: alice.id,
      visibility: "user",
    });
    const { data: t } = await service.from("tasks").select("completed_at").eq("id", id).single();
    expect(t?.completed_at).not.toBeNull();
  });
});

describe("task RLS", () => {
  it("users see their own tasks and only user-visible events", async () => {
    const id = await makeTask("draft");
    await transitionTask({ taskId: id, to: "needs_info", actor: { type: "agent" }, client: service });
    await service
      .from("task_events")
      .insert({ task_id: id, type: "ops_note", visibility: "ops", actor_type: "ops", payload: { note: "x" } });

    const asAlice = asUser(token({ sub: alice.id }));
    const tasks = await asAlice.from("tasks").select("id").eq("id", id);
    expect(tasks.data).toEqual([{ id }]);
    const events = await asAlice.from("task_events").select("type, visibility").eq("task_id", id);
    expect(events.data).toEqual([{ type: "status_change", visibility: "user" }]);

    const asBob = asUser(token({ sub: bob.id }));
    expect((await asBob.from("tasks").select("id").eq("id", id)).data).toEqual([]);
    expect((await asBob.from("task_events").select("id").eq("task_id", id)).data).toEqual([]);
    expect((await asUser(null).from("tasks").select("id").eq("id", id)).data ?? []).toEqual([]);
  });

  it("users can't write tasks or call transition_task", async () => {
    const id = await makeTask("draft");
    const asAlice = asUser(token({ sub: alice.id }));
    const upd = await asAlice.from("tasks").update({ title: "hacked" }).eq("id", id).select("id");
    expect(upd.data ?? []).toEqual([]);
    const ins = await asAlice
      .from("tasks")
      .insert({ user_id: alice.id, skill_id: "food", job_type: "book", title: "x" });
    expect(ins.error).not.toBeNull();
    const rpc = await asAlice.rpc("transition_task", {
      p_task_id: id,
      p_to: "cancelled",
      p_expected_version: 1,
      p_actor_type: "user",
      p_actor_id: alice.id,
      p_outcome: "user_cancelled",
    });
    expect(rpc.error).not.toBeNull();
  });
});

describe("timers", () => {
  it("entering a status schedules its automatic timer, once per anchor", async () => {
    const id = await makeTask("needs_info");
    const r = await transitionTask({ taskId: id, to: "confirming", actor: { type: "agent" }, client: service });
    expect(r.timers.map((t) => t.timer)).toEqual(["confirmExpiry"]);
    const { data } = await service.rpc("task_timer_jobs", { p_task_ids: [id] });
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      timer: "confirmExpiry",
      status: "queued",
      dedupe_key: `${id}:confirmExpiry:${r.eventId}`,
    });
    const runAt = new Date(data[0].run_at).getTime();
    expect(Math.abs(runAt - (Date.now() + 30 * 60_000))).toBeLessThan(60_000);
  });

  it("a due timer fires and moves the task (autoComplete)", async () => {
    const id = await makeTask("in_progress");
    const r = await transitionTask({
      taskId: id,
      to: "awaiting_confirmation",
      actor: { type: "provider" },
      timers: [{ timer: "autoComplete", runAt: new Date(Date.now() - 1000) }],
      client: service,
    });
    const job = r.timers.find((t) => t.timer === "autoComplete")!;
    jobIds.add(job.jobId);
    expect(await runJobNow(job.jobId, ctx(), HANDLERS)).toBe("done");
    const { data } = await service.from("tasks").select("status, outcome").eq("id", id).single();
    expect(data).toEqual({ status: "completed", outcome: "auto_completed" });
  });

  it("a timer does nothing after the task left and re-entered its status", async () => {
    const id = await makeTask("needs_info");
    const first = await transitionTask({
      taskId: id,
      to: "confirming",
      actor: { type: "agent" },
      timers: [{ timer: "confirmExpiry", runAt: new Date(Date.now() - 1000) }],
      client: service,
    });
    await transitionTask({ taskId: id, to: "needs_info", actor: { type: "agent" }, client: service });
    await transitionTask({ taskId: id, to: "confirming", actor: { type: "agent" }, client: service });

    const stale = first.timers.find((t) => t.timer === "confirmExpiry")!;
    jobIds.add(stale.jobId);
    expect(await runJobNow(stale.jobId, ctx(), HANDLERS)).toBe("done");
    const { data } = await service.from("tasks").select("status").eq("id", id).single();
    expect(data?.status).toBe("confirming");
  });

  it("completionCheck spans booked → in_progress", async () => {
    const id = await makeTask("confirming");
    const booked = await transitionTask({
      taskId: id,
      to: "booked",
      actor: { type: "provider" },
      timers: [{ timer: "completionCheck", runAt: new Date(Date.now() - 1000) }],
      client: service,
    });
    await transitionTask({ taskId: id, to: "in_progress", actor: { type: "provider" }, client: service });
    const job = booked.timers.find((t) => t.timer === "completionCheck")!;
    jobIds.add(job.jobId);
    expect(await runJobNow(job.jobId, ctx(), HANDLERS)).toBe("done");
    const { data } = await service.from("tasks").select("status").eq("id", id).single();
    expect(data?.status).toBe("awaiting_confirmation");
  });

  it("spotResponse with no options fails the task as no_supply and opens an ops item", async () => {
    const id = await makeTask("confirming", { skill_id: "food" });
    const r = await transitionTask({
      taskId: id,
      to: "awaiting_responses",
      actor: { type: "agent" },
      timers: [{ timer: "spotResponse", runAt: new Date(Date.now() - 1000) }],
      client: service,
    });
    const job = r.timers.find((t) => t.timer === "spotResponse")!;
    jobIds.add(job.jobId);
    await runJobNow(job.jobId, ctx(), HANDLERS);
    const { data } = await service.from("tasks").select("status, outcome").eq("id", id).single();
    expect(data).toEqual({ status: "failed", outcome: "no_supply" });
    const ops = await service.from("ops_queue").select("reason").eq("task_id", id);
    expect(ops.data).toEqual([{ reason: "no_supply" }]);
  });

  it("a killed tick causes no duplicate side effects", async () => {
    const id = await makeTask("in_progress");
    const r = await transitionTask({
      taskId: id,
      to: "awaiting_confirmation",
      actor: { type: "provider" },
      timers: [{ timer: "autoComplete", runAt: new Date(Date.now() - 1000) }],
      client: service,
    });
    const jobId = r.timers.find((t) => t.timer === "autoComplete")!.jobId;
    jobIds.add(jobId);

    // Worker A claims the job and dies before doing anything.
    const a = await service.rpc("claim_job_by_id", { p_id: jobId, p_worker: "worker-a" });
    expect(a.data).toHaveLength(1);
    // While A holds it, nobody else can claim it.
    expect((await service.rpc("claim_job_by_id", { p_id: jobId, p_worker: "worker-b" })).data).toEqual([]);

    // The reaper (stale after 0 s here, 5 min in production) puts it back; worker B runs it.
    expect((await service.rpc("reap_jobs", { p_stale_after_s: 0 })).data).toBeGreaterThanOrEqual(1);
    expect(await runJobNow(jobId, { ...ctx(), workerId: "worker-b" }, HANDLERS)).toBe("done");

    // A wakes up and tries to finish: refused, and re-running its work is a no-op.
    expect((await service.rpc("complete_job", { p_id: jobId, p_worker: "worker-a" })).data).toBe(false);
    const replay = { ...(a.data as Job[])[0] };
    expect(await runJob(replay, { ...ctx(), workerId: "worker-a" }, HANDLERS)).toBe("done");

    const { data: events } = await service
      .from("task_events")
      .select("to_status")
      .eq("task_id", id)
      .eq("type", "status_change")
      .eq("to_status", "completed");
    expect(events).toHaveLength(1);
    const { data: jobs } = await service.rpc("task_timer_jobs", { p_task_ids: [id] });
    expect(jobs.find((j: { id: string }) => j.id === jobId)).toMatchObject({ status: "done", attempts: 2 });
  });

  it("claim_jobs hands each job to exactly one of two concurrent workers", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const { data } = await service
        .rpc("enqueue_job", {
          p_type: "task_timer",
          p_payload: { test: true },
          p_dedupe_key: `test-claim:${randomUUID()}`,
        })
        .single<{ id: string }>();
      ids.push(data!.id);
      jobIds.add(data!.id);
    }
    const [x, y] = await Promise.all([
      service.rpc("claim_jobs", { p_worker: "wx", p_limit: 50 }),
      service.rpc("claim_jobs", { p_worker: "wy", p_limit: 50 }),
    ]);
    const mine = (rows: Job[]) => rows.map((j) => j.id).filter((jid) => ids.includes(jid));
    const gotX = mine(x.data as Job[]);
    const gotY = mine(y.data as Job[]);
    expect(gotX.filter((jid) => gotY.includes(jid))).toEqual([]);
    expect([...gotX, ...gotY].sort()).toEqual([...ids].sort());
    for (const jid of gotX) await service.rpc("complete_job", { p_id: jid, p_worker: "wx" });
    for (const jid of gotY) await service.rpc("complete_job", { p_id: jid, p_worker: "wy" });
  });

  it("failed jobs back off, then die after max attempts", async () => {
    const { data } = await service
      .rpc("enqueue_job", {
        p_type: "task_timer",
        p_payload: {},
        p_dedupe_key: `test-fail:${randomUUID()}`,
        p_max_attempts: 2,
      })
      .single<{ id: string }>();
    const id = data!.id;
    jobIds.add(id);
    await service.rpc("claim_job_by_id", { p_id: id, p_worker: "wf" });
    expect((await service.rpc("fail_job", { p_id: id, p_worker: "wf", p_error: "boom" })).data).toBe("queued");
    // Not due for 2 minutes, so it can't be claimed yet.
    expect((await service.rpc("claim_job_by_id", { p_id: id, p_worker: "wf" })).data).toEqual([]);
  });

  it("enqueue is idempotent on the dedupe key", async () => {
    const key = `test-dedupe:${randomUUID()}`;
    const a = await service
      .rpc("enqueue_job", { p_type: "task_timer", p_dedupe_key: key })
      .single<{ id: string; created: boolean }>();
    const b = await service
      .rpc("enqueue_job", { p_type: "task_timer", p_dedupe_key: key })
      .single<{ id: string; created: boolean }>();
    jobIds.add(a.data!.id);
    expect(a.data!.created).toBe(true);
    expect(b.data).toEqual({ id: a.data!.id, created: false });
  });
});

describe("webhooks", () => {
  it("ingests an event once, however often the provider retries", async () => {
    const ext = `test-${randomUUID()}`;
    const first = await ingestWebhook("other", ext, { hello: "world" }, service);
    const again = await ingestWebhook("other", ext, { hello: "world" }, service);
    if (first.jobId) jobIds.add(first.jobId);
    expect(first.duplicate).toBe(false);
    expect(first.jobId).not.toBeNull();
    expect(again).toEqual({ eventId: first.eventId, jobId: first.jobId, duplicate: true });
  });
});

describe("confirmations", () => {
  it("one pending per conversation, claimed exactly once", async () => {
    const { data: conv } = await service
      .from("conversations")
      .insert({ user_id: alice.id, channel: "web" })
      .select("id")
      .single();
    const make = () =>
      service
        .rpc("create_confirmation", {
          p_conversation_id: conv!.id,
          p_task_id: null,
          p_user_id: alice.id,
          p_kind: "reminder",
          p_summary_text: "Remind you Thursday 9:00am?",
          p_action_payload: { tool: "create_reminder" },
        })
        .single<{ id: string }>();
    const c1 = await make();
    const c2 = await make();
    const { data: rows } = await service.from("confirmations").select("id, status").eq("conversation_id", conv!.id);
    expect(rows?.find((r) => r.id === c1.data!.id)?.status).toBe("superseded");
    expect(rows?.find((r) => r.id === c2.data!.id)?.status).toBe("pending");

    const taps = await Promise.all(
      [1, 2, 3].map(() => service.rpc("claim_confirmation", { p_confirmation_id: c2.data!.id, p_user_id: alice.id })),
    );
    expect(taps.filter((t) => (t.data as unknown[]).length === 1)).toHaveLength(1);
    const cross = await service.rpc("claim_confirmation", { p_confirmation_id: c1.data!.id, p_user_id: bob.id });
    expect(cross.data).toEqual([]);
  });

  it("conversation lease: one holder at a time", async () => {
    const { data: conv } = await service
      .from("conversations")
      .insert({ user_id: alice.id, channel: "web" })
      .select("id")
      .single();
    const [a, b] = await Promise.all([
      service.rpc("claim_conversation_lease", { p_conversation_id: conv!.id, p_worker_id: "wa", p_ttl_s: 60 }),
      service.rpc("claim_conversation_lease", { p_conversation_id: conv!.id, p_worker_id: "wb", p_ttl_s: 60 }),
    ]);
    expect([a.data, b.data].filter(Boolean)).toHaveLength(1);
    const holder = a.data ? "wa" : "wb";
    const other = a.data ? "wb" : "wa";
    expect(
      (await service.rpc("release_conversation_lease", { p_conversation_id: conv!.id, p_worker_id: other })).data,
    ).toBe(false);
    expect(
      (await service.rpc("release_conversation_lease", { p_conversation_id: conv!.id, p_worker_id: holder })).data,
    ).toBe(true);
    expect(
      (await service.rpc("claim_conversation_lease", { p_conversation_id: conv!.id, p_worker_id: other })).data,
    ).toBe(true);
  });
});

describe("provider access to requests", () => {
  it("reveals contact only to the chosen provider after a booking with consent", async () => {
    const chosenOwner = await createTestUser("prov-chosen");
    const otherOwner = await createTestUser("prov-other");
    try {
      await service
        .from("profiles")
        .update({ phone_e164: `+23480${Math.floor(10000000 + Math.random() * 89999999)}` })
        .eq("id", alice.id);
      const { data: provs } = await service
        .from("providers")
        .insert([
          { type: "individual", display_name: "Test Plumber A", status: "active" },
          { type: "individual", display_name: "Test Plumber B", status: "active" },
        ])
        .select("id");
      const [chosen, other] = provs!.map((p) => p.id as string);
      providerIds.push(chosen, other);
      await service.from("provider_members").insert([
        { provider_id: chosen, user_id: chosenOwner.id },
        { provider_id: other, user_id: otherOwner.id },
      ]);

      const { data: conv } = await service
        .from("conversations")
        .insert({ user_id: alice.id, channel: "web" })
        .select("id")
        .single();
      const taskId = await makeTask("awaiting_responses", {
        location: "SRID=4326;POINT(7.9 5.03)",
        visit_in_home: true,
      });
      const { data: reqs } = await service
        .from("provider_requests")
        .insert([
          { task_id: taskId, provider_id: chosen, kind: "quote", channel: "portal" },
          { task_id: taskId, provider_id: other, kind: "quote", channel: "portal" },
        ])
        .select("id, provider_id");
      const reqChosen = reqs!.find((r) => r.provider_id === chosen)!.id;
      const reqOther = reqs!.find((r) => r.provider_id === other)!.id;

      const asChosen = asUser(token({ sub: chosenOwner.id }));
      const asOther = asUser(token({ sub: otherOwner.id }));
      const get = (c: typeof asChosen, id: string) => c.rpc("provider_get_request", { p_request_id: id });

      // Before booking: no contact for anyone.
      expect((await get(asChosen, reqChosen)).data.contact).toBeNull();
      // Can't read another provider's request at all.
      expect((await get(asOther, reqChosen)).data).toBeNull();

      await service.from("tasks").update({ provider_id: chosen }).eq("id", taskId);
      const conf = await service
        .rpc("create_confirmation", {
          p_conversation_id: conv!.id,
          p_task_id: taskId,
          p_user_id: alice.id,
          p_kind: "booking",
          p_summary_text: "Book Test Plumber A?",
          p_action_payload: {},
          p_consents: ["share_contact"],
        })
        .single<{ id: string }>();
      await service.rpc("claim_confirmation", { p_confirmation_id: conf.data!.id, p_user_id: alice.id });
      await transitionTask({ taskId, to: "booked", actor: { type: "provider" }, client: service });

      const booked = (await get(asChosen, reqChosen)).data;
      expect(booked.contact).toMatchObject({ first_name: "Test" });
      expect(booked.contact.phone).toMatch(/^\+234/);
      // Home visit, pin not released: no exact location yet.
      expect(booked.pin).toBeNull();
      // The provider that wasn't chosen sees no contact.
      expect((await get(asOther, reqOther)).data.contact).toBeNull();

      await service.from("tasks").update({ pin_released_at: new Date().toISOString() }).eq("id", taskId);
      const released = (await get(asChosen, reqChosen)).data;
      expect(released.pin.lat).toBeCloseTo(5.03, 5);

      // After completion + 30 days, contact is hidden again.
      await service
        .from("tasks")
        .update({ completed_at: new Date(Date.now() - 31 * 86400_000).toISOString() })
        .eq("id", taskId);
      await transitionTask({ taskId, to: "awaiting_confirmation", actor: { type: "provider" }, client: service });
      await service
        .from("tasks")
        .update({ completed_at: new Date(Date.now() - 31 * 86400_000).toISOString() })
        .eq("id", taskId);
      expect((await get(asChosen, reqChosen)).data.contact).toBeNull();

      // Members never touch the table directly.
      expect((await asChosen.from("provider_requests").select("id")).data ?? []).toEqual([]);
    } finally {
      await service.from("profiles").update({ phone_e164: null }).eq("id", alice.id);
      await deleteTestUser(chosenOwner.id);
      await deleteTestUser(otherOwner.id);
    }
  });
});

describe("power reports", () => {
  it("new accounts are stored but not counted; ops reports confirm a change", async () => {
    const areaId = (
      await service.rpc("upsert_area", {
        p_name: `Test cluster ${randomUUID().slice(0, 6)}`,
        p_kind: "power_cluster",
        p_parent_id: null,
        p_geojson: null,
        p_source: "integration-test",
        p_active: true,
      })
    ).data as string;
    areaIds.push(areaId);
    await service.from("profiles").update({ power_area_id: areaId }).eq("id", alice.id);

    const asAlice = asUser(token({ sub: alice.id }));
    const first = await asAlice.rpc("submit_power_report", { p_status: "on" });
    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({ result: "recorded", counted: false, status: "unknown", changed: false });
    expect((await asAlice.rpc("submit_power_report", { p_status: "off" })).data).toEqual({ result: "too_soon" });
    expect((await asUser(null).rpc("submit_power_report", { p_status: "on" })).error).not.toBeNull();
    expect((await asAlice.from("power_reports").select("id")).data ?? []).toEqual([]);

    const ops = await service.rpc("record_power_report", {
      p_area_id: areaId,
      p_status: "on",
      p_source: "ops",
      p_reporter_user_id: null,
      p_via: "ops_console",
    });
    expect(ops.data).toMatchObject({ counted: true, status: "on", changed: true, to_status: "on", from_status: null });

    const status = await asUser(null)
      .from("power_status")
      .select("status, confirmed_status")
      .eq("area_id", areaId)
      .single();
    expect(status.data).toEqual({ status: "on", confirmed_status: "on" });
    const again = await service.rpc("compute_power_status", { p_area_id: areaId });
    expect(again.data).toMatchObject({ status: "on", changed: false });
  });
});
