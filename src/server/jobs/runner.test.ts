import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { runJob, runTick } from "./runner";
import { PermanentJobError, type Job } from "./types";

function job(id: string, type: Job["type"] = "task_timer"): Job {
  return {
    id,
    type,
    payload: {},
    run_at: "",
    status: "running",
    attempts: 1,
    max_attempts: 5,
    locked_at: "",
    locked_by: "w",
    last_error: null,
    dedupe_key: null,
    created_at: "",
  };
}

/** A fake client that answers RPCs from a script and records the calls. */
function fakeClient(batches: Job[][], failStatus: "queued" | "dead" = "queued") {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
    calls.push({ fn, args });
    switch (fn) {
      case "claim_jobs":
        return { data: batches.shift() ?? [], error: null };
      case "reap_jobs":
        return { data: 2, error: null };
      case "fail_job":
        return { data: args.p_retry ? failStatus : "dead", error: null };
      case "enqueue_job":
        return { single: async () => ({ data: { id: "j", created: true }, error: null }) };
      default:
        return { data: true, error: null };
    }
  });
  // enqueue_job is called as .rpc(...).single(): return a thenable with .single for that one.
  const client = {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      if (fn === "enqueue_job") {
        calls.push({ fn, args: args ?? {} });
        return { single: async () => ({ data: { id: "j", created: true }, error: null }) };
      }
      return rpc(fn, args);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

const ctx = (client: SupabaseClient) => ({ client, workerId: "w", now: () => new Date() });

describe("runJob", () => {
  it("completes a job whose handler succeeds", async () => {
    const { client, calls } = fakeClient([]);
    expect(await runJob(job("a"), ctx(client), { task_timer: async () => {} })).toBe("done");
    expect(calls).toEqual([{ fn: "complete_job", args: { p_id: "a", p_worker: "w" } }]);
  });

  it("retries a job whose handler throws", async () => {
    const { client, calls } = fakeClient([]);
    const out = await runJob(job("a"), ctx(client), {
      task_timer: async () => {
        throw new Error("boom");
      },
    });
    expect(out).toBe("retried");
    expect(calls[0]).toMatchObject({ fn: "fail_job", args: { p_retry: true, p_error: "Error: boom" } });
  });

  it("reports dead once attempts run out", async () => {
    const { client } = fakeClient([], "dead");
    const out = await runJob(job("a"), ctx(client), {
      task_timer: async () => {
        throw new Error("boom");
      },
    });
    expect(out).toBe("dead");
  });

  it("kills permanent errors and jobs with no handler without retrying", async () => {
    const { client, calls } = fakeClient([]);
    const bad = await runJob(job("a"), ctx(client), {
      task_timer: async () => {
        throw new PermanentJobError("bad payload");
      },
    });
    expect(bad).toBe("dead");
    expect(await runJob(job("b", "send_outbound"), ctx(client), {})).toBe("dead");
    expect(calls.map((c) => c.args.p_retry)).toEqual([false, false]);
  });
});

describe("runTick", () => {
  it("heartbeats, reaps, then drains batches until the queue is empty", async () => {
    const { client, calls } = fakeClient([[job("a"), job("b")], [job("c")]]);
    const seen: string[] = [];
    const report = await runTick({
      client,
      workerId: "w",
      handlers: { task_timer: async (j) => void seen.push(j.id) },
    });
    expect(seen).toEqual(["a", "b", "c"]);
    expect(report).toEqual({ claimed: 3, done: 3, retried: 0, dead: 0, reaped: 2 });
    expect(calls.slice(0, 4).map((c) => c.fn)).toEqual([
      "record_heartbeat",
      "reap_jobs",
      "llm_breaker_check",
      "enqueue_due_reminders",
    ]);
    const keys = calls.filter((c) => c.fn === "enqueue_job").map((c) => String(c.args.p_dedupe_key));
    expect(keys.some((k) => /^power_status_recompute:\d+$/.test(k))).toBe(true);
  });

  it("queues the alerts digest once a day from 07:00 Lagos, not before", async () => {
    const keysAt = async (iso: string) => {
      const { client, calls } = fakeClient([]);
      await runTick({ client, workerId: "w", handlers: {}, now: () => new Date(iso) });
      return calls.filter((c) => c.fn === "enqueue_job").map((c) => String(c.args.p_dedupe_key));
    };
    expect(await keysAt("2026-10-18T06:30:00Z")).toContain("alerts_digest:2026-10-18"); // 07:30 in Lagos
    expect((await keysAt("2026-10-18T04:30:00Z")).some((k) => k.startsWith("alerts_digest"))).toBe(false); // 05:30
  });

  it("stops claiming once the time budget is spent", async () => {
    const { client, calls } = fakeClient([[job("a")], [job("b")], [job("c")]]);
    let t = 0;
    const report = await runTick({
      client,
      workerId: "w",
      handlers: { task_timer: async () => {} },
      budgetMs: 50_000,
      now: () => new Date((t += 20_000)),
    });
    expect(report.claimed).toBeLessThan(3);
    expect(calls.filter((c) => c.fn === "claim_jobs").length).toBe(report.claimed);
  });
});
