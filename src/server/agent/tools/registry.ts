import "server-only";
import { tool, type ToolSet } from "ai";
import { redact } from "@/lib/safety/redact";
import type { ConfirmCard } from "@/types/cards";
import { TOOLS_BY_NAME } from "./definitions";
import type { AnyTool, ToolContext } from "./types";

/*
 * Tool registry (SPEC §7.5, §7.6). Turns tool definitions into the model's tool set for one turn, and:
 *  - validates every input with zod (the SDK does too; this is the server's own check);
 *  - runs read and non-confirming tools, adding their results to the turn's grounding sources;
 *  - for confirming tools, does NOT run the handler: stores the exact validated call as a pending
 *    confirmation and builds a ConfirmCard;
 *  - logs every call (task_events tool_call / ops when there's a task, analytics otherwise), redacted.
 */

export const CONFIRMATION_TTL_S = 30 * 60;

async function logToolCall(ctx: ToolContext, name: string, ok: boolean, ms: number, input: unknown) {
  const summary = { tool: name, ok, ms: Math.round(ms), input: redact(JSON.stringify(input ?? {})).text.slice(0, 500) };
  if (ctx.taskId) {
    await ctx.client.from("task_events").insert({
      task_id: ctx.taskId,
      type: "tool_call",
      visibility: "ops",
      actor_type: "agent",
      payload: summary,
    });
  } else {
    await ctx.client.rpc("track_event", { p_user_id: ctx.userId, p_name: "agent.tool_call", p_props: summary });
  }
}

export async function proposeConfirmation(def: AnyTool, input: unknown, ctx: ToolContext): Promise<ConfirmCard> {
  const c = def.confirmation!;
  const { title, lines } = c.summarise(input, ctx);
  const { data, error } = await ctx.client
    .rpc("create_confirmation", {
      p_conversation_id: ctx.conversationId,
      p_task_id: ctx.taskId,
      p_user_id: ctx.userId,
      p_kind: c.kind,
      p_summary_text: [title, ...lines].join("\n"),
      p_action_payload: { tool: def.name, input },
      p_consents: c.consents ?? [],
      p_ttl_s: CONFIRMATION_TTL_S,
    })
    .single<{ id: string; expires_at: string }>();
  if (error || !data) throw new Error(`create_confirmation failed: ${error?.message ?? "no row"}`);
  return {
    type: "confirm",
    id: crypto.randomUUID(),
    confirmationId: data.id,
    title,
    lines: lines.slice(0, 6),
    consents: c.consents ?? [],
    actions: [
      { id: "confirm", label: "Yes, do it", kind: "primary", confirmationId: data.id },
      { id: "decline", label: "No", kind: "secondary", confirmationId: data.id },
    ],
    expiresAt: new Date(data.expires_at).toISOString(),
  };
}

export function buildToolSet(names: readonly string[], ctx: ToolContext): ToolSet {
  const set: ToolSet = {};
  for (const name of names) {
    const def = TOOLS_BY_NAME.get(name);
    if (!def) throw new Error(`unknown tool ${name}`);
    set[name] = tool({
      description: def.description,
      inputSchema: def.input,
      execute: async (raw: unknown) => {
        const t0 = performance.now();
        const parsed = def.input.safeParse(raw);
        if (!parsed.success) {
          await logToolCall(ctx, name, false, performance.now() - t0, raw);
          return {
            error: "invalid_input",
            issues: parsed.error.issues.map((i: { message: string }) => i.message).slice(0, 3),
          };
        }
        try {
          if (def.confirmation) {
            const card = await proposeConfirmation(def, parsed.data, ctx);
            ctx.cards.push(card);
            await logToolCall(ctx, name, true, performance.now() - t0, parsed.data);
            return {
              status: "awaiting_user_confirmation",
              note: "The app is showing a Confirm card. Tell the user to check it; don't say it's done.",
            };
          }
          const output = await def.handler(parsed.data, ctx);
          ctx.results.push({ tool: name, output });
          ctx.sources.add(output);
          await logToolCall(ctx, name, true, performance.now() - t0, parsed.data);
          return output;
        } catch {
          await logToolCall(ctx, name, false, performance.now() - t0, parsed.data);
          return { error: "tool_failed", message: "This didn't work. Say so plainly and offer to try again." };
        }
      },
    });
  }
  return set;
}

export type ExecutedConfirmation = { tool: string; output: unknown };

/**
 * Runs a claimed confirmation's stored call (§7.6 step 4): deterministic, no model. The caller has already
 * claimed it with claim_confirmation, so this runs at most once per confirmation.
 */
export async function executeConfirmation(
  confirmation: {
    id: string;
    task_id: string | null;
    summary_text: string;
    action_payload: { tool: string; input: unknown };
  },
  ctx: ToolContext,
): Promise<ExecutedConfirmation> {
  const def = TOOLS_BY_NAME.get(confirmation.action_payload.tool);
  if (!def?.confirmation) throw new Error(`confirmation names a tool that can't be confirmed`);
  const input = def.input.parse(confirmation.action_payload.input);
  const output = await def.handler(input, ctx);
  if (confirmation.task_id) {
    await ctx.client.from("task_events").insert({
      task_id: confirmation.task_id,
      type: "user_confirmed",
      visibility: "user",
      actor_type: "user",
      actor_id: ctx.userId,
      payload: { summary: confirmation.summary_text, confirmation_id: confirmation.id },
    });
  }
  ctx.results.push({ tool: def.name, output });
  ctx.sources.add(output);
  return { tool: def.name, output };
}
