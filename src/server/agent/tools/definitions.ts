import "server-only";
import { z } from "zod";
import { mergePrefs, type Prefs } from "@/lib/prefs";
import { verifiedResources } from "@/lib/safety/emergency-resources";
import { M4_TOOLS } from "./m4";
import type { AnyTool, ToolDefinition } from "./types";

/*
 * M3 tools: enough for the stub skill and the confirmation path. Each later skill adds its own tools here.
 * Tools take references, never phone numbers or coordinates (R14). Outputs that carry facts include
 * `source` and `asOf` (R3).
 */

const PREFERENCE_KEYS = [
  "language",
  "budget_default_kobo",
  "notification_channel",
  "overnight_power_alerts",
  "power_kwh_per_day",
] as const;

/** Where each preference lives in profiles.prefs (lib/prefs.ts). */
function prefPatch(key: (typeof PREFERENCE_KEYS)[number], value: string): Partial<Prefs> {
  switch (key) {
    case "power_kwh_per_day":
      return { power: { kwh_per_day: Number(value) } };
    case "overnight_power_alerts":
      return { power: { overnight_alerts: /^(true|yes|on|1)$/i.test(value) } };
    case "language":
      return { language: value === "pcm" ? "pcm" : "en" };
    default:
      return { [key]: value } as Partial<Prefs>;
  }
}

function define<I extends z.ZodType, O>(def: ToolDefinition<I, O>): ToolDefinition<I, O> {
  return def;
}

export const getUserContext = define({
  name: "get_user_context",
  description: "The user's language, saved place labels, power cluster name and preferences. No contact details.",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    const [{ data: profile }, { data: places }] = await Promise.all([
      ctx.client.from("profiles").select("display_name, language, power_area_id, prefs").eq("id", ctx.userId).single(),
      ctx.client.from("saved_places").select("label, area_id").eq("user_id", ctx.userId).limit(10),
    ]);
    const areaIds = [profile?.power_area_id, ...(places ?? []).map((p) => p.area_id)].filter(Boolean) as string[];
    const { data: areas } = areaIds.length
      ? await ctx.client.from("areas").select("id, name").in("id", areaIds)
      : { data: [] as { id: string; name: string }[] };
    const areaName = (id: string | null | undefined) => areas?.find((a) => a.id === id)?.name ?? null;
    return {
      firstName: (profile?.display_name ?? "").split(" ")[0] || null,
      language: profile?.language ?? "en",
      powerCluster: areaName(profile?.power_area_id),
      savedPlaces: (places ?? []).map((p) => ({ label: p.label, area: areaName(p.area_id) })),
      prefs: profile?.prefs ?? {},
      source: "Your Oya profile",
      asOf: new Date().toISOString(),
    };
  },
});

export const emergencyGuidance = define({
  name: "emergency_guidance",
  description: "Ops-verified emergency numbers. Call this if someone may be in danger; the app shows the card.",
  sideEffect: "read",
  input: z.object({}),
  async handler() {
    return {
      numbers: verifiedResources()
        .filter((r) => r.kind !== "self_harm")
        .map((r) => ({ label: r.label, tollFree: r.tollFree })),
      note: "Numbers are shown on the emergency card; don't repeat them in text.",
      source: "Oya emergency list (ops-verified)",
      asOf: new Date().toISOString(),
    };
  },
});

export const listKbDocuments = define({
  name: "list_kb_documents",
  description: "The published, verified guides Oya has (government paperwork). Returns slugs, titles and one-liners.",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    const { data, error } = await ctx.client
      .from("kb_documents")
      .select("slug, title, one_liner, last_verified_at")
      .eq("status", "published")
      .order("title")
      .limit(60);
    if (error) throw new Error(error.message);
    return { documents: data ?? [], source: "Oya guides", asOf: new Date().toISOString() };
  },
});

export const getKbDocument = define({
  name: "get_kb_document",
  description: "One published guide by slug: steps, official fees, required documents, official links, last checked.",
  sideEffect: "read",
  input: z.object({ slug: z.string().max(80) }),
  async handler({ slug }, ctx) {
    const { data, error } = await ctx.client
      .from("kb_documents")
      .select(
        "slug, title, one_liner, body_md, steps, fees, required_documents, official_urls, last_verified_at, version",
      )
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { found: false, slug, source: "Oya guides", asOf: new Date().toISOString() };
    return { found: true, document: data, source: "Official fee · checked", asOf: data.last_verified_at };
  },
});

export const searchKbText = define({
  name: "search_kb_text",
  description: "Full-text search over published guides when no slug obviously matches.",
  sideEffect: "read",
  input: z.object({ query: z.string().min(2).max(120) }),
  async handler({ query }, ctx) {
    const { data, error } = await ctx.client
      .from("kb_documents")
      .select("slug, title, one_liner")
      .eq("status", "published")
      .textSearch("tsv", query, { type: "websearch", config: "english" })
      .limit(5);
    if (error) throw new Error(error.message);
    return { results: data ?? [], source: "Oya guides", asOf: new Date().toISOString() };
  },
});

export const recordPreference = define({
  name: "record_preference",
  description:
    "Propose remembering one of the user's preferences. The app asks the user to confirm before saving (§7.7).",
  sideEffect: "write_internal",
  input: z.object({
    key: z.enum(PREFERENCE_KEYS),
    value: z.string().max(80),
  }),
  confirmation: {
    kind: "preference",
    summarise: ({ key, value }) => ({
      title: "Remember this?",
      lines: [`${key.replace(/_/g, " ")}: ${value}`, "You can see and delete it in Settings."],
    }),
  },
  async handler({ key, value }, ctx) {
    const { data: profile } = await ctx.client.from("profiles").select("prefs").eq("id", ctx.userId).single();
    const prefs = mergePrefs(profile?.prefs, prefPatch(key, value));
    const { error } = await ctx.client.from("profiles").update({ prefs }).eq("id", ctx.userId);
    if (error) throw new Error(error.message);
    return { saved: true, key, value, source: "Your Oya profile", asOf: new Date().toISOString() };
  },
});

export const escalateToHuman = define({
  name: "escalate_to_human",
  description: "Ask an Oya teammate to help. Creates an ops item. Returns whether a teammate is online now.",
  sideEffect: "write_internal",
  input: z.object({ reason: z.enum(["tool_failure", "low_confidence_transcript", "kb_gap", "no_supply"]) }),
  async handler({ reason }, ctx) {
    const { error } = await ctx.client.from("ops_queue").insert({
      task_id: ctx.taskId,
      reason,
      priority: 2,
      meta: { conversation_id: ctx.conversationId },
    });
    if (error) throw new Error(error.message);
    const hour = Number(
      new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23" }).format(
        new Date(),
      ),
    );
    const online = hour >= 8 && hour < 18; // coverage hours (§7.11), from config in M7
    return {
      created: true,
      teammateOnlineNow: online,
      coverage: "08:00–18:00",
      source: "Oya team",
      asOf: new Date().toISOString(),
    };
  },
});

export const ALL_TOOLS: AnyTool[] = [
  ...M4_TOOLS,
  getUserContext,
  emergencyGuidance,
  listKbDocuments,
  getKbDocument,
  searchKbText,
  recordPreference,
  escalateToHuman,
];

export const TOOLS_BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));
export type ToolName = (typeof ALL_TOOLS)[number]["name"];
