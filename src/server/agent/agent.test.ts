import { describe, expect, it } from "vitest";
import { matchEmergency } from "@/lib/safety/emergency";
import { buildEmergencyCard, buildSupportCard } from "@/lib/safety/emergency-card";
import { Card } from "@/types/cards";
import { buildCards, buildInfoCard } from "./cards";
import { quickRoute } from "./router";
import { parseSlots, RouterOutput } from "./router-schema";
import { safetyGate, showsEmergencyCard } from "./safety-gate";
import { template } from "./templates";

describe("safetyGate", () => {
  const routed = (safety: RouterOutput["safety"], safetyConfidence = 0.9) => ({ safety, safetyConfidence });

  it("stops on a confident emergency and shows the card alongside a reply when unsure", () => {
    expect(safetyGate(null, routed("emergency", 0.95))).toEqual({ action: "emergency_stop" });
    expect(safetyGate(null, routed("emergency", 0.5))).toEqual({ action: "emergency_and_continue" });
  });

  it("lets keywords add safety but never remove it", () => {
    expect(safetyGate(matchEmergency("accident for Oron Road"), routed("ok"))).toEqual({
      action: "emergency_and_continue",
    });
    expect(safetyGate(matchEmergency("I want to kill myself"), routed("ok"))).toEqual({ action: "self_harm" });
    expect(safetyGate(matchEmergency("I want to kill myself"), null)).toEqual({ action: "self_harm" });
    expect(safetyGate(matchEmergency("e no dey breathe"), null)).toEqual({ action: "emergency_and_continue" });
  });

  it("puts self-harm ahead of everything", () => {
    expect(safetyGate(matchEmergency("accident"), routed("self_harm", 0.4))).toEqual({ action: "self_harm" });
  });

  it("refuses prohibited requests and redirects medical advice", () => {
    expect(safetyGate(null, routed("prohibited"))).toEqual({ action: "prohibited" });
    expect(safetyGate(null, routed("medical_advice"))).toEqual({ action: "medical_redirect" });
    expect(safetyGate(null, routed("ok"))).toEqual({ action: "continue" });
    expect(showsEmergencyCard({ action: "continue" })).toBe(false);
  });
});

describe("quickRoute", () => {
  const pending = {
    pendingConfirmation: { id: "c", kind: "preference", summary: "x", expiresAt: "" },
    language: "pcm" as const,
  };

  it("answers a pending confirmation without the model", () => {
    expect(quickRoute("oya", pending)?.pendingConfirmationReply).toBe("yes");
    expect(quickRoute("Yes please!", pending)?.pendingConfirmationReply).toBe("yes");
    expect(quickRoute("leave am", pending)?.pendingConfirmationReply).toBe("no");
  });

  it("needs the router for anything else, or with nothing pending", () => {
    expect(quickRoute("yes but make it tomorrow", pending)).toBeNull();
    expect(quickRoute("yes", { pendingConfirmation: null, language: "en" })).toBeNull();
  });
});

describe("router schema", () => {
  it("parses slots leniently", () => {
    expect(parseSlots('{"trade":"plumber"}')).toEqual({ trade: "plumber" });
    expect(parseSlots("[1,2]")).toEqual({});
    expect(parseSlots("not json")).toEqual({});
    expect(parseSlots("")).toEqual({});
  });
});

describe("cards", () => {
  const doc = {
    found: true,
    document: {
      slug: "passport-renewal",
      title: "Passport renewal",
      one_liner: "Renew a Nigerian passport in Nigeria.",
      body_md: "",
      steps: ["Apply online", { text: "Pay on the official portal" }, 3],
      fees: [{ label: "32 pages", amount_kobo: 3500000 }, { label: "bad" }],
      official_urls: ["https://immigration.gov.ng/passport", "javascript:alert(1)", "http://insecure.example"],
      last_verified_at: "2026-09-01T10:00:00Z",
    },
  };

  it("builds an InfoCard from a guide, with only safe official links", () => {
    const card = buildInfoCard(doc, new Date("2026-10-15T00:00:00Z"))!;
    expect(Card.parse(card)).toBeTruthy();
    expect(card.steps).toEqual(["Apply online", "Pay on the official portal"]);
    expect(card.fees).toEqual([{ label: "32 pages", amountKobo: 3500000 }]);
    expect(card.officialLinks).toEqual([{ label: "immigration.gov.ng", url: "https://immigration.gov.ng/passport" }]);
    expect(card.staleWarning).toBe(false);
    expect(card.source.asOf).toBe("2026-09-01T10:00:00.000Z");
  });

  it("warns when a guide is older than 60 days and builds nothing for a missing guide", () => {
    expect(buildInfoCard(doc, new Date("2026-11-15T00:00:00Z"))!.staleWarning).toBe(true);
    expect(buildInfoCard({ found: false })).toBeNull();
  });

  it("builds cards only from tools the skill's rules name, once each", () => {
    const results = [
      { tool: "get_kb_document", output: doc },
      { tool: "get_kb_document", output: doc },
      { tool: "list_kb_documents", output: { documents: [] } },
    ];
    expect(buildCards([{ tool: "get_kb_document", card: "info" }], results)).toHaveLength(1);
    expect(buildCards([], results)).toEqual([]);
  });

  it("builds valid static emergency and support cards from verified numbers only", () => {
    const e = buildEmergencyCard();
    expect(Card.parse(e)).toBeTruthy();
    expect(e.primary).toEqual({ label: "Call 112 now", href: "tel:112" });
    expect(e.secondary.every((s) => s.href.startsWith("tel:"))).toBe(true);
    const s = buildSupportCard();
    expect(Card.parse(s)).toBeTruthy();
    expect(s.emergency.href).toBe("tel:112");
  });
});

describe("templates", () => {
  it("keeps 112 in every reply that can follow a failure", () => {
    for (const key of [
      "buttonMode",
      "failure",
      "providerBusy",
      "rateLimited",
      "medicalRedirect",
      "emergencyLead",
    ] as const) {
      expect(template(key, "en")).toMatch(/112/);
      expect(template(key, "pcm")).toMatch(/112/);
    }
  });
});
