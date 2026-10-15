import type { ModelMessage } from "ai";
import type { TurnContext } from "./context";

/* The router's input message. Pure, so the eval runner sends exactly what production sends. */

export function routerMessages(text: string, ctx: TurnContext): ModelMessage[] {
  const context = [
    `Active tasks: ${ctx.activeTasks.length ? ctx.activeTasks.map((t) => `${t.id} (${t.skill}, ${t.status}): ${t.title}`).join("; ") : "none"}`,
    `Pending confirmation: ${ctx.pendingConfirmation ? `${ctx.pendingConfirmation.kind}: ${ctx.pendingConfirmation.summary.split("\n")[0]}` : "none"}`,
    `Recent messages:\n${ctx.recent.map((m) => `${m.role}: ${m.text}`).join("\n") || "(none)"}`,
  ].join("\n");
  return [{ role: "user", content: `${context}\n\nLatest message:\n${text}` }];
}
