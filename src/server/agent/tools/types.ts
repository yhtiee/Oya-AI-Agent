import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { Card } from "@/types/cards";
import type { GroundingSources } from "../grounding";

/* Tool definitions (SPEC §7.5). Every tool is defined once with zod schemas, a side-effect class and a handler. */

export type SideEffect = "read" | "write_internal" | "message_third_party" | "share_contact" | "money";

export type ConfirmationKind =
  | "fanout"
  | "booking"
  | "reschedule"
  | "cancel"
  | "share_booking"
  | "payment"
  | "reminder"
  | "watch"
  | "preference"
  | "save_place";

export type ToolContext = {
  client: SupabaseClient;
  userId: string;
  conversationId: string;
  taskId: string | null;
  language: "en" | "pcm";
  /** Facts the model may repeat this turn (grounding, §7.2 step 9). */
  sources: GroundingSources;
  /** Tool results from this turn, in order, for the card builders. */
  results: { tool: string; output: unknown }[];
  /** Cards produced directly by the registry (ConfirmCards). */
  cards: Card[];
};

export type ToolDefinition<I extends z.ZodType = z.ZodType, O = unknown> = {
  name: string;
  description: string;
  sideEffect: SideEffect;
  input: I;
  /**
   * Side-effect tools that need the user's yes (§7.6). The registry stores the validated call as a pending
   * confirmation and the handler runs only after claim_confirmation succeeds.
   */
  confirmation?: {
    kind: ConfirmationKind;
    consents?: ("share_contact" | "location")[];
    summarise: (input: z.infer<I>, ctx: ToolContext) => { title: string; lines: string[] };
  };
  handler: (input: z.infer<I>, ctx: ToolContext) => Promise<O>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = ToolDefinition<any, any>;
