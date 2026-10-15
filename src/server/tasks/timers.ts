import type { TaskStatus } from "./transitions";

/*
 * Task timers (SPEC §8.3). A timer is an internal.jobs row of type `task_timer`; it acts only if the task
 * is still in one of `validStatuses` and hasn't left them since the status_change that scheduled it
 * (public.task_timer_valid). Durations are Pilot 0 defaults.
 */

export const TIMER_NAMES = [
  "confirmExpiry",
  "providerResponse",
  "spotResponse",
  "optionChoice",
  "arrivalCheck",
  "completionCheck",
  "safetyCheck",
  "autoComplete",
  "paymentExpiry",
  "disputeWindow",
] as const;

export type TimerName = (typeof TIMER_NAMES)[number];

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type TimerDef = {
  validStatuses: readonly TaskStatus[];
  /** Fixed delay from the anchoring transition. Timers without one need an explicit runAt (slot times). */
  delayMs?: number;
};

export const TIMERS: Readonly<Record<TimerName, TimerDef>> = {
  confirmExpiry: { validStatuses: ["confirming"], delayMs: 30 * MINUTE },
  providerResponse: { validStatuses: ["awaiting_responses"], delayMs: 20 * MINUTE },
  spotResponse: { validStatuses: ["awaiting_responses"], delayMs: 10 * MINUTE },
  optionChoice: { validStatuses: ["options_ready"], delayMs: 60 * MINUTE },
  arrivalCheck: { validStatuses: ["booked"] },
  completionCheck: { validStatuses: ["booked", "in_progress"] },
  safetyCheck: { validStatuses: ["in_progress"] },
  autoComplete: { validStatuses: ["awaiting_confirmation"], delayMs: 24 * HOUR },
  paymentExpiry: { validStatuses: ["awaiting_payment"], delayMs: 30 * MINUTE },
  disputeWindow: { validStatuses: ["completed"], delayMs: 72 * HOUR },
};

/** Timers every entry into a status schedules, whatever the skill (the rest need slot times from the caller). */
export const AUTOMATIC_TIMERS: Partial<Record<TaskStatus, TimerName[]>> = {
  confirming: ["confirmExpiry"],
  options_ready: ["optionChoice"],
  awaiting_confirmation: ["autoComplete"],
  awaiting_payment: ["paymentExpiry"],
  completed: ["disputeWindow"],
};

export type TimerPayload = {
  task_id: string;
  timer: TimerName;
  valid_statuses: TaskStatus[];
  anchor_event_id: string;
};

export function isTimerName(value: unknown): value is TimerName {
  return typeof value === "string" && (TIMER_NAMES as readonly string[]).includes(value);
}

/** SPEC §8.3: dedupe_key = '{task_id}:{timer}:{anchor_event_id}'. */
export function timerDedupeKey(taskId: string, timer: TimerName, anchorEventId: string): string {
  return `${taskId}:${timer}:${anchorEventId}`;
}

export function timerRunAt(timer: TimerName, from: Date, explicit?: Date): Date {
  if (explicit) return explicit;
  const delay = TIMERS[timer].delayMs;
  if (delay === undefined) throw new Error(`timer ${timer} needs an explicit runAt`);
  return new Date(from.getTime() + delay);
}

export function timerPayload(taskId: string, timer: TimerName, anchorEventId: string): TimerPayload {
  return { task_id: taskId, timer, valid_statuses: [...TIMERS[timer].validStatuses], anchor_event_id: anchorEventId };
}
