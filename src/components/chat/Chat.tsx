"use client";

import { ArrowUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildEmergencyCard, buildSupportCard } from "@/lib/safety/emergency-card";
import { matchEmergency } from "@/lib/safety/emergency";
import { cn } from "@/lib/utils";
import type { Card } from "@/types/cards";
import { CardView, EmergencyCardView, SupportCardView } from "./cards";

/*
 * The conversation (SPEC §14.2, §14.3). Streams /api/chat events (newline-delimited JSON): checked sentences
 * appear as they're released, cards after. The emergency keyword check runs here on every keystroke, so the
 * EmergencyCard shows even offline (§14.8). Offline sends are refused and the draft is kept (1a).
 */

export type ChatMessage = { id: string; role: "user" | "assistant" | "ops"; text: string; cards: Card[] };

type Event =
  | { type: "meta"; conversationId: string; userMessageId: string }
  | { type: "text"; text: string }
  | { type: "card"; card: Card }
  | { type: "notice"; text: string }
  | { type: "done"; messageId: string | null };

const SUGGESTIONS = ["power", "passport", "plumber", "clinic", "remind", "road", "food"] as const;

export function Chat({
  firstName,
  initialMessages,
  initialConversationId,
}: {
  firstName: string;
  initialMessages: ChatMessage[];
  initialConversationId: string | null;
}) {
  const t = useTranslations("chat");
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Local safety check on the draft: works with no network and no model.
  const localMatch = useMemo(() => matchEmergency(draft), [draft]);
  const localCard = useMemo(
    () =>
      localMatch?.kind === "emergency"
        ? buildEmergencyCard()
        : localMatch?.kind === "self_harm"
          ? buildSupportCard()
          : null,
    // A new card id only when the kind changes, so the card doesn't flicker while typing.
    [localMatch?.kind],
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const appendAssistant = (text: string) =>
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "assistant", text, cards: [] }]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    if (!navigator.onLine) {
      setNotice(t("offline"));
      return;
    }
    setNotice(null);
    setBusy(true);
    setDraft("");
    const userId = crypto.randomUUID();
    const replyId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: userId, role: "user", text: clean, cards: [] },
      { id: replyId, role: "assistant", text: "", cards: [] },
    ]);
    const patchReply = (fn: (r: ChatMessage) => ChatMessage) =>
      setMessages((m) => m.map((x) => (x.id === replyId ? fn(x) : x)));

    let created: string | null = null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: clean, conversationId, clientMessageId: userId }),
      });
      if (res.status === 401) {
        router.push("/login?next=%2Fapp");
        return;
      }
      if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as Event;
          if (e.type === "meta") {
            created = conversationId === null ? e.conversationId : null;
            setConversationId(e.conversationId);
          } else if (e.type === "text")
            patchReply((r) => ({ ...r, text: r.text ? `${r.text}${/\s$/.test(r.text) ? "" : " "}${e.text}` : e.text }));
          else if (e.type === "card") patchReply((r) => ({ ...r, cards: [...r.cards, e.card] }));
          else if (e.type === "notice") setNotice(e.text);
        }
      }
    } catch {
      patchReply((r) => ({ ...r, text: r.text || t("failed") }));
    } finally {
      setMessages((m) => m.filter((x) => x.id !== replyId || x.text || x.cards.length));
      setBusy(false);
      // A new conversation gets its own URL and a place in the sidebar.
      if (created) {
        router.replace(`/app?c=${created}`, { scroll: false });
        router.refresh();
      }
    }
  }

  const empty = messages.length === 0;

  const composer = (
    <div>
      {localCard && (
        <div className="mb-3">
          {localCard.type === "emergency" ? (
            <EmergencyCardView card={localCard} />
          ) : (
            <SupportCardView card={localCard} />
          )}
        </div>
      )}
      {(notice || !online) && (
        <p role="status" className="mb-2 rounded-[14px] bg-sand px-4 py-2 text-[0.9375rem] text-forest">
          {notice ?? t("offlineBanner")}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="rounded-[26px] bg-paper p-2 shadow-[0_10px_30px_-12px_rgba(16,36,27,0.18),0_0_0_1px_rgba(16,36,27,0.06)] transition-shadow focus-within:shadow-[0_14px_36px_-12px_rgba(16,36,27,0.28),0_0_0_1px_rgba(16,36,27,0.08)]"
      >
        <label htmlFor="composer" className="sr-only">
          {t("composerLabel")}
        </label>
        <textarea
          id="composer"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={empty ? 2 : 1}
          maxLength={2000}
          placeholder={t("composerPlaceholder")}
          className="composer-input block max-h-40 min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-[1.0625rem] text-forest outline-none placeholder:text-muted"
        />
        <div className="flex items-center justify-between gap-2 pl-2">
          <span className="text-xs text-muted">{t("composerHint")}</span>
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label={t("send")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-orange text-forest transition-opacity disabled:opacity-40"
          >
            <ArrowUp aria-hidden="true" size={20} strokeWidth={2.5} />
          </button>
        </div>
      </form>
    </div>
  );

  if (empty) {
    return (
      <div
        className="relative -mx-4 flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 pb-16 sm:-mx-6"
        aria-busy={busy}
        data-chat-log
      >
        {/* A soft sunrise behind the greeting: orange over leaf, from the brand palette. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{
            background:
              "radial-gradient(42rem 22rem at 50% 46%, rgba(242,140,40,0.16), transparent 70%), radial-gradient(30rem 18rem at 58% 60%, rgba(46,158,107,0.10), transparent 70%)",
          }}
        />
        <div className="relative w-full max-w-[680px]">
          <h1 className="text-center font-display text-[clamp(1.9rem,5vw,3rem)] leading-[1.05] font-bold tracking-[-0.02em] text-forest">
            {t("emptyTitle", { name: firstName })}
          </h1>
          <p className="mt-3 text-center text-lg text-body">{t("emptyLead")}</p>
          <div className="mt-8">{composer}</div>
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => send(t(`suggest.${s}`))}
                  className="min-h-10 rounded-full border border-hairline bg-paper/80 px-4 text-[0.9375rem] font-bold text-forest hover:border-forest"
                >
                  {t(`suggest.${s}`)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[760px] flex-col">
      <div className="flex-1 space-y-5 pt-2 pb-6" aria-live="polite" aria-busy={busy} data-chat-log>
        {messages.map((m) => (
          <div
            key={m.id}
            data-role={m.role}
            className={cn("flex flex-col gap-3", m.role === "user" ? "items-end" : "items-start")}
          >
            {(m.text || (m.role !== "user" && !m.cards.length)) && (
              <p
                className={cn(
                  "max-w-[85%] rounded-[22px] px-4 py-3 text-[1.0625rem] leading-relaxed whitespace-pre-line",
                  m.role === "user"
                    ? "rounded-br-[6px] bg-mint text-forest"
                    : "rounded-bl-[6px] border border-hairline bg-paper text-forest",
                )}
              >
                {m.text || (
                  <span className="inline-flex gap-1 text-muted" aria-label={t("thinking")}>
                    ···
                  </span>
                )}
              </p>
            )}
            {m.cards.length > 0 && (
              <div className="grid w-full max-w-[560px] gap-3">
                {m.cards.map((c) => (
                  <CardView key={c.id} card={c} onAnswered={appendAssistant} />
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-cream from-70% to-transparent pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {composer}
      </div>
    </div>
  );
}
