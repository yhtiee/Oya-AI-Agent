import { Chat } from "@/components/chat/Chat";
import { loadChatHistory } from "@/server/agent/history";
import { requireSession } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";

/* /app opens the latest conversation, /app?c={id} a specific one, /app?new=1 a fresh one. */
export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const session = await requireSession("/app");
  const params = await searchParams;
  const requested = params.new ? "new" : typeof params.c === "string" ? params.c : null;
  const history = await loadChatHistory(getServiceClient(), session.userId, requested);

  return (
    <Chat
      key={history.conversationId ?? `new-${String(params.new ?? "")}`}
      firstName={session.displayName.split(" ")[0] ?? session.displayName}
      initialMessages={history.messages}
      initialConversationId={history.conversationId}
    />
  );
}
