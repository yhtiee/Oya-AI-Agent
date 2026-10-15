import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEmergencyCard, buildSupportCard } from "@/lib/safety/emergency-card";
import { matchEmergency } from "@/lib/safety/emergency";
import { containsProtectedInfo, redact } from "@/lib/safety/redact";
import type { Card } from "@/types/cards";
import { getEnv } from "../env";
import { LlmUnavailableError, type LlmMeta } from "../integrations/llm";
import { buildCards } from "./cards";
import { confirmAndExecute, declineConfirmation } from "./confirmations";
import { loadTurnContext, type TurnContext } from "./context";
import { GroundingSources } from "./grounding";
import { classifySafety, quickRoute, routeMessage } from "./router";
import type { RouterOutput } from "./router-schema";
import { safetyGate, showsEmergencyCard } from "./safety-gate";
import { runSkill } from "./skill-runner";
import { SKILLS } from "./skills";
import { template, type Lang, type TemplateKey } from "./templates";
import type { ToolContext } from "./tools/types";

/*
 * The web user pipeline (SPEC §7.2 steps 0–12). Emits events as it goes so /api/chat can stream them:
 * emergency help first, then checked sentences, then cards, then `done`.
 */

export type TurnEvent =
  | { type: "meta"; conversationId: string; userMessageId: string }
  | { type: "text"; text: string }
  | { type: "card"; card: Card }
  | { type: "notice"; text: string }
  | { type: "done"; messageId: string | null };

export type TurnInput = {
  client: SupabaseClient;
  userId: string;
  conversationId?: string | null;
  text: string;
  /** Client-generated id, so a retried POST doesn't run the turn twice. */
  clientMessageId: string;
  emit: (e: TurnEvent) => void;
  now?: () => number;
};

const LEASE_TTL_S = 60;
const LEASE_WAIT_MS = 15_000;
const TURN_MS = 30_000;
const ROUTER_MS = 8_000;
const USER_DAILY_BUDGET_MICROS = 500_000; // $0.50 (§7.10)
const SUPPORT_MODE_HOURS = 24;

/** Continues the user's own conversation, or starts a new one (no id, or an id that isn't theirs). */
async function ensureConversation(client: SupabaseClient, userId: string, id?: string | null): Promise<string> {
  if (id) {
    const { data } = await client.from("conversations").select("id").eq("id", id).eq("user_id", userId).maybeSingle();
    if (data) return data.id;
  }
  const { data, error } = await client
    .from("conversations")
    .insert({ user_id: userId, channel: "web" })
    .select("id")
    .single();
  if (error) throw new Error(`create conversation failed: ${error.message}`);
  return data.id;
}

