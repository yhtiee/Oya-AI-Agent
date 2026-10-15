import { MockLanguageModelV4 } from "ai/test";
import type { RouterOutput } from "@/server/agent/router-schema";

/*
 * Scripted models for pipeline tests. The router model answers structured calls with a fixed label; the skill
 * model replays steps: each step streams text and/or tool calls. No network, no cost.
 */

const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 20, text: 20, reasoning: 0 },
};

export function routerModel(label: () => Partial<RouterOutput>) {
  return new MockLanguageModelV4({
    modelId: "mock-router",
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            language: "en",
            safety: "ok",
            safetyConfidence: 0.99,
            scope: "in_scope",
            skill: "paperwork",
            targetTaskId: null,
            pendingConfirmationReply: "none",
            intent: "new_request",
            slotsJson: "{}",
            confidence: 0.9,
            ...label(),
          }),
        },
      ],
      finishReason: { unified: "stop", raw: "stop" },
      usage,
      warnings: [],
    }),
  });
}

export type SkillStep = { text?: string; toolCalls?: { name: string; input: unknown }[] };

function stream(step: SkillStep) {
  const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
  if (step.text) {
    parts.push({ type: "text-start", id: "t" });
    for (const word of step.text.split(/(?<= )/)) parts.push({ type: "text-delta", id: "t", delta: word });
    parts.push({ type: "text-end", id: "t" });
  }
  for (const [i, c] of (step.toolCalls ?? []).entries()) {
    parts.push({
      type: "tool-call",
      toolCallId: `call-${i}-${Math.random()}`,
      toolName: c.name,
      input: JSON.stringify(c.input),
    });
  }
  parts.push({
    type: "finish",
    usage,
    finishReason: step.toolCalls?.length
      ? { unified: "tool-calls", raw: "tool_calls" }
      : { unified: "stop", raw: "stop" },
  });
  return {
    stream: new ReadableStream({
      start(controller) {
        for (const p of parts) controller.enqueue(p);
        controller.close();
      },
    }),
  };
}

/** Each doStream call takes the next step; once steps run out it answers with plain text. */
export function skillModel(steps: () => SkillStep[]) {
  let i = 0;
  return new MockLanguageModelV4({
    modelId: "mock-skill",
    doStream: async () => {
      const s = steps();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return stream(s[i++] ?? { text: "Okay." }) as any;
    },
  });
}
