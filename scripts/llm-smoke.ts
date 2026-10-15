/*
 * Checks the Groq key and the configured models answer, with one tiny structured call each.
 *   pnpm tsx scripts/llm-smoke.ts
 * Prints model ids, latency and token counts only.
 */
import { createGroq } from "@ai-sdk/groq";
import { generateText, Output } from "ai";
import { z } from "zod";

process.loadEnvFile?.(".env");
const key = process.env.GROQ_API_KEY;
if (!key) {
  console.error("GROQ_API_KEY is not set");
  process.exit(1);
}
const groq = createGroq({ apiKey: key });

async function main() {
  for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: groq(model),
        system: "Classify the message. Reply with JSON only.",
        prompt: "Light don come for Ewet?",
        output: Output.object({ schema: z.object({ language: z.enum(["en", "pcm"]), topic: z.string() }) }),
        providerOptions: { groq: { reasoningEffort: "low", structuredOutputs: true, strictJsonSchema: true } },
        maxRetries: 0,
      });
      console.log(
        `${model}: ok in ${Date.now() - t0} ms, in=${r.usage.inputTokens} out=${r.usage.outputTokens}`,
        r.output,
      );
    } catch (e) {
      console.log(`${model}: FAILED in ${Date.now() - t0} ms: ${e instanceof Error ? e.message : e}`);
    }
  }
}
main();
