import { describe, expect, it } from "vitest";
import { AUTOMATIC_TIMERS, isTimerName, TIMER_NAMES, TIMERS, timerDedupeKey, timerPayload, timerRunAt } from "./timers";
import { canTransition, TASK_STATUSES } from "./transitions";

describe("task timers", () => {
  it("define every timer", () => {
    expect(Object.keys(TIMERS).sort()).toEqual([...TIMER_NAMES].sort());
  });

  it("use the SPEC §8.3 dedupe key", () => {
    expect(timerDedupeKey("t1", "autoComplete", "e9")).toBe("t1:autoComplete:e9");
  });

  it("compute run times from the default delays", () => {
    const from = new Date("2026-10-15T10:00:00Z");
    expect(timerRunAt("confirmExpiry", from).toISOString()).toBe("2026-10-15T10:30:00.000Z");
    expect(timerRunAt("autoComplete", from).toISOString()).toBe("2026-10-16T10:00:00.000Z");
    expect(timerRunAt("spotResponse", from).toISOString()).toBe("2026-10-15T10:10:00.000Z");
  });

  it("require an explicit time for slot-based timers", () => {
    const from = new Date("2026-10-15T10:00:00Z");
    expect(() => timerRunAt("arrivalCheck", from)).toThrow(/explicit runAt/);
    const at = new Date("2026-10-15T14:30:00Z");
    expect(timerRunAt("arrivalCheck", from, at)).toBe(at);
  });

  it("schedule automatic timers only for statuses they're valid in", () => {
    for (const [status, timers] of Object.entries(AUTOMATIC_TIMERS)) {
      for (const t of timers ?? []) expect(TIMERS[t].validStatuses).toContain(status);
    }
  });

  it("only act through legal transitions", () => {
    const targets: Partial<Record<(typeof TIMER_NAMES)[number], string[]>> = {
      confirmExpiry: ["expired"],
      optionChoice: ["expired"],
      providerResponse: ["options_ready", "failed"],
      spotResponse: ["options_ready", "failed"],
      completionCheck: ["awaiting_confirmation"],
      autoComplete: ["completed"],
      paymentExpiry: ["options_ready", "expired"],
    };
    for (const [timer, tos] of Object.entries(targets)) {
      for (const from of TIMERS[timer as keyof typeof TIMERS].validStatuses) {
        for (const to of tos) expect(canTransition(from, to as (typeof TASK_STATUSES)[number])).toBe(true);
      }
    }
  });

  it("build payloads with a copy of the valid statuses", () => {
    const p = timerPayload("t1", "completionCheck", "e1");
    expect(p).toEqual({
      task_id: "t1",
      timer: "completionCheck",
      valid_statuses: ["booked", "in_progress"],
      anchor_event_id: "e1",
    });
    p.valid_statuses.push("draft");
    expect(TIMERS.completionCheck.validStatuses).toEqual(["booked", "in_progress"]);
  });

  it("recognise timer names", () => {
    expect(isTimerName("autoComplete")).toBe(true);
    expect(isTimerName("nope")).toBe(false);
  });
});
