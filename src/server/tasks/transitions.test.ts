import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allTransitions,
  canTransition,
  isTaskStatus,
  isTerminal,
  TASK_STATUSES,
  TERMINAL_STATUSES,
  TRANSITIONS,
} from "./transitions";

/** The (from, to) pairs in the latest definition of public.task_transition_allowed. */
function sqlTransitions(): Set<string> {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let body: string | undefined;
  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    const m = sql.match(/function public\.task_transition_allowed\([\s\S]*?\$\$([\s\S]*?)\$\$/);
    if (m) body = m[1];
  }
  if (!body) throw new Error("task_transition_allowed not found in migrations");
  return new Set([...body.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)].map((m) => `${m[1]}->${m[2]}`));
}

describe("task transitions", () => {
  it("match the Postgres table exactly", () => {
    const ts = new Set(allTransitions().map(([a, b]) => `${a}->${b}`));
    expect([...ts].sort()).toEqual([...sqlTransitions()].sort());
  });

  it("cover every status", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual([...TASK_STATUSES].sort());
  });

  it("only point at known statuses", () => {
    for (const [, to] of allTransitions()) expect(isTaskStatus(to)).toBe(true);
  });

  it("have no way out of terminal statuses", () => {
    for (const s of TERMINAL_STATUSES) {
      expect(TRANSITIONS[s]).toEqual([]);
      expect(isTerminal(s)).toBe(true);
    }
    expect(isTerminal("completed")).toBe(false);
  });

  it("allow the SPEC §8.2 examples and reject illegal ones", () => {
    expect(canTransition("awaiting_responses", "awaiting_responses")).toBe(true); // wave 2
    expect(canTransition("completed", "disputed")).toBe(true);
    expect(canTransition("booked", "options_ready")).toBe(true); // no-show → next option
    expect(canTransition("draft", "booked")).toBe(false);
    expect(canTransition("awaiting_confirmation", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "draft")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });

  it("let every non-terminal status reach a terminal or completed state", () => {
    const reaches = (from: string, seen = new Set<string>()): boolean => {
      if (isTerminal(from as never) || from === "completed") return true;
      seen.add(from);
      return TRANSITIONS[from as keyof typeof TRANSITIONS].some((to) => !seen.has(to) && reaches(to, seen));
    };
    for (const s of TASK_STATUSES) expect(reaches(s)).toBe(true);
  });

  it("recognise statuses", () => {
    expect(isTaskStatus("booked")).toBe(true);
    expect(isTaskStatus("Booked")).toBe(false);
    expect(isTaskStatus(3)).toBe(false);
  });
});
