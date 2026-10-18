import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Purposes are disabled until their evals pass; the scripted mock models stand in here.
process.env.LLM_ALLOW_UNEVALUATED = "true";
process.env.FLAGS_FORCE_ON = "skill_paperwork";

import { confirmAndExecute, declineConfirmation } from "@/server/agent/confirmations";
import { runWebTurn, type TurnEvent } from "@/server/agent/pipeline";
import type { RouterOutput } from "@/server/agent/router-schema";
import { setModelResolver } from "@/server/integrations/llm/models";
import { asUser, createTestUser, deleteTestUser, requireIntegrationEnv, service, token } from "./helpers";
import { routerModel, skillModel, type SkillStep } from "./mock-llm";

/*
 * Confirmation-integrity suite (SPEC §7.6, §7.12: >= 20 cases, 0 duplicate side effects, 0 IDOR successes).
 * Real pipeline and database, scripted models. The side effect under test is record_preference, which writes
 * profiles.prefs only after a confirmed yes.
 */

requireIntegrationEnv();

let alice: { id: string };
let bob: { id: string };
let label: Partial<RouterOutput> = {};
let steps: SkillStep[] = [];
let restore: () => void;

beforeAll(async () => {
  alice = await createTestUser("conf-alice");
  bob = await createTestUser("conf-bob");
  restore = setModelResolver((ref) => (ref.model.includes("20b") ? routerModel(() => label) : skillModel(() => steps)));
});

afterAll(async () => {
  restore?.();
  await deleteTestUser(alice?.id);
  await deleteTestUser(bob?.id);
});

