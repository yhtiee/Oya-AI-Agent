import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { runWebTurn, type TurnEvent } from "@/server/agent/pipeline";
import { getSession } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";

/*
 * Web chat (SPEC §7.2 "Web"). Authenticated by the session cookie; the pipeline checks the conversation belongs
 * to the user before using it (R13). Streams newline-delimited JSON events: emergency cards first, then checked
 * sentences, then cards, then `done`.
 */

export const maxDuration = 60;

const Body = z.object({
  text: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().nullish(),
  clientMessageId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: TurnEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      try {
        await runWebTurn({
          client: getServiceClient(),
          userId: session.userId,
          conversationId: parsed.data.conversationId,
          text: parsed.data.text,
          clientMessageId: parsed.data.clientMessageId,
          emit,
        });
      } catch (e) {
        Sentry.captureException(e);
        emit({
          type: "text",
          text: "Something went wrong on my side. Please try again in a moment. For emergencies, call 112.",
        });
        emit({ type: "done", messageId: null });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
      "x-accel-buffering": "no",
    },
  });
}
