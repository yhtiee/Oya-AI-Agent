import { describe, expect, it } from "vitest";
import { checkGrounding, extractFacts, GroundingSources, SentenceBuffer } from "./grounding";

const keys = (text: string) => extractFacts(text).map((f) => `${f.kind}:${f.key}`);

describe("extractFacts", () => {
  it("normalises naira amounts", () => {
    expect(keys("₦3,000")).toEqual(["amount:3000"]);
    expect(keys("N3000")).toEqual(["amount:3000"]);
    expect(keys("NGN 3,000")).toEqual(["amount:3000"]);
    expect(keys("call-out na 3k")).toEqual(["amount:3000"]);
    expect(keys("3000 naira")).toEqual(["amount:3000"]);
    expect(keys("₦1.5m")).toEqual(["amount:1500000"]);
  });

  it("normalises times", () => {
    expect(keys("9am")).toEqual(["time:09:00"]);
    expect(keys("9:00am")).toEqual(["time:09:00"]);
    expect(keys("at 21:30")).toEqual(["time:21:30"]);
    expect(keys("12pm")).toEqual(["time:12:00"]);
    expect(keys("12am")).toEqual(["time:00:00"]);
  });

  it("normalises dates", () => {
    expect(keys("15th March")).toEqual(["date:03-15"]);
    expect(keys("March 15, 2026")).toEqual(["date:03-15"]);
    expect(keys("15/03/2026")).toEqual(["date:03-15"]);
    expect(keys("2026-03-15")).toEqual(["date:03-15"]);
  });

  it("finds percentages and phone numbers", () => {
    expect(keys("about 70%")).toEqual(["percent:70"]);
    expect(keys("call 0803 123 4567")).toEqual(["phone:08031234567"]);
    expect(keys("+234 803 123 4567")).toEqual(["phone:08031234567"]);
  });

  it("ignores plain counts and words", () => {
    expect(keys("I asked 3 plumbers near Ewet Housing")).toEqual([]);
    expect(keys("Light is on.")).toEqual([]);
  });
});

describe("checkGrounding", () => {
  const sources = () =>
    new GroundingSources()
      .add({ fees: [{ label: "Passport 32 pages", amount_kobo: 3500000 }], percent: 82 })
      .add({ scheduledFor: "2026-10-16T09:00:00+01:00" })
      .add("User: my budget is 5k");

  it("passes facts that come from tools or the user", () => {
    expect(checkGrounding("The official fee is ₦35,000.", sources())).toEqual({ ok: true });
    expect(checkGrounding("Musa can come at 9:00am on 16 October.", sources())).toEqual({ ok: true });
    expect(checkGrounding("That fits your ₦5,000 budget, about 82% sure.", sources())).toEqual({ ok: true });
  });

  it("flags invented facts", () => {
    const r = checkGrounding("It costs ₦40,000 and they open at 8am.", sources());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violations.map((v) => v.key)).toEqual(["40000", "08:00"]);
  });

  it("never allows phone numbers in model text, even if a tool returned one", () => {
    const s = new GroundingSources().add({ phone: "08031234567" });
    expect(checkGrounding("Call 08031234567.", s).ok).toBe(false);
  });

  it("passes text with no facts", () => {
    expect(checkGrounding("I've put the options below.", new GroundingSources())).toEqual({ ok: true });
  });
});

describe("SentenceBuffer", () => {
  it("releases complete sentences only", () => {
    const b = new SentenceBuffer();
    expect(b.push("Light is on in Ewet. Reported")).toEqual(["Light is on in Ewet. "]);
    expect(b.push(" by 4 neighbours! Want")).toEqual(["Reported by 4 neighbours! "]);
    expect(b.push(" an alert?")).toEqual([]);
    expect(b.flush()).toBe("Want an alert?");
    expect(b.flush()).toBeNull();
  });

  it("doesn't split numbers or abbreviations", () => {
    const b = new SentenceBuffer();
    expect(b.push("It's ₦3,000.50 at 9.30 e.g. on Monday. Next")).toEqual(["It's ₦3,000.50 at 9.30 e.g. on Monday. "]);
  });

  it("splits on newlines", () => {
    const b = new SentenceBuffer();
    expect(b.push("First line\nSecond")).toEqual(["First line\n"]);
  });
});
