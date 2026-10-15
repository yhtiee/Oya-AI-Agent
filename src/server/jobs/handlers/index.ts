import "server-only";
import type { JobHandler, JobType } from "../types";
import { powerStatusRecompute } from "./power";
import { taskTimer } from "./task-timer";

/*
 * Job handlers by type. Types without a handler yet belong to later milestones; a job of such a type
 * goes straight to `dead` (and shows up in the ops alert) rather than retrying forever.
 */
export const HANDLERS: Partial<Record<JobType, JobHandler>> = {
  task_timer: taskTimer,
  power_status_recompute: powerStatusRecompute,
};
