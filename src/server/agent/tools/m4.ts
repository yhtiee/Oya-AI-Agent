import "server-only";
import { z } from "zod";
import { estimateDays, USAGE_PRESETS } from "@/lib/power/units";
import { parsePrefs } from "@/lib/prefs";
import { describeRepeat, formatWhen, parseWhen } from "@/lib/reminders/parse-time";
import { alertsForUser } from "../../alerts/service";
import { cancelWatch, createPowerWatch, getPowerStatus, listClusters, reportPower } from "../../power/service";
import { cancelReminder, createReminder, listReminders } from "../../reminders/service";
import { ToolInputError, type ToolDefinition } from "./types";

/*
 * M4 tools: power & light, reminders & watches, local alerts (SPEC §7.5). Outputs carry `source` and `asOf`.
 * Side effects that need consent (watches, reminders) go through confirmations; one-tap reports don't (the user
 * tapped or typed the report themselves).
 */

function define<I extends z.ZodType, O>(def: ToolDefinition<I, O>): ToolDefinition<I, O> {
  return def;
}

const now = () => new Date().toISOString();

export const getPowerStatusTool = define({
  name: "get_power_status",
  description:
    "Power status in the user's power cluster: on/off/uncertain/unknown, confidence, last change, reporter count. If the user has no cluster yet it returns needsCluster with clusters to choose from (the app shows a picker).",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    const r = await getPowerStatus(ctx.client, ctx.userId);
    return { ...r, source: "Neighbour reports", asOf: r.needsCluster ? now() : (r.computedAt ?? now()) };
  },
});

export const submitPowerReportTool = define({
  name: "submit_power_report",
  description: "Record the user's own report that light is ON or OFF in their cluster, when they say so.",
  sideEffect: "write_internal",
  input: z.object({ status: z.enum(["on", "off"]) }),
  async handler({ status }, ctx) {
    const r = await reportPower(ctx.client, ctx.userId, status);
    return { ...r, source: "Your report", asOf: now() };
  },
});

export const listPowerClustersTool = define({
  name: "list_power_clusters",
  description:
    "Power areas (one transformer each) the user can pick from, optionally filtered by a street or estate name.",
  sideEffect: "read",
  input: z.object({ query: z.string().max(60).optional() }),
  async handler({ query }, ctx) {
    return { needsCluster: true, clusters: await listClusters(ctx.client, query), source: "Oya areas", asOf: now() };
  },
});

export const estimateUnitsTool = define({
  name: "estimate_units_days",
  description:
    "Estimate how many days prepaid units will last. Uses the user's saved daily use, or kwh_per_day if given (small flat about 3, family home about 8). If neither is known it returns needsUsage: ask the user once.",
  sideEffect: "read",
  input: z.object({ units: z.number().min(0).max(100000), kwh_per_day: z.number().positive().max(200).optional() }),
  async handler({ units, kwh_per_day }, ctx) {
    const { data } = await ctx.client.from("profiles").select("prefs").eq("id", ctx.userId).single();
    const saved = parsePrefs(data?.prefs).power?.kwh_per_day;
    const kwh = kwh_per_day ?? saved;
    if (!kwh) return { needsUsage: true, presets: USAGE_PRESETS, source: "Oya estimate", asOf: now() };
    return { ...estimateDays(units, kwh), estimate: true, source: "Oya estimate", asOf: now() };
  },
});

export const createWatchTool = define({
  name: "create_watch",
  description:
    "Propose an alert for when power comes back (power_on) or goes off (power_off) in the user's cluster. The app asks the user to confirm.",
  sideEffect: "write_internal",
  input: z.object({ type: z.enum(["power_on", "power_off"]), area_id: z.string().uuid().optional() }),
  confirmation: {
    kind: "watch",
    async prepare(input, ctx) {
      const r = await getPowerStatus(ctx.client, ctx.userId, input.area_id);
      if (r.needsCluster)
        throw new ToolInputError(
          "The user hasn't picked their power area yet. Call get_power_status so the app shows the picker.",
        );
      return { ...input, area_id: r.area.id, area_name: r.area.name } as typeof input;
    },
    summarise: (input, ctx) => {
      const area = (input as { area_name?: string }).area_name ?? "your area";
      const pcm = ctx.language === "pcm";
      return {
        title: pcm ? "Make I alert you?" : "Set this alert?",
        lines: [
          input.type === "power_on"
            ? pcm
              ? `When light come back for ${area}`
              : `When power comes back in ${area}`
            : pcm
              ? `When light go for ${area}`
              : `When power goes off in ${area}`,
          pcm
            ? "Quiet from 10pm to 6am unless you turn on night alerts."
            : "Quiet 10pm–6am unless you turn on overnight alerts.",
        ],
      };
    },
  },
  async handler(input, ctx) {
    const w = await createPowerWatch(ctx.client, ctx.userId, input.type, input.area_id!);
    return { watchId: w.id, created: w.created, type: input.type, source: "Your alerts", asOf: now() };
  },
});