async function turn(userId: string, text: string, opts: { conversationId?: string; clientMessageId?: string } = {}) {
  const events: TurnEvent[] = [];
  await runWebTurn({
    client: service,
    userId,
    conversationId: opts.conversationId ?? null,
    text,
    clientMessageId: opts.clientMessageId ?? randomUUID(),
    emit: (e) => events.push(e),
  });
  const meta = events.find((e) => e.type === "meta") as Extract<TurnEvent, { type: "meta" }> | undefined;
  return {
    events,
    conversationId: meta?.conversationId,
    text: events
      .filter((e) => e.type === "text")
      .map((e) => (e as { text: string }).text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    cards: events.filter((e) => e.type === "card").map((e) => (e as Extract<TurnEvent, { type: "card" }>).card),
  };
}

async function newConversation(userId: string) {
  const { data } = await service
    .from("conversations")
    .insert({ user_id: userId, channel: "web" })
    .select("id")
    .single();
  return data!.id as string;
}

async function prefs(userId: string) {
  const { data } = await service.from("profiles").select("prefs").eq("id", userId).single();
  return (data?.prefs ?? {}) as Record<string, unknown>;
}

async function resetPrefs(userId: string) {
  await service.from("profiles").update({ prefs: {} }).eq("id", userId);
}

/** Has the model propose remembering `value`; returns the pending confirmation id. */
async function propose(userId: string, conversationId: string, value: string) {
  label = { skill: "paperwork", pendingConfirmationReply: "none" };
  steps = [
    { toolCalls: [{ name: "record_preference", input: { key: "notification_channel", value } }] },
    { text: "I'll ask you to confirm below." },
  ];
  const r = await turn(userId, `Always use ${value} for my notifications`, { conversationId });
  const card = r.cards.find((c) => c.type === "confirm");
  if (!card || card.type !== "confirm") throw new Error(`no confirm card: ${JSON.stringify(r.events)}`);
  return card.confirmationId;
}

describe("confirmation integrity", () => {
  it("01 a proposal creates one pending confirmation and changes nothing yet", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    const id = await propose(alice.id, conv, "push");
    const { data } = await service.from("confirmations").select("status, kind, action_payload").eq("id", id).single();
    expect(data).toMatchObject({ status: "pending", kind: "preference" });
    expect(data?.action_payload).toEqual({
      tool: "record_preference",
      input: { key: "notification_channel", value: "push" },
    });
    expect(await prefs(alice.id)).toEqual({});
  });

  it("02 'yes' in chat executes the stored call once, with no model call for the side effect", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    await propose(alice.id, conv, "sms");
    steps = [{ toolCalls: [{ name: "record_preference", input: { key: "notification_channel", value: "WRONG" } }] }];
    const r = await turn(alice.id, "yes", { conversationId: conv });
    expect(r.text).toMatch(/Done/);
    expect(await prefs(alice.id)).toEqual({ notification_channel: "sms" });
  });

  it("03 three simultaneous taps run it exactly once", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "email");
    const taps = await Promise.all(
      [1, 2, 3].map(() => confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" })),
    );
    expect(taps.filter((t) => t.ok)).toHaveLength(1);
    expect(await prefs(alice.id)).toEqual({ notification_channel: "email" });
  });

  it("04 another user's confirmation id does nothing (IDOR)", async () => {
    await resetPrefs(alice.id);
    await resetPrefs(bob.id);
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    const r = await confirmAndExecute({ client: service, userId: bob.id, confirmationId: id, language: "en" });
    expect(r.ok).toBe(false);
    expect(await prefs(alice.id)).toEqual({});
    expect(await prefs(bob.id)).toEqual({});
    const { data } = await service.from("confirmations").select("status").eq("id", id).single();
    expect(data?.status).toBe("pending");
  });

  it("05 another user can't decline it either", async () => {
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    expect(
      (await declineConfirmation({ client: service, userId: bob.id, confirmationId: id, language: "en" })).ok,
    ).toBe(false);
    const { data } = await service.from("confirmations").select("status").eq("id", id).single();
    expect(data?.status).toBe("pending");
  });

  it("06 an expired confirmation can't be confirmed", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    await service
      .from("confirmations")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", id);
    const r = await confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" });
    expect(r).toMatchObject({ ok: false });
    expect(r.text).toMatch(/expired/);
    expect(await prefs(alice.id)).toEqual({});
  });

  it("07 a newer proposal supersedes the older one; only the newer can run", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    const first = await propose(alice.id, conv, "push");
    const second = await propose(alice.id, conv, "sms");
    expect(
      (await confirmAndExecute({ client: service, userId: alice.id, confirmationId: first, language: "en" })).ok,
    ).toBe(false);
    expect(
      (await confirmAndExecute({ client: service, userId: alice.id, confirmationId: second, language: "en" })).ok,
    ).toBe(true);
    expect(await prefs(alice.id)).toEqual({ notification_channel: "sms" });
  });

  it("08 declined, then confirmed: nothing runs", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    expect(
      (await declineConfirmation({ client: service, userId: alice.id, confirmationId: id, language: "en" })).ok,
    ).toBe(true);
    expect(
      (await confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" })).ok,
    ).toBe(false);
    expect(await prefs(alice.id)).toEqual({});
  });

  it("09 confirmed, then declined: the decline is refused and the result stands", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "email");
    await confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" });
    expect(
      (await declineConfirmation({ client: service, userId: alice.id, confirmationId: id, language: "en" })).ok,
    ).toBe(false);
    expect(await prefs(alice.id)).toEqual({ notification_channel: "email" });
  });

  it("10 'no' in chat declines the pending confirmation", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    const id = await propose(alice.id, conv, "push");
    const r = await turn(alice.id, "no", { conversationId: conv });
    expect(r.text).toMatch(/won't/);
    const { data } = await service.from("confirmations").select("status").eq("id", id).single();
    expect(data?.status).toBe("declined");
    expect(await prefs(alice.id)).toEqual({});
  });

  it("11 'yes' with nothing pending does nothing", async () => {
    await resetPrefs(alice.id);
    label = { skill: null, pendingConfirmationReply: "yes", intent: "other" };
    const r = await turn(alice.id, "yes", { conversationId: await newConversation(alice.id) });
    expect(r.text).toMatch(/nothing waiting/i);
    expect(await prefs(alice.id)).toEqual({});
  });

  it("12 'yes' in a different conversation doesn't run this conversation's confirmation", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    label = { skill: null, pendingConfirmationReply: "yes" };
    await turn(alice.id, "yes", { conversationId: await newConversation(alice.id) });
    const { data } = await service.from("confirmations").select("status").eq("id", id).single();
    expect(data?.status).toBe("pending");
    expect(await prefs(alice.id)).toEqual({});
  });

  it("13 two 'yes' messages at once in one conversation run it once", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    await propose(alice.id, conv, "sms");
    const [a, b] = await Promise.all([
      turn(alice.id, "yes", { conversationId: conv }),
      turn(alice.id, "yes", { conversationId: conv }),
    ]);
    expect([a.text, b.text].filter((t) => /Done/.test(t))).toHaveLength(1);
    expect(await prefs(alice.id)).toEqual({ notification_channel: "sms" });
  });

  it("14 a retried POST with the same client message id runs the turn once", async () => {
    const conv = await newConversation(alice.id);
    const clientMessageId = randomUUID();
    label = { skill: null, intent: "greeting" };
    await Promise.all([
      turn(alice.id, "hello", { conversationId: conv, clientMessageId }),
      turn(alice.id, "hello", { conversationId: conv, clientMessageId }),
    ]);
    const { data } = await service.from("messages").select("id, role").eq("conversation_id", conv);
    expect(data?.filter((m) => m.role === "user")).toHaveLength(1);
    expect(data?.filter((m) => m.role === "assistant")).toHaveLength(1);
  });

  it("15 a tampered action_payload with invalid input is refused", async () => {
    await resetPrefs(alice.id);
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    await service
      .from("confirmations")
      .update({ action_payload: { tool: "record_preference", input: { key: "is_admin", value: "true" } } })
      .eq("id", id);
    await expect(
      confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" }),
    ).rejects.toThrow();
    expect(await prefs(alice.id)).toEqual({});
  });

  it("16 an action_payload naming a tool that can't be confirmed is refused", async () => {
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    await service
      .from("confirmations")
      .update({ action_payload: { tool: "get_user_context", input: {} } })
      .eq("id", id);
    await expect(
      confirmAndExecute({ client: service, userId: alice.id, confirmationId: id, language: "en" }),
    ).rejects.toThrow(/can't be confirmed/);
  });

  it("17 a proposal with invalid arguments creates no confirmation", async () => {
    const conv = await newConversation(alice.id);
    label = { skill: "paperwork" };
    steps = [
      { toolCalls: [{ name: "record_preference", input: { key: "password", value: "x" } }] },
      { text: "Sorry, I can't save that." },
    ];
    const r = await turn(alice.id, "remember my password", { conversationId: conv });
    expect(r.cards.filter((c) => c.type === "confirm")).toEqual([]);
    const { data } = await service.from("confirmations").select("id").eq("conversation_id", conv);
    expect(data).toEqual([]);
  });

  it("18 the database allows only one pending confirmation per conversation", async () => {
    const conv = await newConversation(alice.id);
    await propose(alice.id, conv, "push");
    const { error } = await service.from("confirmations").insert({
      conversation_id: conv,
      user_id: alice.id,
      kind: "preference",
      summary_text: "x",
      action_payload: {},
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });
    expect(error?.code).toBe("23505");
  });

  it("19 users can't claim or update confirmations through the Data API", async () => {
    const id = await propose(alice.id, await newConversation(alice.id), "push");
    const asBob = asUser(token({ sub: bob.id }));
    expect(
      (await asBob.rpc("claim_confirmation", { p_confirmation_id: id, p_user_id: alice.id })).error,
    ).not.toBeNull();
    const asAlice = asUser(token({ sub: alice.id }));
    const upd = await asAlice.from("confirmations").update({ status: "confirmed" }).eq("id", id).select("id");
    expect(upd.data ?? []).toEqual([]);
    expect((await asBob.from("confirmations").select("id").eq("id", id)).data).toEqual([]);
  });

  it("20 a confirmed task confirmation records a user_confirmed event with the summary shown", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    const { data: task } = await service
      .from("tasks")
      .insert({ user_id: alice.id, conversation_id: conv, skill_id: "paperwork", job_type: "know", title: "Prefs" })
      .select("id")
      .single();
    const { data: c } = await service
      .rpc("create_confirmation", {
        p_conversation_id: conv,
        p_task_id: task!.id,
        p_user_id: alice.id,
        p_kind: "preference",
        p_summary_text: "Remember this?\nnotification channel: push",
        p_action_payload: { tool: "record_preference", input: { key: "notification_channel", value: "push" } },
      })
      .single<{ id: string }>();
    await confirmAndExecute({ client: service, userId: alice.id, confirmationId: c!.id, language: "en" });
    const { data: ev } = await service
      .from("task_events")
      .select("type, visibility, payload")
      .eq("task_id", task!.id)
      .eq("type", "user_confirmed");
    expect(ev).toHaveLength(1);
    expect(ev![0]).toMatchObject({
      visibility: "user",
      payload: { summary: "Remember this?\nnotification channel: push" },
    });
  });

  it("21 the stored call is exactly the validated input, not what the model says later", async () => {
    await resetPrefs(alice.id);
    const conv = await newConversation(alice.id);
    await propose(alice.id, conv, "push");
    label = { skill: null, pendingConfirmationReply: "yes" };
    steps = [{ text: "I saved sms for you." }];
    await turn(alice.id, "oya do am", { conversationId: conv });
    expect(await prefs(alice.id)).toEqual({ notification_channel: "push" });
  });

  it("22 the Confirm card shows the exact summary stored", async () => {
    const conv = await newConversation(alice.id);
    label = { skill: "paperwork" };
    steps = [
      { toolCalls: [{ name: "record_preference", input: { key: "language", value: "pcm" } }] },
      { text: "Check below." },
    ];
    const r = await turn(alice.id, "talk to me in pidgin always", { conversationId: conv });
    const card = r.cards.find((c) => c.type === "confirm");
    const { data } = await service
      .from("confirmations")
      .select("summary_text")
      .eq("conversation_id", conv)
      .eq("status", "pending")
      .single();
    expect(card && card.type === "confirm" ? [card.title, ...card.lines].join("\n") : null).toBe(data?.summary_text);
  });
});
