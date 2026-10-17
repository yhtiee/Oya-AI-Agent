import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  APICallError,
  generateText,
  Output,
  stepCountIs,
  streamText,
  type LanguageModel,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from "ai";
import type { z } from "zod";
import { getEnv } from "../../env";
import { breakerState, recordOutcome, shouldProbe } from "./breaker";
import { costMicros, purposeConfig, type ModelRef, type Purpose } from "./config";
import { isProviderConfigured, providerOptions, ProviderNotConfiguredError, resolveModel } from "./models";

/*
 * The only way Oya calls a language model (SPEC §10.1, §10.1a, R11).
 *
 * Failure order per call: breaker open → straight to the fallback (if this purpose allows one) or fail fast;
 * otherwise the primary, with one jittered retry on a fast 429/5xx; on a timeout or second failure, the
 * fallback; then LlmUnavailableError, which callers turn into the safe fixed text / button mode.
 * A content-filtered reply counts as a failure, never as an answer. Every attempt is logged to
 * internal.llm_calls with tokens and cost, never content, and reported to the breaker.
 */

export type LlmMeta = {
  client: SupabaseClient;
  userId?: string | null;
  taskId?: string | null;
  /** Epoch ms by which the whole turn must finish (§7.2: router 8 s, turn 30 s). */
  deadline?: number;
  /**
   * Logging and breaker writes run off the critical path and are collected here; the caller awaits them before the
   * request ends (R11: every call is logged). Without it, they are awaited inline.
   */
  background?: Promise<unknown>[];
};

/** Runs bookkeeping in the background when the caller collects it, inline otherwise. Never throws. */
async function bookkeep(meta: LlmMeta, work: Promise<unknown>): Promise<void> {
  const safe = work.catch(() => undefined);
  if (meta.background) meta.background.push(safe);
  else await safe;
}

export type LlmFailure =
  "disabled" | "not_configured" | "breaker_open" | "failed" | "content_filtered" | "deadline" | "rate_limited";

export class LlmUnavailableError extends Error {
  override name = "LlmUnavailableError";
  constructor(
    readonly reason: LlmFailure,
    message: string,
  ) {
    super(message);
  }
}

type CallStatus = "ok" | "error" | "timeout" | "content_filtered";

type AttemptResult<T> = { value: T; usage: LanguageModelUsage | undefined; finishReason?: string };

type Candidate = { ref: ModelRef; fallbackFrom: ModelRef | null; probe: boolean };

const MIN_ATTEMPT_MS = 1_000;

function classify(e: unknown): { status: CallStatus; retryable: boolean } {
  if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
    return { status: "timeout", retryable: false };
  }
  if (APICallError.isInstance(e)) {
    const code = e.statusCode ?? 0;
    // Groq returns 400 json_validate_failed when a structured reply doesn't parse; a second try usually works.
    const badJson = code === 400 && String(e.responseBody ?? "").includes("json_validate_failed");
    return { status: "error", retryable: code === 429 || code >= 500 || badJson };
  }
  return { status: "error", retryable: false };
}

async function logCall(
  meta: LlmMeta,
  purpose: Purpose,
  ref: ModelRef,
  fallbackFrom: ModelRef | null,
  status: CallStatus,
  usage: LanguageModelUsage | undefined,
  latencyMs: number,
) {
  const tokens = {
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.inputTokenDetails?.cacheWriteTokens ?? 0,
  };
  const cost = costMicros(ref, tokens);
  await meta.client.rpc("log_llm_call", {
    p_call: {
      provider: ref.provider,
      model: ref.model,
      purpose,
      status,
      fallback_from: fallbackFrom ? fallbackFrom.model : null,
      input_tokens: tokens.inputTokens,
      cache_read_tokens: tokens.cacheReadTokens,
      cache_write_tokens: tokens.cacheWriteTokens,
      output_tokens: tokens.outputTokens,
      cost_micros: cost.billed,
      latency_ms: Math.round(latencyMs),
      task_id: meta.taskId ?? null,
      user_id: meta.userId ?? null,
    },
  });
}

async function candidates(purpose: Purpose, meta: LlmMeta): Promise<Candidate[]> {
  const cfg = purposeConfig(purpose, getEnv());
  if (!cfg.enabled) throw new LlmUnavailableError("disabled", `${purpose} is disabled until its evals pass`);

  const fallback: Candidate[] =
    cfg.fallbackEnabled && cfg.fallback && isProviderConfigured(cfg.fallback.provider)
      ? [{ ref: cfg.fallback, fallbackFrom: cfg.primary, probe: false }]
      : [];
  if (!isProviderConfigured(cfg.primary.provider)) {
    if (fallback.length) return fallback;
    throw new LlmUnavailableError("not_configured", `no API key for ${cfg.primary.provider}`);
  }

  const primary: Candidate = { ref: cfg.primary, fallbackFrom: null, probe: false };
  const state = await breakerState(meta.client, cfg.primary.provider);
  if (state === "open") {
    if (fallback.length) return fallback;
    throw new LlmUnavailableError("breaker_open", `${cfg.primary.provider} is failing; try again shortly`);
  }
  if (state === "half_open") {
    // 1 in 10 calls probes the primary; the rest stay on the fallback while it has one.
    if (!fallback.length || shouldProbe()) return [{ ...primary, probe: true }, ...fallback];
    return fallback;
  }
  return [primary, ...fallback];
}

/**
 * Runs `run` against each candidate model until one succeeds. `started()` tells the runner that output has
 * already reached the user (streaming), after which it must not fall back and repeat it.
 */