export const cancelWatchTool = define({
  name: "cancel_watch",
  description: "Stop one of the user's alerts by id (from list_watches).",
  sideEffect: "write_internal",
  input: z.object({ watch_id: z.string().uuid() }),
  async handler({ watch_id }, ctx) {
    return { cancelled: await cancelWatch(ctx.client, ctx.userId, watch_id), source: "Your alerts", asOf: now() };
  },
});

export const listWatchesTool = define({
  name: "list_watches",
  description: "The user's active alerts.",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    const { data } = await ctx.client
      .from("watches")
      .select("id, type, area_id, last_fired_at")
      .eq("user_id", ctx.userId)
      .eq("active", true)
      .limit(10);
    return { watches: data ?? [], source: "Your alerts", asOf: now() };
  },
});

export const createReminderTool = define({
  name: "create_reminder",
  description:
    "Propose a reminder. Give the title and the user's own words for when (when_text, e.g. 'tomorrow 9am', 'every month on the 1st', 'next tomorrow'). The server reads the time and the app shows it for the user to confirm.",
  sideEffect: "write_internal",
  input: z.object({
    title: z.string().min(1).max(140),
    when_text: z.string().min(1).max(120),
    important: z.boolean().optional(),
    remind_at: z.string().optional(),
    rrule: z.string().max(300).nullable().optional(),
  }),
  confirmation: {
    kind: "reminder",
    async prepare(input) {
      const parsed = parseWhen(input.when_text);
      if (!parsed) throw new ToolInputError("I couldn't read that time. Ask the user when exactly (day and time).");
      return { ...input, remind_at: parsed.remindAt.toISOString(), rrule: parsed.rrule };
    },
    summarise: (input, ctx) => {
      const when = input.remind_at ? formatWhen(new Date(input.remind_at)) : input.when_text;
      const repeat = describeRepeat(input.rrule ?? null);
      return {
        title: ctx.language === "pcm" ? `${when} — make I set am?` : `${when} — set?`,
        lines: [input.title, ...(repeat ? [repeat] : [])],
      };
    },
  },
  async handler(input, ctx) {
    if (!input.remind_at) throw new Error("reminder time missing");
    const r = await createReminder(ctx.client, ctx.userId, {
      title: input.title,
      remindAt: input.remind_at,
      rrule: input.rrule ?? null,
      important: input.important,
      taskId: ctx.taskId,
    });
    return { reminder: r, source: "Your reminders", asOf: now() };
  },
});

export const listRemindersTool = define({
  name: "list_reminders",
  description: "The user's upcoming reminders.",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    return { reminders: await listReminders(ctx.client, ctx.userId), source: "Your reminders", asOf: now() };
  },
});

export const cancelReminderTool = define({
  name: "cancel_reminder",
  description: "Cancel one of the user's reminders by id (from list_reminders).",
  sideEffect: "write_internal",
  input: z.object({ reminder_id: z.string().uuid() }),
  async handler({ reminder_id }, ctx) {
    return {
      cancelled: await cancelReminder(ctx.client, ctx.userId, reminder_id),
      source: "Your reminders",
      asOf: now(),
    };
  },
});

export const getLocalAlertsTool = define({
  name: "get_local_alerts",
  description:
    "Ops-verified alerts (planned outages, road closures, flooding, official advisories) for the user's area. Never invent or summarise alerts from anywhere else.",
  sideEffect: "read",
  input: z.object({}),
  async handler(_input, ctx) {
    const r = await alertsForUser(ctx.client, ctx.userId);
    return { ...r, source: "Posted by Oya from official sources", asOf: now() };
  },
});

export const M4_TOOLS = [
  getPowerStatusTool,
  submitPowerReportTool,
  listPowerClustersTool,
  estimateUnitsTool,
  createWatchTool,
  cancelWatchTool,
  listWatchesTool,
  createReminderTool,
  listRemindersTool,
  cancelReminderTool,
  getLocalAlertsTool,
];
