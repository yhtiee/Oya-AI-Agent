import "server-only";
import type { LanguageModel } from "ai";
import { getEnv } from "../../env";
import type { ModelRef, ProviderName } from "./config";
import { createModel } from "./providers";

export { providerOptions } from "./providers";

/*
 * Model instances per provider, plus the provider options each needs (SPEC §10.1a "behaviour differences").
 * Tests and the eval runner swap the resolver for mock models with `setModelResolver`.
 */

export type ModelResolver = (ref: ModelRef) => LanguageModel;

const KEY: Record<ProviderName, "GROQ_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY" | "ANTHROPIC_API_KEY"> = {
  groq: "GROQ_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
};

export class ProviderNotConfiguredError extends Error {
  override name = "ProviderNotConfiguredError";
}

const defaultResolver: ModelResolver = (ref) => {
  const env = getEnv();
  const apiKey = env[KEY[ref.provider]];
  if (!apiKey) throw new ProviderNotConfiguredError(`${KEY[ref.provider]} is not set`);
  return createModel(ref, apiKey);
};

let resolver: ModelResolver = defaultResolver;

export function resolveModel(ref: ModelRef): LanguageModel {
  return resolver(ref);
}

/** For tests and evals. Returns a function that restores the previous resolver. */
export function setModelResolver(next: ModelResolver): () => void {
  const prev = resolver;
  resolver = next;
  return () => {
    resolver = prev;
  };
}

export function isProviderConfigured(provider: ProviderName): boolean {
  return resolver !== defaultResolver || Boolean(getEnv()[KEY[provider]]);
}
