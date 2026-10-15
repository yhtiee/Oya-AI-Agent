/*
 * Imports areas from a GeoJSON FeatureCollection into public.areas (SPEC §12.2, §5.1).
 *
 *   pnpm tsx scripts/import-areas.ts <file.geojson> --source osm-2026-10 [--parent <area id>] [--dry-run]
 *
 * Each feature needs `properties.name` and `properties.kind` (country, state, lga, neighbourhood, estate,
 * campus, power_cluster) and a Polygon or MultiPolygon geometry. `properties.parent` (a name) nests a
 * feature under another feature in the same file; otherwise --parent applies. Re-running is safe:
 * areas are matched by (name, kind, parent) and updated in place.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const KINDS = ["country", "state", "lga", "neighbourhood", "estate", "campus", "power_cluster"] as const;
type Kind = (typeof KINDS)[number];

type Feature = {
  type: "Feature";
  properties: { name?: string; kind?: string; parent?: string; active?: boolean };
  geometry: { type: string; coordinates: unknown } | null;
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = process.argv[2];
  const source = arg("source");
  if (!file || file.startsWith("--") || !source) {
    console.error("usage: tsx scripts/import-areas.ts <file.geojson> --source <label> [--parent <id>] [--dry-run]");
    process.exit(2);
  }
  const dryRun = process.argv.includes("--dry-run");
  const rootParent = arg("parent") ?? null;

  const collection = JSON.parse(readFileSync(file, "utf8")) as { features?: Feature[] };
  const features = collection.features ?? [];
  const problems: string[] = [];
  features.forEach((f, i) => {
    const { name, kind } = f.properties ?? {};
    if (!name?.trim()) problems.push(`feature ${i}: missing properties.name`);
    if (!KINDS.includes(kind as Kind)) problems.push(`feature ${i} (${name}): kind must be one of ${KINDS.join(", ")}`);
    if (f.geometry && !["Polygon", "MultiPolygon"].includes(f.geometry.type)) {
      problems.push(`feature ${i} (${name}): geometry must be Polygon or MultiPolygon, got ${f.geometry.type}`);
    }
  });
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }

  // Parents first: a feature whose parent is in the file waits until that parent has an id.
  const byName = new Map(features.map((f) => [f.properties.name!.trim().toLowerCase(), f]));
  const depth = (f: Feature, seen = new Set<Feature>()): number => {
    const p = f.properties.parent && byName.get(f.properties.parent.trim().toLowerCase());
    if (!p || seen.has(f)) return 0;
    seen.add(f);
    return 1 + depth(p, seen);
  };
  const ordered = [...features].sort((a, b) => depth(a) - depth(b));

  if (dryRun) {
    for (const f of ordered) console.log(`${"  ".repeat(depth(f))}${f.properties.kind}: ${f.properties.name}`);
    console.log(`${ordered.length} area(s) would be imported (dry run).`);
    return;
  }

  process.loadEnvFile?.(".env");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const ids = new Map<string, string>();
  for (const f of ordered) {
    const name = f.properties.name!.trim();
    const parentName = f.properties.parent?.trim().toLowerCase();
    const parentId = parentName && ids.has(parentName) ? ids.get(parentName)! : rootParent;
    const { data, error } = await db.rpc("upsert_area", {
      p_name: name,
      p_kind: f.properties.kind,
      p_parent_id: parentId,
      p_geojson: f.geometry,
      p_source: source,
      p_active: f.properties.active ?? true,
    });
    if (error) throw new Error(`${name}: ${error.message}`);
    ids.set(name.toLowerCase(), data as string);
    console.log(`ok  ${f.properties.kind}: ${name}`);
  }
  console.log(`${ids.size} area(s) imported from ${file}.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
