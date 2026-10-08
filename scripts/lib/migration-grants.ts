/*
 * Checks a migration for the statements SPEC §12.1 requires (R6):
 *  - every table:    `enable row level security` and an explicit GRANT or REVOKE on it
 *  - every view:     an explicit GRANT or REVOKE on it
 *  - every function: `revoke execute on function …` (Postgres grants EXECUTE to PUBLIC by default)
 *
 * Opt out for one object with a comment that says why:
 *   -- grants-check: ignore public.some_table reason goes here
 */

export type Finding = { file: string; line: number; object: string; problem: string };

type Obj = { kind: "table" | "view" | "function"; name: string; line: number };

const IDENT = String.raw`(?:"[^"]+"|[a-z_][a-z0-9_$]*)`;
const QUALIFIED = String.raw`(${IDENT}(?:\s*\.\s*${IDENT})?)`;

function normalise(name: string): string {
  const bare = name.replace(/"/g, "").replace(/\s+/g, "").toLowerCase();
  return bare.includes(".") ? bare : `public.${bare}`;
}

function stripComments(sql: string): string {
  // Keep line structure so reported line numbers stay right.
  return sql.replace(/--[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

/** Removes the bodies of `$tag$ … $tag$` blocks, so SQL inside functions isn't mistaken for DDL. */
function stripDollarBodies(sql: string): string {
  return sql.replace(/\$([a-z_]*)\$[\s\S]*?\$\1\$/gi, (m) => m.replace(/[^\n]/g, " "));
}

function lineAt(sql: string, index: number): number {
  return sql.slice(0, index).split("\n").length;
}

export function findObjects(sql: string): Obj[] {
  const clean = stripDollarBodies(stripComments(sql));
  const objects: Obj[] = [];
  const patterns: [Obj["kind"], RegExp][] = [
    ["table", new RegExp(String.raw`\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`, "gi")],
    [
      "view",
      new RegExp(
        String.raw`\bcreate\s+(?:or\s+replace\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?${QUALIFIED}`,
        "gi",
      ),
    ],
    ["function", new RegExp(String.raw`\bcreate\s+(?:or\s+replace\s+)?function\s+${QUALIFIED}\s*\(`, "gi")],
  ];
  for (const [kind, re] of patterns) {
    for (const m of clean.matchAll(re)) objects.push({ kind, name: normalise(m[1]), line: lineAt(clean, m.index!) });
  }
  return objects.sort((a, b) => a.line - b.line);
}

function ignored(sql: string): Set<string> {
  const names = new Set<string>();
  for (const m of sql.matchAll(/--\s*grants-check:\s*ignore\s+(\S+)\s+\S+/gi)) names.add(normalise(m[1]));
  return names;
}

/** Every name a statement mentions, e.g. `grant select on public.a, public.b to …` → both. */
function namesIn(list: string): string[] {
  return list
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalise(s.replace(/\(.*$/s, "")));
}

export function checkMigration(file: string, sql: string): Finding[] {
  const clean = stripDollarBodies(stripComments(sql));
  const skip = ignored(sql);

  const rls = new Set<string>();
  for (const m of clean.matchAll(
    new RegExp(String.raw`\balter\s+table\s+(?:only\s+)?${QUALIFIED}\s+enable\s+row\s+level\s+security`, "gi"),
  )) {
    rls.add(normalise(m[1]));
  }

  const relationGrants = new Set<string>();
  const functionRevokes = new Set<string>();
  for (const m of clean.matchAll(
    /\b(grant|revoke)\s+([\s\S]*?)\s+on\s+(table\s+|function\s+|all\s+tables\s+in\s+schema\s+)?([\s\S]*?)\s+(?:to|from)\s/gi,
  )) {
    const verb = m[1].toLowerCase();
    const target = (m[3] ?? "").trim().toLowerCase();
    if (target.startsWith("all tables")) continue;
    if (target === "function") {
      if (verb === "revoke") for (const name of namesIn(m[4])) functionRevokes.add(name);
    } else {
      for (const name of namesIn(m[4])) relationGrants.add(name);
    }
  }

  const findings: Finding[] = [];
  for (const obj of findObjects(sql)) {
    if (skip.has(obj.name)) continue;
    if (obj.kind === "table") {
      if (!rls.has(obj.name))
        findings.push({ file, line: obj.line, object: obj.name, problem: "table without `enable row level security`" });
      if (!relationGrants.has(obj.name))
        findings.push({ file, line: obj.line, object: obj.name, problem: "table without an explicit GRANT or REVOKE" });
    } else if (obj.kind === "view") {
      if (!relationGrants.has(obj.name))
        findings.push({ file, line: obj.line, object: obj.name, problem: "view without an explicit GRANT or REVOKE" });
    } else if (!functionRevokes.has(obj.name)) {
      findings.push({
        file,
        line: obj.line,
        object: obj.name,
        problem: "function without `revoke execute on function … from public`",
      });
    }
  }
  return findings;
}