async function withFailover<T>(
  purpose: Purpose,
  meta: LlmMeta,
  run: (model: LanguageModel, ref: ModelRef, signal: AbortSignal) => Promise<AttemptResult<T>>,
  started: () => boolean = () => false,
): Promise<T> {
  const cfg = purposeConfig(purpose, getEnv());
  const list = await candidates(purpose, meta);
  let lastError: unknown;

  for (const c of list) {
    const tries = c.fallbackFrom || c.probe ? 1 : 2;
    for (let attempt = 1; attempt <= tries; attempt++) {
      const left = (meta.deadline ?? Infinity) - Date.now();
      if (left < MIN_ATTEMPT_MS) throw new LlmUnavailableError("deadline", "no time left in this turn");
      const signal = AbortSignal.timeout(Math.min(cfg.timeoutMs, left));
      const t0 = performance.now();
      let model: LanguageModel;
      try {
        model = resolveModel(c.ref);
      } catch (e) {
        if (e instanceof ProviderNotConfiguredError) break;
        throw e;
      }
      try {
        const r = await run(model, c.ref, signal);
        if (r.finishReason === "content-filter") {
          await bookkeep(
            meta,
            logCall(meta, purpose, c.ref, c.fallbackFrom, "content_filtered", r.usage, performance.now() - t0),
          );
          await bookkeep(meta, recordOutcome(meta.client, c.ref.provider, false, c.probe));
          lastError = new LlmUnavailableError("content_filtered", "the model filtered its reply");
          break;
        }
        await bookkeep(meta, logCall(meta, purpose, c.ref, c.fallbackFrom, "ok", r.usage, performance.now() - t0));
        await bookkeep(meta, recordOutcome(meta.client, c.ref.provider, true, c.probe));
        return r.value;
      } catch (e) {
        const { status, retryable } = classify(e);
        const limited = APICallError.isInstance(e) && e.statusCode === 429;
        await bookkeep(meta, logCall(meta, purpose, c.ref, c.fallbackFrom, status, undefined, performance.now() - t0));
        // A 429 is the provider's quota (free tiers: tokens per minute), not an outage: don't trip the breaker.
        if (!limited) await bookkeep(meta, recordOutcome(meta.client, c.ref.provider, false, c.probe));
        lastError = limited ? new LlmUnavailableError("rate_limited", "the model provider is busy") : e;
        if (started()) throw new LlmUnavailableError("failed", "the model failed mid-reply");
        if (!(retryable && attempt < tries)) break;
        // Wait as long as the provider asks, if that still fits the turn; otherwise give up on this model.
        const after = limited ? Number(e.responseHeaders?.["retry-after"] ?? 0) * 1000 : 0;
        const wait = Math.max(after, 250 + Math.random() * 500);
        if (Date.now() + wait + MIN_ATTEMPT_MS > (meta.deadline ?? Infinity)) break;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  if (lastError instanceof LlmUnavailableError) throw lastError;
  throw new LlmUnavailableError("failed", lastError instanceof Error ? lastError.message : "model call failed");
}

/** Structured output (router, safety classifier, extraction). The schema must be in the Gemini-safe subset. */
export async function generateStructured<S extends z.ZodType>(
  input: {
    purpose: Purpose;
    schema: S;
    system: string;
    messages: ModelMessage[];
    maxOutputTokens?: number;
  },
  meta: LlmMeta,
): Promise<z.infer<S>> {
  return withFailover(input.purpose, meta, async (model, ref, signal) => {
    const r = await generateText({
      model,
      system: input.system,
      messages: input.messages,
      output: Output.object({ schema: input.schema }),
      maxRetries: 0,
      // Reasoning models (gpt-oss) spend part of this on thinking before the JSON; too low a cap truncates the JSON.
      maxOutputTokens: input.maxOutputTokens ?? 1500,
      temperature: 0,
      abortSignal: signal,
      providerOptions: providerOptions(ref, { structured: true }),
    });
    return { value: r.output as z.infer<S>, usage: r.usage, finishReason: r.finishReason };
  });
}

export type ToolLoopResult = {
  text: string;
  toolCalls: { toolName: string; input: unknown }[];
  toolResults: { toolName: string; output: unknown }[];
};

/**
 * A skill turn: the model may call tools (at most `maxToolCalls`, §7.2 step 7) and writes text, streamed to
 * `onTextDelta`. Tools execute on the server inside the registry; side-effect tools only create confirmations.
 */
export async function runToolLoop(
  input: {
    purpose: Purpose;
    system: string;
    messages: ModelMessage[];
    tools: ToolSet;
    maxToolCalls?: number;
    onTextDelta?: (delta: string) => void;
  },
  meta: LlmMeta,
): Promise<ToolLoopResult> {
  let emitted = false;
  return withFailover(
    input.purpose,
    meta,
    async (model, ref, signal) => {
      const r = streamText({
        model,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        stopWhen: stepCountIs((input.maxToolCalls ?? 6) + 1),
        maxRetries: 0,
        maxOutputTokens: 1500,
        temperature: 0.3,
        abortSignal: signal,
        providerOptions: providerOptions(ref),
      });
      let text = "";
      for await (const delta of r.textStream) {
        text += delta;
        emitted = true;
        input.onTextDelta?.(delta);
      }
      const steps = await r.steps;
      return {
        value: {
          text,
          toolCalls: steps.flatMap((s) => s.toolCalls.map((t) => ({ toolName: t.toolName, input: t.input }))),
          toolResults: steps.flatMap((s) => s.toolResults.map((t) => ({ toolName: t.toolName, output: t.output }))),
        },
        usage: await r.totalUsage,
        finishReason: await r.finishReason,
      };
    },
    () => emitted,
  );
}
