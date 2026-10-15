import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isTerminal, isTaskStatus } from "../tasks/transitions";

/*
 * Turn context (SPEC §7.2 step 3): language, saved place labels and area names (no coordinates), active tasks,
 * the pending confirmation, and the last 12 messages. Message text is stored redacted, so nothing here carries
 * phone numbers or IDs (R14).
 */

export type TurnContext = {
  userId: string;
  conversationId: string;
  firstName: string | null;
  language: "en" | "pcm";
  powerCluster: string | null;
  savedPlaces: { label: string; area: string | null }[];
  activeTasks: { id: string; skill: string; status: string; title: string }[];
  pendingConfirmation: { id: string; kind: string; summary: string; expiresAt: string } | null;
  recent: { role: "user" | "assistant" | "ops"; text: string }[];
  supportMode: boolean;
};

export async function loadTurnContext(
  client: SupabaseClient,
  userId: string,
  conversationId: string,
  excludeMessageId?: string,
): Promise<TurnContext> {
  const [profile, places, tasks, pending, messages, conversation] = await Promise.all([
    client.from("profiles").select("display_name, language, power_area_id").eq("id", userId).single(),
    client.from("saved_places").select("label, area_id").eq("user_id", userId).limit(10),
    client
      .from("tasks")
      .select("id, skill_id, status, title")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20),
    client
      .from("confirmations")
      .select("id, kind, summary_text, expires_at")
      .eq("conversation_id", conversationId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
    client
      .from("messages")
      .select("id, role, text")
      .eq("conversation_id", conversationId)
      .in("role", ["user", "assistant", "ops"])
      .order("created_at", { ascending: false })
      .limit(13),
    client.from("conversations").select("support_mode_until").eq("id", conversationId).single(),
  ]);

  const areaIds = [profile.data?.power_area_id, ...(places.data ?? []).map((p) => p.area_id)].filter(
    Boolean,
  ) as string[];
  const { data: areas } = areaIds.length
    ? await client.from("areas").select("id, name").in("id", areaIds)
    : { data: [] as { id: string; name: string }[] };
  const areaName = (id: string | null | undefined) => areas?.find((a) => a.id === id)?.name ?? null;

  const lang = profile.data?.language;
  return {
    userId,
    conversationId,
    firstName: (profile.data?.display_name ?? "").split(" ")[0] || null,
    language: lang === "pcm" ? "pcm" : "en",
    powerCluster: areaName(profile.data?.power_area_id),
    savedPlaces: (places.data ?? []).map((p) => ({ label: p.label, area: areaName(p.area_id) })),
    activeTasks: (tasks.data ?? [])
      .filter((t) => isTaskStatus(t.status) && !isTerminal(t.status) && t.status !== "completed")
      .slice(0, 5)
      .map((t) => ({ id: t.id, skill: t.skill_id, status: t.status, title: t.title })),
    pendingConfirmation: pending.data
      ? {
          id: pending.data.id,
          kind: pending.data.kind,
          summary: pending.data.summary_text,
          expiresAt: pending.data.expires_at,
        }
      : null,
    recent: (messages.data ?? [])
      .filter((m) => m.id !== excludeMessageId && m.text)
      .slice(0, 12)
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant" | "ops", text: (m.text as string).slice(0, 600) })),
    supportMode: Boolean(
      conversation.data?.support_mode_until && Date.parse(conversation.data.support_mode_until) > Date.now(),
    ),
  };
}
