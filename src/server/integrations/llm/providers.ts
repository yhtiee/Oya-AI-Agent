import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { generateText, LanguageModel } from "ai";
import type { ModelRef } from "./config";

/* Model construction and per-provider options. Pure (no env, no server-only), so the eval runner shares it. */

export function createModel(ref: ModelRef, apiKey: string): LanguageModel {
  switch (ref.provider) {
    case "groq":
      return createGroq({ apiKey })(ref.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey })(ref.model);
    case "anthropic":
      return createAnthropic({ apiKey })(ref.model);
  }
}

export type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

const GEMINI_SAFETY_OFF = (
  [
    "HARM_CATEGORY_HATE_SPEECH",
    "HARM_CATEGORY_DANGEROUS_CONTENT",
    "HARM_CATEGORY_HARASSMENT",
    "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    "HARM_CATEGORY_CIVIC_INTEGRITY",
  ] as const
).map((category) => ({ category, threshold: "OFF" as const }));

/**
 * Per-provider settings:
 *  - Groq gpt-oss models reason by default; keep effort low for latency. Strict JSON schema for structured output.
 *  - Gemini: thinking minimal (3-series) or budget 0 (2.5), and safety filters off so a self-harm or emergency
 *    message is never silently swallowed (§10.1a). A filtered reply is still treated as a failure.
 */
export function providerOptions(ref: ModelRef, opts: { structured?: boolean } = {}): ProviderOptions {
  switch (ref.provider) {
    case "groq":
      return {
        groq: {
          ...(ref.model.startsWith("openai/gpt-oss") ? { reasoningEffort: "low" as const } : {}),
          ...(opts.structured ? { structuredOutputs: true, strictJsonSchema: true } : {}),
        },
      };
    case "google":
      return {
        google: {
          thinkingConfig: ref.model.startsWith("gemini-2.5")
            ? { thinkingBudget: 0 }
            : { thinkingLevel: "minimal" as const },
          safetySettings: GEMINI_SAFETY_OFF,
        },
      };
    case "anthropic":
      return {};
  }
}
