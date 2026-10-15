/*
 * Task statuses, outcomes and the allowed transitions (SPEC §8.1, §8.2).
 *
 * Postgres enforces the same table in public.task_transition_allowed(); transitions.test.ts parses
 * the migration and fails if the two ever disagree. This copy exists so server code can check a
 * move before calling the database and so tests can enumerate every row.
 */

export const TASK_STATUSES = [
  "draft",
  "needs_info",
  "confirming",
  "awaiting_responses",
  "options_ready",
  "booked",
  "awaiting_payment",
  "in_progress",
  "awaiting_confirmation",
  "completed",
  "disputed",
  "cancelled",
  "failed",
  "expired",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_OUTCOMES = [
  "sorted",
  "auto_completed",
  "no_supply",
  "user_cancelled",
  "provider_cancelled",
  "no_show",
  "expired",
  "failed_other",
  "dispute_upheld",
  "dispute_rejected",
] as const;

export type TaskOutcome = (typeof TASK_OUTCOMES)[number];

/** No way out of these; entering one needs an outcome. */
export const TERMINAL_STATUSES = ["cancelled", "failed", "expired"] as const satisfies readonly TaskStatus[];

export const TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  draft: ["needs_info", "confirming", "options_ready", "completed", "failed", "cancelled"],
  needs_info: ["confirming", "options_ready", "failed", "cancelled", "expired"],
  confirming: ["awaiting_responses", "booked", "needs_info", "options_ready", "failed", "cancelled", "expired"],
  awaiting_responses: ["awaiting_responses", "options_ready", "booked", "failed", "cancelled"],
  options_ready: ["confirming", "awaiting_responses", "failed", "cancelled", "expired"],
  booked: [
    "awaiting_payment",
    "in_progress",
    "awaiting_confirmation",
    "options_ready",
    "awaiting_responses",
    "cancelled",
    "disputed",
  ],
  awaiting_payment: ["booked", "in_progress", "options_ready", "cancelled", "expired"],
  in_progress: ["awaiting_payment", "awaiting_confirmation", "cancelled", "disputed"],
  awaiting_confirmation: ["completed", "disputed"],
  completed: ["disputed"],
  disputed: ["completed", "cancelled", "failed"],
  cancelled: [],
  failed: [],
  expired: [],
};

/** The dispute window after completion (SPEC §8.2). */
export const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000;

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === "string" && (TASK_STATUSES as readonly string[]).includes(value);
}

export function isTerminal(status: TaskStatus): boolean {
  return (TERMINAL_STATUSES as readonly TaskStatus[]).includes(status);
}

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Every allowed (from, to) pair, for tests and the CI coverage check. */
export function allTransitions(): [TaskStatus, TaskStatus][] {
  return TASK_STATUSES.flatMap((from) => TRANSITIONS[from].map((to) => [from, to] as [TaskStatus, TaskStatus]));
}
