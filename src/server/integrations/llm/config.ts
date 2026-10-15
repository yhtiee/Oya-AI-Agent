import { z } from "zod";
import pricesRaw from "../../../../config/llm-prices.json";
import routingRaw from "../../../../config/llm-routing.json";

/* Model routing and prices from config (SPEC §7.3, §10.1, §10.1a; D-019). Pure, so scripts and tests can use it. */

export const PROVIDERS = ["groq", "google", "anthropic"] as const;
export type ProviderName = (typeof PROVIDERS)[number];

const ModelRef = z.object({ provider: z.enum(PROVIDERS), model: z.string().min(1) });
export type ModelRef = z.infer<typeof ModelRef>;

export const PURPOSES = ["router", "safety_classifier", "simple_skill", "complex_skill", "eval_grader"] as const;
export type Purpose = (typeof PURPOSES)[number];

const PurposeConfig = z.object({
  primary: ModelRef,
  fallback: ModelRef.nullable(),
  enabled: z.boolean(),
  fallbackEnabled: z.boolean(),
  timeoutMs: z.number().int().positive(),
});
export type PurposeConfig = z.infer<typeof PurposeConfig>;

export const RoutingFile = z.object({
  version: z.number(),
  purposes: z.record(z.enum(PURPOSES), PurposeConfig),
});

const Price = z.object({
  input: z.number().nonnegative(),
  output: z.number().nonnegative(),
  cacheRead: z.number().nonnegative(),
  cacheWrite: z.number().nonnegative(),
  billed: z.boolean(),
});
const PricesFile = z.object({ version: z.number(), models: z.record(z.string(), Price) });

export const ROUTING = RoutingFile.parse(routingRaw);
const PRICES = PricesFile.parse(pricesRaw).models;

export const refKey = (ref: ModelRef) => `${ref.provider}:${ref.model}`;

type EnvLike = {
  APP_ENV?: string;
  LLM_ALLOW_UNEVALUATED?: boolean;
  LLM_ROUTER_MODEL?: string;
  LLM_SIMPLE_MODEL?: string;
  LLM_COMPLEX_MODEL?: string;
  LLM_FALLBACK_ROUTER_MODEL?: string;
  LLM_FALLBACK_SIMPLE_MODEL?: string;
  LLM_FALLBACK_COMPLEX_MODEL?: string;
};

const PRIMARY_OVERRIDE: Partial<Record<Purpose, keyof EnvLike>> = {
  router: "LLM_ROUTER_MODEL",
  safety_classifier: "LLM_ROUTER_MODEL",
  simple_skill: "LLM_SIMPLE_MODEL",
  complex_skill: "LLM_COMPLEX_MODEL",
};
const FALLBACK_OVERRIDE: Partial<Record<Purpose, keyof EnvLike>> = {
  router: "LLM_FALLBACK_ROUTER_MODEL",
  safety_classifier: "LLM_FALLBACK_ROUTER_MODEL",
  simple_skill: "LLM_FALLBACK_SIMPLE_MODEL",
  complex_skill: "LLM_FALLBACK_COMPLEX_MODEL",
};

/** The purpose's config with env overrides applied. `enabled` honours LLM_ALLOW_UNEVALUATED outside production. */
export function purposeConfig(purpose: Purpose, env: EnvLike = {}): PurposeConfig {
  const base = ROUTING.purposes[purpose];
  const p = PRIMARY_OVERRIDE[purpose];
  const f = FALLBACK_OVERRIDE[purpose];
  const primaryModel = p ? (env[p] as string | undefined) : undefined;
  const fallbackModel = f ? (env[f] as string | undefined) : undefined;
  const devOverride = env.LLM_ALLOW_UNEVALUATED === true && env.APP_ENV !== "production";
  return {
    ...base,
    primary: primaryModel ? { ...base.primary, model: primaryModel } : base.primary,
    fallback: base.fallback && fallbackModel ? { ...base.fallback, model: fallbackModel } : base.fallback,
    enabled: base.enabled || devOverride,
    fallbackEnabled: (base.fallbackEnabled || devOverride) && base.fallback !== null,
  };
}

export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
};

/** Billed cost in micro-dollars. Free-tier models cost 0; unknown models are priced at 0 and flagged by the cost job. */
export function costMicros(ref: ModelRef, usage: Usage): { billed: number; list: number; known: boolean } {
  const price = PRICES[refKey(ref)];
  if (!price) return { billed: 0, list: 0, known: false };
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheWrite = usage.cacheWriteTokens ?? 0;
  const fresh = Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite);
  const usd =
    (fresh * price.input +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite +
      (usage.outputTokens ?? 0) * price.output) /
    1_000_000;
  const list = Math.round(usd * 1_000_000);
  return { billed: price.billed ? list : 0, list, known: true };
}
