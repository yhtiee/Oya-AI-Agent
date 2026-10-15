import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTimerValid, transitionTask, TransitionError, type TransitionInput } from "../../tasks/engine";
import { isTimerName, type TimerName, type TimerPayload } from "../../tasks/timers";
import { isTaskStatus } from "../../tasks/transitions";
import { PermanentJobError, type JobHandler } from "../types";

/*
 * Runs a task timer (SPEC §8.3). A timer that is no longer valid does nothing. Every action is a guarded
 * transition (`from` = the timer's valid statuses, plus the version check in the database), so a timer
 * that fires twice, or races a user's tap, can't move the task twice.
 *
 * Messages to users and providers (nudges, "has the artisan arrived?", "is everything OK?") arrive with the
 * messaging milestone; until then those timers leave an ops-visible note, and safetyCheck fails safe by
 * opening a priority-1 safety item.
 */

function parsePayload(payload: Record<string, unknown>): TimerPayload {
  const { task_id, timer, valid_statuses, anchor_event_id } = payload;
  if (
    typeof task_id !== "string" ||
    typeof anchor_event_id !== "string" ||
    !isTimerName(timer) ||
    !Array.isArray(valid_statuses) ||
    !valid_statuses.every(isTaskStatus)
  ) {
    throw new PermanentJobError("task_timer payload is malformed");
  }
  return { task_id, timer, valid_statuses, anchor_event_id };
}

async function availableOptions(client: SupabaseClient, taskId: string): Promise<number> {
  const { count, error } = await client
    .from("task_options")
    .select("id", { count: "exact", head: true })
    .eq("task_id", taskId)
    .eq("status", "available");
  if (error) throw new Error(`count options failed: ${error.message}`);
  return count ?? 0;
}

async function openOpsItem(
  client: SupabaseClient,
  item: { task_id: string; reason: string; priority: 1 | 2 | 3; note?: string },
) {
  const { error } = await client.from("ops_queue").insert(item);
  if (error) throw new Error(`ops item failed: ${error.message}`);
}

async function opsNote(client: SupabaseClient, taskId: string, note: Record<string, unknown>) {
  const { error } = await client.from("task_events").insert({
    task_id: taskId,
    type: "ops_note",
    visibility: "ops",
    actor_type: "system",
    payload: note,
  });
  if (error) throw new Error(`ops note failed: ${error.message}`);
}

type Act = Omit<TransitionInput, "taskId" | "actor" | "client" | "from">;

async function act(client: SupabaseClient, p: TimerPayload, move: Act): Promise<boolean> {
  try {
    await transitionTask({
      ...move,
      taskId: p.task_id,
      from: p.valid_statuses,
      actor: { type: "system" },
      payload: { timer: p.timer, ...move.payload },
      client,
    });
    return true;
  } catch (e) {
    // The task moved on between the validity check and now: the timer has nothing left to do.
    if (e instanceof TransitionError && (e.code === "unexpected_status" || e.code === "illegal")) return false;
    throw e;
  }
}

const ACTIONS: Record<TimerName, (client: SupabaseClient, p: TimerPayload) => Promise<void>> = {
  async confirmExpiry(client, p) {
    await client.from("confirmations").update({ status: "expired" }).eq("task_id", p.task_id).eq("status", "pending");
    await act(client, p, { to: "expired", outcome: "expired", outcomeReason: "confirmation not answered" });
  },

  async optionChoice(client, p) {
    await act(client, p, { to: "expired", outcome: "expired", outcomeReason: "no option chosen" });
  },

  async providerResponse(client, p) {
    // Wave 2 fan-out lands with the artisans skill (M4); until then, no options means no supply.
    await noResponseOutcome(client, p);
  },

  async spotResponse(client, p) {
    await noResponseOutcome(client, p);
  },

  async arrivalCheck(client, p) {
    await opsNote(client, p.task_id, { timer: p.timer, todo: "ask the user whether the provider arrived" });
  },

  async completionCheck(client, p) {
    await act(client, p, { to: "awaiting_confirmation" });
  },

  async safetyCheck(client, p) {
    await openOpsItem(client, {
      task_id: p.task_id,
      reason: "safety",
      priority: 1,
      note: "Home visit past its expected end; check in with the user.",
    });
  },

  async autoComplete(client, p) {
    await act(client, p, { to: "completed", outcome: "auto_completed" });
  },

  async paymentExpiry(client, p) {
    if ((await availableOptions(client, p.task_id)) > 0) await act(client, p, { to: "options_ready" });
    else await act(client, p, { to: "expired", outcome: "expired", outcomeReason: "payment not made" });
  },

  async disputeWindow() {
    // The dispute option is computed from completed_at; nothing to change.
  },
};

async function noResponseOutcome(client: SupabaseClient, p: TimerPayload) {
  if ((await availableOptions(client, p.task_id)) > 0) {
    await act(client, p, { to: "options_ready" });
    return;
  }
  const moved = await act(client, p, { to: "failed", outcome: "no_supply", outcomeReason: "no replies in time" });
  if (moved) await openOpsItem(client, { task_id: p.task_id, reason: "no_supply", priority: 2 });
}

export const taskTimer: JobHandler = async (job, { client }) => {
  const payload = parsePayload(job.payload);
  if (!(await isTimerValid(client, payload))) return;
  await ACTIONS[payload.timer](client, payload);
};
