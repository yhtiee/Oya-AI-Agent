import { describe, expect, it } from "vitest";
import { checkRouting } from "../../../../scripts/check-llm-routing";
import { costMicros, purposeConfig, ROUTING } from "./config";
import { providerOptions } from "./providers";

describe("llm config", () => {
  it("prices billed models and logs free-tier ones at zero", () => {
    expect(
      costMicros(
        { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
        { inputTokens: 1_000_000, outputTokens: 0 },
      ),
    ).toEqual({
      billed: 1_000_000,
      list: 1_000_000,
      known: true,
    });
    const groq = costMicros(
      { provider: "groq", model: "openai/gpt-oss-20b" },
      { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    );
    expect(groq.billed).toBe(0);
    expect(groq.list).toBeGreaterThan(0);
    expect(costMicros({ provider: "groq", model: "unknown" }, { inputTokens: 5 })).toEqual({
      billed: 0,
      list: 0,
      known: false,
    });
  });

  it("charges cached input at the cache price", () => {
    const ref = { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" };
    const fresh = costMicros(ref, { inputTokens: 1_000_000 }).billed;
    const cached = costMicros(ref, { inputTokens: 1_000_000, cacheReadTokens: 1_000_000 }).billed;
    expect(cached).toBeLessThan(fresh / 5);
  });

  it("keeps purposes disabled unless evaluated, with a dev-only override", () => {
    expect(purposeConfig("router").enabled).toBe(ROUTING.purposes.router.enabled);
    expect(purposeConfig("router", { LLM_ALLOW_UNEVALUATED: true, APP_ENV: "development" }).enabled).toBe(true);
    expect(purposeConfig("router", { LLM_ALLOW_UNEVALUATED: true, APP_ENV: "production" }).enabled).toBe(
      ROUTING.purposes.router.enabled,
    );
  });

  it("applies env model overrides", () => {
    expect(purposeConfig("router", { LLM_ROUTER_MODEL: "openai/gpt-oss-120b" }).primary.model).toBe(
      "openai/gpt-oss-120b",
    );
  });

  it("turns Gemini safety filters off and keeps Groq reasoning low", () => {
    const g = providerOptions({ provider: "google", model: "gemini-3.5-flash" }) as {
      google: { safetySettings: { threshold: string }[] };
    };
    expect(g.google.safetySettings.every((s) => s.threshold === "OFF")).toBe(true);
    expect(providerOptions({ provider: "groq", model: "openai/gpt-oss-20b" }, { structured: true })).toEqual({
      groq: { reasoningEffort: "low", structuredOutputs: true, strictJsonSchema: true },
    });
  });

  it("the checked-in routing passes the CI rule", () => {
    expect(checkRouting()).toEqual([]);
  });
});
