import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkMigration, findObjects } from "./migration-grants";

describe("findObjects", () => {
  it("finds tables, views and functions, ignoring SQL inside function bodies", () => {
    const sql = `
      create table if not exists public.a (id int);
      create table b (id int);
      create or replace view public.v as select 1;
      create function internal.claim_jobs(p int) returns void language sql as $$ create table not_real (x int) $$;
    `;
    expect(findObjects(sql).map((o) => `${o.kind}:${o.name}`)).toEqual([
      "table:public.a",
      "table:public.b",
      "view:public.v",
      "function:internal.claim_jobs",
    ]);
  });
});

describe("checkMigration", () => {
  it("passes a fully granted table, view and function", () => {
    const sql = `
      create table public.a (id int);
      alter table public.a enable row level security;
      grant select on table public.a to authenticated;
      create view public.v as select 1;
      revoke all on public.v from anon, authenticated;
      create function public.f() returns int language sql as $$ select 1 $$;
      revoke execute on function public.f() from public, anon, authenticated;
    `;
    expect(checkMigration("m.sql", sql)).toEqual([]);
  });

  it("reports what's missing, with line numbers", () => {
    const sql =
      "\ncreate table public.a (id int);\ncreate function public.f() returns int language sql as $$ select 1 $$;\ncreate view public.v as select 1;";
    const problems = checkMigration("m.sql", sql).map((f) => `${f.line} ${f.object} ${f.problem}`);
    expect(problems).toEqual([
      "2 public.a table without `enable row level security`",
      "2 public.a table without an explicit GRANT or REVOKE",
      "3 public.f function without `revoke execute on function … from public`",
      "4 public.v view without an explicit GRANT or REVOKE",
    ]);
  });

  it("doesn't count a GRANT EXECUTE as the required REVOKE", () => {
    const sql =
      "create function public.f() returns int language sql as $$ select 1 $$;\ngrant execute on function public.f() to anon;";
    expect(checkMigration("m.sql", sql)).toHaveLength(1);
  });

  it("handles multi-object grants and quoted names", () => {
    const sql = `
      create table "public"."A" (id int);
      create table public.b (id int);
      alter table "public"."A" enable row level security;
      alter table public.b enable row level security;
      revoke all on public."A", public.b from anon, authenticated;
    `;
    expect(checkMigration("m.sql", sql)).toEqual([]);
  });

  it("ignores statements in comments and honours explicit exemptions", () => {
    const sql = `
      -- create table public.commented (id int);
      /* create table public.blocked (id int); */
      -- grants-check: ignore public.legacy imported from an older schema
      create table public.legacy (id int);
    `;
    expect(checkMigration("m.sql", sql)).toEqual([]);
  });

  it("passes every migration in the repo", () => {
    const dir = join(process.cwd(), "supabase", "migrations");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql"))) {
      expect(checkMigration(f, readFileSync(join(dir, f), "utf8")), f).toEqual([]);
    }
  });
});
