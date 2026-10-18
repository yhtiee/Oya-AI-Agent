import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.LLM_ALLOW_UNEVALUATED = "true";
process.env.FLAGS_FORCE_ON = "skill_paperwork";

import { runWebTurn, type TurnEvent } from "@/server/agent/pipeline";
import type { RouterOutput } from "@/server/agent/router-schema";
import { setModelResolver } from "@/server/integrations/llm/models";
import { createTestUser, deleteTestUser, requireIntegrationEnv, service } from "./helpers";
import { routerModel, skillModel, type SkillStep } from "./mock-llm";

/* The web pipeline end to end against the real database, with scripted models (SPEC §7.2, §15.4, R14). */

requireIntegrationEnv();

let user: { id: string };
let label: Partial<RouterOutput> = {};
let steps: SkillStep[] = [];
let routerCalls = 0;
let restore: () => void;

beforeAll(async () => {
  user = await createTestUser("pipeline");
  restore = setModelResolver((ref) => {
    if (ref.model.includes("20b")) {
      routerCalls++;
      return routerModel(() => label);
    }
    return skillModel(() => steps);
  });
});

afterAll(async () => {
  restore?.();
  await deleteTestUser(user?.id);
});

async function turn(text: string) {
  const { data } = await service
    .from("conversations")
    .insert({ user_id: user.id, channel: "web" })
    .select("id")
    .single();
  const events: TurnEvent[] = [];
  await runWebTurn({
    client: service,
    userId: user.id,
    conversationId: data!.id,
    text,
    clientMessageId: randomUUID(),
    emit: (e) => events.push(e),
  });
  return {
    conversationId: data!.id as string,
    events,
    text: events
      .filter((e) => e.type === "text")
      .map((e) => (e as { text: string }).text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  };
}

describe("web pipeline", () => {
  it("shows the EmergencyCard before anything else on a keyword match, and logs a safety event", async () => {
    label = { safety: "emergency", safetyConfidence: 0.95, skill: "get_help" };
    const r = await turn("Accident for Oron Road! person dey bleed");
    expect(r.events[0]).toMatchObject({ type: "card", card: { type: "emergency", primary: { href: "tel:112" } } });
    expect(r.text).toMatch(/112/);
    const { data } = await service.from("safety_events").select("kind").eq("user_id", user.id).eq("kind", "emergency");
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("self-harm: supportive reply, text only in safety_events, a marker in messages, support mode on", async () => {
    const calls = routerCalls;
    const r = await turn("I want to kill myself");
    expect(routerCalls).toBe(calls); // the keyword flow needs no model
    expect(r.events.some((e) => e.type === "card" && e.card.type === "support")).toBe(true);
    const { data: msgs } = await service
      .from("messages")
      .select("role, text")
      .eq("conversation_id", r.conversationId)
      .eq("role", "user");
    expect(msgs).toEqual([{ role: "user", text: "[support shown]" }]);
    const { data: ev } = await service
      .from("safety_events")
      .select("text_excerpt")
      .eq("user_id", user.id)
      .eq("kind", "self_harm");
    expect(ev?.[0]?.text_excerpt).toBe("I want to kill myself");
    const { data: conv } = await service
      .from("conversations")
      .select("support_mode_until")
      .eq("id", r.conversationId)
      .single();
    expect(Date.parse(conv!.support_mode_until)).toBeGreaterThan(Date.now() + 23 * 3600_000);
    const { data: ops } = await service
      .from("ops_queue")
      .select("reason, priority, note, meta")
      .eq("meta->>conversation_id", r.conversationId);
    expect(ops).toEqual([
      { reason: "safety", priority: 1, note: null, meta: { conversation_id: r.conversationId, kind: "self_harm" } },
    ]);
  });

  it("router self_harm without keywords still starts the supportive flow", async () => {
    label = { safety: "self_harm", safetyConfidence: 0.8, skill: null };
    const r = await turn("everything don tire me, I no fit again");
    expect(r.events.some((e) => e.type === "card" && e.card.type === "support")).toBe(true);
  });

  it("redacts phone numbers and ID numbers before storage and warns about protected info", async () => {
    label = { skill: null, intent: "other" };
    const r = await turn("my NIN is 12345678901 and my number is 08031234567");
    expect(r.events.some((e) => e.type === "notice")).toBe(true);
    const { data } = await service
      .from("messages")
      .select("text")
      .eq("conversation_id", r.conversationId)
      .eq("role", "user")
      .single();
    expect(data?.text).toBe("my NIN is [ID number] and my number is [phone]");
  });

  it("off-scope and everyday needs get fixed replies; everyday needs are logged as demand", async () => {
    label = { scope: "off_scope", skill: null };
    expect((await turn("who won the world cup")).text).toMatch(/outside what I do/);
    label = { scope: "general_everyday", skill: null, intent: "new_request" };
    expect((await turn("find me a house to rent")).text).toMatch(/can't do that in your area yet/);
    const { data } = await service.from("demand_signals").select("raw_intent").eq("user_id", user.id);
    expect(data?.map((d) => d.raw_intent)).toContain("find me a house to rent");
  });

  it("prohibited requests get the fixed refusal", async () => {
    label = { safety: "prohibited", safetyConfidence: 0.95, scope: "off_scope", skill: null };
    expect((await turn("where can I buy a gun")).text).toMatch(/can't help with that/);
  });

  it("a skill turn streams grounded text and a guide-less answer escalates", async () => {
    label = { skill: "paperwork" };
    steps = [
      { toolCalls: [{ name: "search_kb_text", input: { query: "certificate of occupancy" } }] },
      { text: "Oya hasn't checked that process yet. I can ask a teammate." },
    ];
    const r = await turn("how do I get a C of O");
    expect(r.text).toBe("Oya hasn't checked that process yet. I can ask a teammate.");
  });

  it("an invented fee stops the stream and shows the fixed line instead", async () => {
    label = { skill: "paperwork" };
    steps = [
      { toolCalls: [{ name: "list_kb_documents", input: {} }] },
      { text: "Sure. The fee is ₦25,000 at the office." },
    ];
    const r = await turn("how much is passport");
    expect(r.text).toBe("Sure. Details are in the cards below.");
    expect(r.text).not.toMatch(/25,000/);
  });

  it("skills not built yet answer honestly", async () => {
    label = { skill: "artisans" };
    expect((await turn("plumber for tomorrow")).text).toMatch(/still learning/);
  });
});
