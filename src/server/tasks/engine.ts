import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceClient } from "../db/service-client";
import { enqueueJob } from "../jobs/enqueue";
import { AUTOMATIC_TIMERS, timerDedupeKey, timerPayload, timerRunAt, type TimerName } from "./timers";
import { canTransition, isTaskStatus, type TaskOutcome, type TaskStatus } from "./transitions";

/*
 * The only way server code changes a task's status (SPEC §8.2). Wraps public.transition_task, which
 * checks the transition table and the version under a row lock. On a version mismatch (PT409) it
 * re-reads the task and retries up to 3 times, as long as the move is still legal from wherever the
 * task now is; two providers replying at once is normal.
 */

export type ActorType = "user" | "agent" | "provider" | "ops" | "system";

export type TransitionInput = {
  taskId: string;
  to: TaskStatus;
  actor: { type: ActorType; id?: string | null };
  /** Shown on the user's timeline when visibility is 'user', so keep it display-safe. */
  payload?: Record<string, unknown>;
  visibility?: "user" | "ops";
  outcome?: TaskOutcome;
  outcomeReason?: string;
  /** Only act if the task is currently in one of these (defaults to any status the move is legal from). */
  from?: readonly TaskStatus[];
  /** Timers that need times the engine can't know (slot + 30 min, expected end…). */
  timers?: { timer: TimerName; runAt?: Date }[];
  client?: SupabaseClient;
};

export type TransitionResult = {
  taskId: string;
  from: TaskStatus;
  to: TaskStatus;
  version: number;
  eventId: string;
  eventSeq: number;
  timers: { timer: TimerName; jobId: string }[];
};

export class TransitionError extends Error {
  override name = "TransitionError";
  constructor(
    readonly code: "not_found" | "illegal" | "conflict" | "unexpected_status" | "db",
    message: string,
  ) {
    super(message);
  }
}

const MAX_ATTEMPTS = 4; // the first try plus 3 retries

async function readTask(client: SupabaseClient, taskId: string): Promise<{ status: TaskStatus; version: number }> {
  const { data, error } = await client.from("tasks").select("status, version").eq("id", taskId).maybeSingle();
  if (error) throw new TransitionError("db", `read task failed: ${error.message}`);
  if (!data || !isTaskStatus(data.status)) throw new TransitionError("not_found", `task ${taskId} not found`);
  return { status: data.status, version: data.version as number };
}

export async function transitionTask(input: TransitionInput): Promise<TransitionResult> {
  const client = input.client ?? getServiceClient();

  for (let attempt = 1; ; attempt++) {
    const current = await readTask(client, input.taskId);
    if (input.from && !input.from.includes(current.status)) {
      throw new TransitionError(
        "unexpected_status",
        `task ${input.taskId} is ${current.status}, expected ${input.from.join(" or ")}`,
      );
    }
    if (!canTransition(current.status, input.to)) {
      throw new TransitionError("illegal", `illegal transition ${current.status} -> ${input.to}`);
    }

    const { data, error } = await client
      .rpc("transition_task", {
        p_task_id: input.taskId,
        p_to: input.to,
        p_expected_version: current.version,
        p_actor_type: input.actor.type,
        p_actor_id: input.actor.id ?? null,
        p_payload: input.payload ?? {},
        p_outcome: input.outcome ?? null,
        p_outcome_reason: input.outcomeReason ?? null,
        p_visibility: input.visibility ?? "user",
      })
      .single<{
        task_id: string;
        from_status: TaskStatus;
        to_status: TaskStatus;
        version: number;
        event_id: string;
        event_seq: number;
      }>();

    // PT409 = version mismatch (D-015). 40001 kept in case the database ever reports a real serialization failure.
    if (error?.code === "PT409" || error?.code === "40001") {
      if (attempt < MAX_ATTEMPTS) continue;
      throw new TransitionError("conflict", `task ${input.taskId} kept changing; gave up after ${attempt} tries`);
    }
    if (error?.code === "22023") throw new TransitionError("illegal", error.message);
    if (error?.code === "P0002") throw new TransitionError("not_found", error.message);
    if (error || !data) throw new TransitionError("db", `transition failed: ${error?.message ?? "no row"}`);

    const timers = await scheduleTimers(client, data.task_id, data.to_status, data.event_id, input.timers ?? []);
    return {
      taskId: data.task_id,
      from: data.from_status,
      to: data.to_status,
      version: data.version,
      eventId: data.event_id,
      eventSeq: Number(data.event_seq),
      timers,
    };
  }
}

/**
 * Enqueues the automatic timers for the new status plus any the caller asked for. Dedupe keys make this
 * safe to repeat. If enqueueing fails after the transition committed, the error propagates and the caller's
 * job retries; the retry sees the task already moved and the timer key already taken.
 */
async function scheduleTimers(
  client: SupabaseClient,
  taskId: string,
  status: TaskStatus,
  anchorEventId: string,
  extra: { timer: TimerName; runAt?: Date }[],
): Promise<{ timer: TimerName; jobId: string }[]> {
  const wanted = new Map<TimerName, Date | undefined>();
  for (const timer of AUTOMATIC_TIMERS[status] ?? []) wanted.set(timer, undefined);
  for (const t of extra) wanted.set(t.timer, t.runAt);

  const now = new Date();
  const scheduled: { timer: TimerName; jobId: string }[] = [];
  for (const [timer, runAt] of wanted) {
    const job = await enqueueJob("task_timer", timerPayload(taskId, timer, anchorEventId), {
      runAt: timerRunAt(timer, now, runAt),
      dedupeKey: timerDedupeKey(taskId, timer, anchorEventId),
      client,
    });
    scheduled.push({ timer, jobId: job.id });
  }
  return scheduled;
}

/** Is a timer still allowed to act? (SPEC §8.3) */
export async function isTimerValid(
  client: SupabaseClient,
  payload: { task_id: string; anchor_event_id: string; valid_statuses: readonly TaskStatus[] },
): Promise<boolean> {
  const { data, error } = await client.rpc("task_timer_valid", {
    p_task_id: payload.task_id,
    p_anchor_event_id: payload.anchor_event_id,
    p_valid_statuses: [...payload.valid_statuses],
  });
  if (error) throw new Error(`timer check failed: ${error.message}`);
  return data === true;
}
