import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.LLM_ALLOW_UNEVALUATED = "true";
process.env.FLAGS_FORCE_ON = "skill_power,watches,reminders,local_alerts";

import { runWebTurn, type TurnEvent } from "@/server/agent/pipeline";
import type { RouterOutput } from "@/server/agent/router-schema";
import { setModelResolver } from "@/server/integrations/llm/models";
import type { Card } from "@/types/cards";
import { createTestUser, deleteTestUser, requireIntegrationEnv, service } from "./helpers";
import { routerModel, skillModel, type SkillStep } from "./mock-llm";

/* M4 skills through the real web pipeline, with scripted models (SPEC §5.1, §5.6, §5.7). */

requireIntegrationEnv();

let u: { id: string };
let cluster: string;
let label: Partial<RouterOutput> = {};
let steps: SkillStep[] = [];
let restore: () => void;

beforeAll(async () => {
  u = await createTestUser("m4-chat");
  const { data } = await service.rpc("upsert_area", {
    p_name: `Chat cluster ${randomUUID().slice(0, 6)}`,
    p_kind: "power_cluster",
    p_parent_id: null,
    p_geojson: null,
    p_source: "integration-test",
    p_active: true,
  });
  cluster = data as string;
  restore = setModelResolver((ref) => (ref.model.includes("20b") ? routerModel(() => label) : skillModel(() => steps)));
});

afterAll(async () => {
  restore?.();
  await deleteTestUser(u?.id);
  if (cluster) await service.from("areas").delete().eq("id", cluster);
});

async function turn(text: string, conversationId?: string) {
  const events: TurnEvent[] = [];
  await runWebTurn({
    client: service,
    userId: u.id,
    conversationId,
    text,
    clientMessageId: randomUUID(),
    emit: (e) => events.push(e),
  });
  const meta = events.find((e) => e.type === "meta") as Extract<TurnEvent, { type: "meta" }> | undefined;
  return {
    conversationId: meta?.conversationId,
    text: events
      .filter((e) => e.type === "text")
      .map((e) => (e as { text: string }).text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
    cards: events.filter((e) => e.type === "card").map((e) => (e as { card: Card }).card),
  };
}

describe("M4 skills in chat", () => {
  it("power: with no area saved the user gets the picker; with one, the status card", async () => {
    label = { skill: "power", intent: "status" };
    steps = [{ toolCalls: [{ name: "get_power_status", input: {} }] }, { text: "Pick your area below." }];
    const before = await turn("Light don come?");
    expect(before.cards.map((c) => c.type)).toEqual(["cluster_picker"]);

    await service.from("profiles").update({ power_area_id: cluster }).eq("id", u.id);
    steps = [{ toolCalls: [{ name: "get_power_status", input: {} }] }, { text: "See the card below." }];
    const after = await turn("Light don come?");
    const card = after.cards.find((c) => c.type === "power_status");
    expect(card).toMatchObject({ type: "power_status", areaId: cluster, status: "unknown", fewReporters: true });
  });

  it("reminders: the Confirm card shows the parsed time; 'yes' saves it and shows the reminder card", async () => {
    label = { skill: "reminders", intent: "new_request" };
    steps = [
      { toolCalls: [{ name: "create_reminder", input: { title: "Pay rent", when_text: "every month on the 1st" } }] },
      { text: "Check the time below and confirm." },
    ];
    const proposed = await turn("Remind me to pay rent on the 1st of every month");
    const confirm = proposed.cards.find((c) => c.type === "confirm");
    expect(confirm && confirm.type === "confirm" ? confirm.lines : []).toContain("Pay rent");
    expect(confirm && confirm.type === "confirm" ? confirm.title : "").toMatch(/9:00am — set\?$/);

    const yes = await turn("yes", proposed.conversationId);
    expect(yes.text).toMatch(/Done/);
    const reminder = yes.cards.find((c) => c.type === "reminder");
    expect(reminder).toMatchObject({
      type: "reminder",
      title: "Pay rent",
      repeatText: expect.stringMatching(/month/i),
    });
    const { data } = await service.from("reminders").select("title, rrule, status").eq("user_id", u.id).single();
    expect(data).toMatchObject({
      title: "Pay rent",
      status: "scheduled",
      rrule: expect.stringContaining("BYMONTHDAY=1"),
    });
  });

  it("reminders: an unreadable time goes back to the model to ask, and nothing is proposed", async () => {
    label = { skill: "reminders" };
    steps = [
      { toolCalls: [{ name: "create_reminder", input: { title: "Call mama", when_text: "whenever" } }] },
      { text: "When should I remind you?" },
    ];
    const r = await turn("remind me to call mama sometime");
    expect(r.cards.filter((c) => c.type === "confirm")).toEqual([]);
    expect(r.text).toBe("When should I remind you?");
  });

  it("local alerts: the card says plainly when nothing is posted", async () => {
    label = { skill: "local_alerts" };
    steps = [
      { toolCalls: [{ name: "get_local_alerts", input: {} }] },
      { text: "No alerts posted for your area today." },
    ];
    const r = await turn("Any wahala for road today?");
    expect(r.cards).toMatchObject([{ type: "local_alerts", alerts: [] }]);
  });

  it("a skill whose flag is off answers 'coming soon' instead of running", async () => {
    label = { skill: "paperwork" }; // skill_paperwork is off in the shared project and not forced on here
    const r = await turn("How much is passport renewal?");
    expect(r.text).toMatch(/still learning/);
  });
});
