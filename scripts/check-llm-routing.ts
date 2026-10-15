/*
 * CI rule (SPEC §10.1a, §20.1): a purpose may be `enabled` (or `fallbackEnabled`) only if evals/reports/ holds a
 * passing full-run report for that model and purpose, for every suite the purpose needs, dated within 30 days.
 *
 *   pnpm check:llm-routing
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PURPOSES, ROUTING, type ModelRef, type Purpose } from "../src/server/integrations/llm/config";

const SUITES: Record<Purpose, string[]> = {
  router: ["router", "safety"],
  safety_classifier: ["safety"],
  simple_skill: ["golden"],
  complex_skill: ["golden"],
  eval_grader: [], // offline grading, never user-facing
};

const MAX_AGE_DAYS = 30;

function reportProblem(ref: ModelRef, purpose: Purpose, suite: string, now: Date): string | null {
  const file = join("evals", "reports", `${ref.provider}-${ref.model.replace(/[/:]/g, "_")}-${purpose}-${suite}.json`);
  if (!existsSync(file)) return `no ${suite} report (${file})`;
  const r = JSON.parse(readFileSync(file, "utf8")) as { passed?: boolean; fullRun?: boolean; date?: string };
  if (!r.passed || !r.fullRun) return `${suite} report didn't pass a full run`;
  const age = (now.getTime() - Date.parse(r.date ?? "")) / 86_400_000;
  if (!(age <= MAX_AGE_DAYS)) return `${suite} report is older than ${MAX_AGE_DAYS} days`;
  return null;
}

export function checkRouting(now = new Date()): string[] {
  const problems: string[] = [];
  for (const purpose of PURPOSES) {
    const cfg = ROUTING.purposes[purpose];
    const checks: [string, ModelRef | null, boolean][] = [
      ["primary", cfg.primary, cfg.enabled],
      ["fallback", cfg.fallback, cfg.fallbackEnabled],
    ];
    for (const [role, ref, on] of checks) {
      if (!on) continue;
      if (!ref) {
        problems.push(`${purpose}: ${role} is enabled but not configured`);
        continue;
      }
      for (const suite of SUITES[purpose]) {
        const p = reportProblem(ref, purpose, suite, now);
        if (p) problems.push(`${purpose} ${role} ${ref.provider}:${ref.model}: ${p}`);
      }
    }
  }
  return problems;
}

if (process.argv[1]?.endsWith("check-llm-routing.ts")) {
  const problems = checkRouting();
  if (problems.length) {
    console.error(`check-llm-routing: ${problems.length} problem(s)\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    process.exit(1);
  }
  console.log("check-llm-routing: every enabled purpose has a passing eval report");
}
