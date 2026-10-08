"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { HERO_ASKS, HERO_ASK_BY_ID, type HeroAsk as Ask } from "@/lib/marketing/content";
import { WHATSAPP_LIVE, whatsappLink } from "@/lib/marketing/site";
import { usePrefersReducedMotion } from "@/lib/hooks/use-reduced-motion";
import { UiIcon } from "./icons";
import { Street } from "./Street";

type Thread = { n: number; text: string; preset: Ask | null };

const REPLY_DELAY_MS = 1300;

export function HeroAsk({ intro }: { intro: ReactNode }) {
  const reduced = usePrefersReducedMotion();
  const [draft, setDraft] = useState("");
  const [thread, setThread] = useState<Thread | null>(null);
  const [repliedTo, setRepliedTo] = useState<number | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const replied = thread !== null && (reduced || repliedTo === thread.n);

  useEffect(() => {
    if (!thread || reduced) return;
    const timer = window.setTimeout(() => setRepliedTo(thread.n), REPLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [thread, reduced]);

  function send(text: string, preset: Ask | null) {
    setThread((t) => ({ n: (t?.n ?? 0) + 1, text, preset }));
    setDraft("");
    requestAnimationFrame(() =>
      threadRef.current?.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }),
    );
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = draft.trim();
    if (text) send(text, null);
  }

  return (
    <>
      <div className="relative z-10 mx-auto max-w-[880px] text-center">
        {intro}

        <form
          onSubmit={submit}
          className="mx-auto mt-8 max-w-[640px] rounded-[26px] border border-forest-edge bg-forest/85 p-2.5 text-left shadow-floating backdrop-blur transition-colors focus-within:border-orange"
        >
          <label htmlFor="oya-ask" className="sr-only">
            Tell Oya what you need
          </label>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full text-orange">
              <UiIcon name="mic" />
            </span>
            <input
              id="oya-ask"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tell Oya what you need"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-3.5 text-lg text-cream outline-none placeholder:text-body-on-dark"
            />
            <button
              type="submit"
              aria-label="Send to Oya"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-orange text-forest transition-colors hover:bg-orange-soft"
            >
              <UiIcon name="arrow-up" />
            </button>
          </div>
        </form>

        <div ref={threadRef} aria-live="polite" className="mx-auto max-w-[640px] text-left">
          {thread && (
            <div key={thread.n} className="mt-4 space-y-2">
              <p className="animate-rise ml-auto max-w-[85%] rounded-[20px] rounded-br-[6px] bg-mint px-4 py-3 text-forest">
                {thread.text}
              </p>
              <div className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-orange font-display font-extrabold text-forest"
                >
                  o
                </span>
                {replied ? <Reply thread={thread} /> : <Typing />}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2" role="group" aria-label="Try an example">
          {HERO_ASKS.filter((a) => a.chip).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => send(a.ask, a)}
              className="rounded-full border border-forest-edge px-3.5 py-1.5 text-sm font-bold text-body-on-dark transition-colors duration-150 hover:border-cream hover:text-cream"
            >
              {a.chip}
            </button>
          ))}
        </div>

        <p className="mt-6 text-[0.9375rem] text-body-on-dark">
          Free for everyone. Nothing to download.{" "}
          <span className="pointer-coarse:hidden">Everybody on this street needs something: point at a house.</span>
          <span className="hidden pointer-coarse:inline">Everybody on this street needs something: tap a house.</span>
        </p>
      </div>

      <Street
        onAsk={(id) => send(HERO_ASK_BY_ID[id].ask, HERO_ASK_BY_ID[id])}
        className="absolute inset-x-0 bottom-0 z-0 h-[220px] w-full sm:h-[290px] lg:h-[320px]"
      />
    </>
  );
}

function Typing() {
  return (
    <span
      role="img"
      aria-label="Oya is typing"
      className="flex gap-1 rounded-[20px] rounded-bl-[6px] bg-paper px-4 py-4"
    >
      <span className="typing-dot size-2 rounded-full bg-body" />
      <span className="typing-dot size-2 rounded-full bg-body" />
      <span className="typing-dot size-2 rounded-full bg-body" />
    </span>
  );
}

function Reply({ thread }: { thread: Thread }) {
  const { preset, text } = thread;

  if (!preset) {
    return (
      <div className="animate-rise max-w-[85%] rounded-[20px] rounded-bl-[6px] bg-paper px-4 py-3 text-forest">
        <p>
          {WHATSAPP_LIVE
            ? "Got it. Send it to me on WhatsApp and I'll take it from there."
            : "Got it. I'm opening one area at a time. Leave your number and I'll message you on WhatsApp when I reach yours."}
        </p>
        <a
          href={whatsappLink(text)}
          className="mt-2 inline-block rounded-[14px] bg-forest px-4 py-2 text-sm font-bold text-cream hover:bg-forest-card"
        >
          {WHATSAPP_LIVE ? "Continue on WhatsApp" : "Get early access"}
        </a>
      </div>
    );
  }

  return (
    <div className="animate-rise max-w-[85%]">
      <div className="rounded-[20px] rounded-bl-[6px] bg-paper px-4 py-3 text-forest">
        <p>{preset.reply}</p>
        {preset.action && (
          <span className="mt-2 inline-block rounded-[14px] bg-mint px-4 py-2 text-sm font-bold text-deep-leaf">
            {preset.action}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-body-on-dark">
        {WHATSAPP_LIVE ? (
          <a href={whatsappLink(text)} className="font-bold text-cream underline underline-offset-4">
            Ask this for real on WhatsApp
          </a>
        ) : (
          <>
            A preview. Oya isn&apos;t in your area yet.{" "}
            <a href="#early-access" className="font-bold text-cream underline underline-offset-4">
              Get early access
            </a>
          </>
        )}
      </p>
    </div>
  );
}
