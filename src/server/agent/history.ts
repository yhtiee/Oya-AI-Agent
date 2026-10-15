import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Card } from "@/types/cards";

/* Conversation list and history for the chat pages. Every query is scoped to the user's id. */

export type ConversationSummary = { id: string; title: string; lastAt: string };

/** The user's web conversations, newest first, titled by their first message. */
export async function listConversations(
  client: SupabaseClient,
  userId: string,
  limit = 30,
): Promise<ConversationSummary[]> {
  const { data: convs } = await client
    .from("conversations")
    .select("id, created_at, last_message_at")
    .eq("user_id", userId)
    .eq("channel", "web")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (!convs?.length) return [];

  const { data: firsts } = await client
    .from("messages")
    .select("conversation_id, text, created_at")
    .in(
      "conversation_id",
      convs.map((c) => c.id),
    )
    .eq("role", "user")
    .order("created_at", { ascending: true })
    .limit(500);

  const titleOf = new Map<string, string>();
  for (const m of firsts ?? []) {
    if (!titleOf.has(m.conversation_id) && m.text) titleOf.set(m.conversation_id, m.text as string);
  }
  return convs
    .filter((c) => titleOf.has(c.id))
    .map((c) => {
      const raw = titleOf.get(c.id)!;
      const title = raw === "[support shown]" ? "Support" : raw.length > 48 ? `${raw.slice(0, 47).trimEnd()}…` : raw;
      return { id: c.id, title, lastAt: (c.last_message_at ?? c.created_at) as string };
    });
}

/**
 * Messages for one conversation. `conversationId` null means the latest one; "new" means an empty chat.
 * A conversation id that isn't the user's is treated as new (never shown).
 */
export async function loadChatHistory(client: SupabaseClient, userId: string, conversationId: string | null | "new") {
  if (conversationId === "new") return { conversationId: null, messages: [] };

  let query = client.from("conversations").select("id").eq("user_id", userId).eq("channel", "web");
  query = conversationId
    ? query.eq("id", conversationId)
    : query.order("last_message_at", { ascending: false, nullsFirst: false }).limit(1);
  const { data: conv } = await query.maybeSingle();
  if (!conv) return { conversationId: null, messages: [] };

  const { data } = await client
    .from("messages")
    .select("id, role, text, cards, created_at")
    .eq("conversation_id", conv.id)
    .in("role", ["user", "assistant", "ops"])
    .order("created_at", { ascending: false })
    .limit(40);

  const messages = (data ?? []).reverse().map((m) => ({
    id: m.id as string,
    role: m.role as "user" | "assistant" | "ops",
    text: (m.text as string | null) ?? "",
    // Drop anything that no longer matches a card schema rather than break the page.
    cards: ((m.cards as unknown[]) ?? []).flatMap((c) => {
      const parsed = Card.safeParse(c);
      return parsed.success ? [parsed.data] : [];
    }),
  }));
  return { conversationId: conv.id as string, messages };
}