async function claimLease(client: SupabaseClient, conversationId: string, worker: string): Promise<boolean> {
  const until = Date.now() + LEASE_WAIT_MS;
  for (;;) {
    const { data } = await client.rpc("claim_conversation_lease", {
      p_conversation_id: conversationId,
      p_worker_id: worker,
      p_ttl_s: LEASE_TTL_S,
    });
    if (data === true) return true;
    if (Date.now() > until) return false;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Outcome of the budget check (§7.10, §20.1). Free-tier calls cost 0, so this rarely bites on Groq. */
async function budgetState(client: SupabaseClient, userId: string): Promise<"ok" | "safety_only" | "exhausted"> {
  const env = getEnv();
  const { data } = await client.rpc("llm_spend", { p_user_id: userId, p_task_id: null }).single<{
    app_today_micros: number;
    user_today_micros: number;
  }>();
  if (!data) return "ok";
  const app = Number(data.app_today_micros);
  const daily = (env.LLM_DAILY_BUDGET_USD ?? 0.3) * 1_000_000;
  if (app >= daily) return "exhausted";
  // 20% of the daily budget is reserved for safety classification (§20.1).
  if (app >= daily * 0.8 || Number(data.user_today_micros) >= USER_DAILY_BUDGET_MICROS) return "safety_only";
  return "ok";
}

export async function runWebTurn(input: TurnInput): Promise<void> {
  const { client, userId, emit } = input;
  const now = input.now ?? Date.now;
  const started = now();
  const worker = `web-${randomUUID().slice(0, 8)}`;

  // Abuse limits (§7.9): 60 messages an hour, 300 a day.
  const [hour, day] = await Promise.all([
    client.rpc("hit_rate_limit", { p_key: `chat:h:${userId}`, p_window_seconds: 3600, p_max: 60 }),
    client.rpc("hit_rate_limit", { p_key: `chat:d:${userId}`, p_window_seconds: 86_400, p_max: 300 }),
  ]);
  const conversationId = await ensureConversation(client, userId, input.conversationId);

  // Step 2a runs before anything slow: emergency help never waits on a lease, the database or a model.
  const prefilter = matchEmergency(input.text);
  if (prefilter?.kind === "emergency") emit({ type: "card", card: buildEmergencyCard({ facilitiesLoading: false }) });

  if (hour.data === false || day.data === false) {
    emit({ type: "text", text: template("rateLimited", "en") });
    emit({ type: "done", messageId: null });
    return;
  }

  // Step 0: one turn at a time per conversation.
  if (!(await claimLease(client, conversationId, worker))) {
    emit({ type: "text", text: template("busy", "en") });
    emit({ type: "done", messageId: null });
    return;
  }

  // Writes that don't affect this reply (logs, timestamps) run alongside it and are awaited before the lease ends.
  const background: Promise<unknown>[] = [];
  try {
    // Step 1: persist the (redacted) message. Self-harm text goes only to safety_events (§7.9).
    const { text: redacted, found } = redact(input.text);
    const selfHarm = prefilter?.kind === "self_harm";
    const { data: msg, error: msgError } = await client
      .from("messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        channel: "web",
        text: selfHarm ? "[support shown]" : redacted,
        status: "received",
        idempotency_key: `web:${userId}:${input.clientMessageId}`,
      })
      .select("id")
      .single();
    if (msgError?.code === "23505") {
      emit({ type: "done", messageId: null }); // a retried POST: the first one is handling it
      return;
    }
    if (msgError || !msg) throw new Error(`persist message failed: ${msgError?.message}`);
    emit({ type: "meta", conversationId, userMessageId: msg.id });
    background.push(
      Promise.resolve(
        client.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId),
      ),
    );

    const [ctx, budget] = await Promise.all([
      loadTurnContext(client, userId, conversationId, msg.id),
      budgetState(client, userId),
    ]);
    const lang: Lang = ctx.language;
    if (containsProtectedInfo(found)) emit({ type: "notice", text: template("protectedInfo", lang) });

    const out: { text: string[]; cards: Card[] } = { text: [], cards: [] };
    const say = (t: string) => {
      out.text.push(t);
      emit({ type: "text", text: t });
    };
    const show = (c: Card) => {
      out.cards.push(c);
      emit({ type: "card", card: c });
    };
    if (prefilter?.kind === "emergency") {
      out.cards.push(buildEmergencyCard()); // persisted copy of the card already shown
      background.push(Promise.resolve(client.from("safety_events").insert({ user_id: userId, kind: "emergency" })));
    }

    const finish = async () => {
      const { data: reply } = await client
        .from("messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          channel: "web",
          text: out.text.join(" ").replace(/\s+/g, " ").trim() || null,
          cards: out.cards,
          status: "sent",
        })
        .select("id")
        .single();
      emit({ type: "done", messageId: reply?.id ?? null });
    };
    const fixed = async (key: TemplateKey) => {
      say(template(key, lang));
      await finish();
    };

    if (selfHarm) {
      await supportiveFlow(client, userId, conversationId, redacted, lang, say, show);
      return finish();
    }
    if (ctx.supportMode) {
      say(template("supportModeLead", lang));
      show(buildSupportCard());
    }

    // Steps 4–5: route, then gate.
    const meta: LlmMeta = { client, userId, deadline: started + TURN_MS, background };
    let routed: RouterOutput | null = quickRoute(redacted, ctx);
    if (!routed) {
      if (budget !== "ok") {
        const safety = budget === "safety_only" ? await classifySafety(redacted, meta).catch(() => null) : null;
        const gate = safetyGate(prefilter, safety);
        if (gate.action === "self_harm") {
          await supportiveFlow(client, userId, conversationId, redacted, lang, say, show);
          return finish();
        }
        if (showsEmergencyCard(gate) && prefilter?.kind !== "emergency") show(buildEmergencyCard());
        return fixed("buttonMode");
      }
      try {
        routed = await routeMessage(redacted, ctx, {
          ...meta,
          deadline: Math.min(started + ROUTER_MS, started + TURN_MS),
        });
      } catch (e) {
        if (!(e instanceof LlmUnavailableError)) throw e;
        console.log(`router failed: ${e.reason} (${e.message})`);
        // The provider is down: keyword filters and static links still protect the user (§20.1).
        return fixed(failureTemplate(e.reason));
      }
    }

    const gate = safetyGate(prefilter, routed);
    if (showsEmergencyCard(gate) && prefilter?.kind !== "emergency") {
      show(buildEmergencyCard());
      await client.from("safety_events").insert({ user_id: userId, kind: "emergency" });
    }
    switch (gate.action) {
      case "emergency_stop":
        say(template("emergencyLead", lang));
        return finish();
      case "self_harm":
        await supportiveFlow(client, userId, conversationId, redacted, lang, say, show);
        return finish();
      case "prohibited":
        await client.from("safety_events").insert({ user_id: userId, kind: "prohibited" });
        return fixed("prohibited");
      case "medical_redirect":
        return fixed("medicalRedirect");
    }

    const replyLang: Lang = routed.language === "pcm" ? "pcm" : routed.language === "en" ? "en" : lang;
    if (!["en", "pcm", "other"].includes(routed.language)) say(template("otherLanguage", "en"));

    // Step 6: answers to a pending confirmation run the stored call, with no model.
    if (
      ctx.pendingConfirmation &&
      routed.pendingConfirmationReply !== "none" &&
      routed.pendingConfirmationReply !== "change"
    ) {
      const fn = routed.pendingConfirmationReply === "yes" ? confirmAndExecute : declineConfirmation;
      const r = await fn({ client, userId, confirmationId: ctx.pendingConfirmation.id, language: replyLang });
      say(r.text);
      return finish();
    }
    if (
      routed.pendingConfirmationReply === "none" &&
      /^(yes|ok|oya)\b/i.test(redacted.trim()) &&
      !ctx.pendingConfirmation
    ) {
      return fixed("nothingPending");
    }

    // Step 10: off-scope and everyday needs without a skill.
    if (routed.scope === "off_scope") return fixed("offScope");
    if (routed.scope === "general_everyday") {
      await client
        .from("demand_signals")
        .insert({ user_id: userId, raw_intent: redacted.slice(0, 500), inferred_category: routed.intent });
      return fixed("notYet");
    }
    if (!routed.skill) {
      if (routed.intent === "thanks") return fixed("thanks");
      return fixed("greeting");
    }
    const skill = SKILLS[routed.skill];
    if (!skill) {
      await client
        .from("demand_signals")
        .insert({ user_id: userId, raw_intent: redacted.slice(0, 500), inferred_category: routed.skill });
      return fixed("skillComingSoon");
    }

    // Steps 7–9: the skill, its tools, cards from tool results, grounded text.
    const tools: ToolContext = {
      client,
      userId,
      conversationId,
      taskId: routed.targetTaskId,
      language: replyLang,
      sources: new GroundingSources(),
      results: [],
      cards: [],
    };
    try {
      const turn = await runSkill({
        skill,
        ctx: { ...ctx, language: replyLang } satisfies TurnContext,
        tools,
        userText: redacted,
        emitText: say,
        meta: { ...meta, taskId: routed.targetTaskId },
      });
      for (const c of [...buildCards(skill.cardRules, tools.results), ...tools.cards]) show(c);
      if (!turn.text && !out.cards.length) say(template("failure", replyLang));
    } catch (e) {
      if (!(e instanceof LlmUnavailableError)) throw e;
      for (const c of tools.cards) show(c);
      console.log(`skill ${routed.skill} failed: ${e.reason} (${e.message})`);
      if (!out.text.length) say(template(failureTemplate(e.reason), replyLang));
    }
    return finish();
  } finally {
    await Promise.allSettled(background);
    await client.rpc("release_conversation_lease", { p_conversation_id: conversationId, p_worker_id: worker });
  }
}

/** Which fixed reply a model failure gets. Every one of them keeps 112 in view. */
function failureTemplate(reason: LlmUnavailableError["reason"]): TemplateKey {
  if (reason === "disabled" || reason === "not_configured") return "buttonMode";
  if (reason === "rate_limited") return "providerBusy";
  return "failure";
}

/** §15.4: stay with the person, show support lines, no other skills this turn; text only in safety_events. */
async function supportiveFlow(
  client: SupabaseClient,
  userId: string,
  conversationId: string,
  redactedText: string,
  lang: Lang,
  say: (t: string) => void,
  show: (c: Card) => void,
) {
  await Promise.all([
    client
      .from("safety_events")
      .insert({ user_id: userId, kind: "self_harm", text_excerpt: redactedText.slice(0, 2000) }),
    client
      .from("conversations")
      .update({ support_mode_until: new Date(Date.now() + SUPPORT_MODE_HOURS * 3_600_000).toISOString() })
      .eq("id", conversationId),
    client
      .from("ops_queue")
      .insert({ reason: "safety", priority: 1, meta: { conversation_id: conversationId, kind: "self_harm" } }),
  ]);
  say(template("selfHarm", lang));
  show(buildSupportCard());
}
