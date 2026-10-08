import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkMigration } from "./lib/migration-grants";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const findings = files.flatMap((f) => checkMigration(`supabase/migrations/${f}`, readFileSync(join(dir, f), "utf8")));

if (findings.length > 0) {
  console.error(`check-migration-grants: ${findings.length} problem(s)\n`);
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.object}  ${f.problem}`);
  console.error("\nSee SPEC §12.1. To exempt one object, add: -- grants-check: ignore <schema.name> <reason>");
  process.exit(1);
}

console.log(`check-migration-grants: ${files.length} migration(s) OK`);
