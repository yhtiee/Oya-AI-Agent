"use client";

import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { formatNaira } from "@/lib/money";
import { cn } from "@/lib/utils";
import { answerConfirmation } from "@/server/actions/chat";
import type { Card, ConfirmCard, EmergencyCard, InfoCard, SupportCard } from "@/types/cards";
import {
  ClusterPickerCardView,
  LocalAlertsCardView,
  PowerStatusCardView,
  ReminderCardView,
  type Answer,
} from "./m4-cards";

/* Card views (SPEC §14.5, Appendix A). Every href comes from the server card; nothing here invents facts. */

function SourceLine({ label, asOf }: { label: string; asOf: string }) {
  const date = new Date(asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  return (
    <p className="mt-4 text-[0.8125rem] text-muted">
      {label} · {date}
    </p>
  );
}

export function EmergencyCardView({ card }: { card: EmergencyCard }) {
  const t = useTranslations("chat");
  return (
    <section
      aria-label={t("emergencyTitle")}
      className="rounded-[24px] border-2 border-ember bg-peach p-5 text-forest shadow-[0_1px_0_rgba(16,36,27,0.08)]"
    >
      <p className="text-sm font-bold tracking-wide text-ember uppercase">{t("emergencyTitle")}</p>
      <a
        href={card.primary.href}
        className="mt-3 flex min-h-16 items-center justify-between gap-3 rounded-[20px] bg-ember px-5 py-4 font-display text-2xl font-extrabold text-paper"
      >
        <span>{t("call112")}</span>
        <Phone aria-hidden="true" size={26} strokeWidth={2.4} />
      </a>
      {card.secondary.length > 0 && (
        <ul className="mt-3 grid gap-2">
          {card.secondary.map((s) => (
            <li key={s.href}>
              <a
                href={s.href}
                className="flex min-h-12 items-center rounded-[16px] bg-paper px-4 font-bold underline-offset-4 hover:underline"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[0.9375rem]">{card.note}</p>
      <a href="/help/emergency" className="mt-2 inline-block text-sm font-bold text-ember underline underline-offset-4">
        {t("moreNumbers")}
      </a>
    </section>
  );
}

export function SupportCardView({ card }: { card: SupportCard }) {
  const t = useTranslations("chat");
  return (
    <section
      aria-label={t("supportTitle")}
      className="rounded-[24px] border border-deep-leaf/30 bg-mint p-5 text-forest"
    >
      <p className="font-bold">{card.note}</p>
      {card.lines.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {card.lines.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="flex min-h-12 items-center rounded-[16px] bg-paper px-4 font-bold">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[0.9375rem] text-body">{t("supportLinesPending")}</p>
      )}
      <a
        href={card.emergency.href}
        className="mt-3 flex min-h-12 items-center justify-between rounded-[16px] bg-forest px-4 font-bold text-paper"
      >
        {card.emergency.label}
        <Phone aria-hidden="true" size={20} />
      </a>
    </section>
  );
}

export function InfoCardView({ card }: { card: InfoCard }) {
  const t = useTranslations("chat");
  return (
    <section className="rounded-[24px] border border-hairline bg-paper p-5 text-forest">
      <h3 className="font-display text-xl font-bold">{card.title}</h3>
      {card.staleWarning && (
        <p className="mt-2 rounded-[12px] bg-peach px-3 py-2 text-sm font-bold">{t("staleGuide")}</p>
      )}
      <p className="mt-2 text-body">{card.bodyMd}</p>
      {card.fees.length > 0 && (
        <dl className="mt-4 grid gap-1.5">
          {card.fees.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4 border-b border-hairline pb-1.5">
              <dt>{f.label}</dt>
              <dd className="font-bold tabular-nums">{formatNaira(f.amountKobo)}</dd>
            </div>
          ))}
        </dl>
      )}
      {card.steps.length > 0 && (
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-body">
          {card.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      )}
      {card.officialLinks.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {card.officialLinks.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full border border-hairline px-4 text-sm font-bold text-deep-leaf"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      )}
      <SourceLine label={card.source.label} asOf={card.source.asOf} />
    </section>
  );
}

export function ConfirmCardView({ card, onAnswered }: { card: ConfirmCard; onAnswered: Answer }) {
  const t = useTranslations("chat");
  const [state, setState] = useState<"open" | "done" | "expired">("open");
  const [pending, start] = useTransition();

  const answer = (decision: "confirm" | "decline") =>
    start(async () => {
      const r = await answerConfirmation({ confirmationId: card.confirmationId, decision });
      if (r.status === "ok") {
        setState(r.data.ok ? "done" : "expired");
        onAnswered(r.data.text, r.data.cards);
      } else if (r.status === "error") onAnswered(r.error);
    });

  return (
    <section className="rounded-[24px] border-2 border-forest bg-paper p-5 text-forest">
      <h3 className="font-display text-xl font-bold">{card.title}</h3>
      <ul className="mt-2 space-y-1 text-body">
        {card.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {state === "open" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={pending}
              onClick={() => answer(a.id === "confirm" ? "confirm" : "decline")}
              className={cn(
                "min-h-12 rounded-full px-6 font-bold transition-opacity disabled:opacity-60",
                a.kind === "primary" ? "bg-forest text-paper" : "border-2 border-hairline text-forest",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-bold text-muted">{state === "done" ? t("answered") : t("expired")}</p>
      )}
    </section>
  );
}

export function CardView({ card, onAnswered }: { card: Card; onAnswered: Answer }) {
  switch (card.type) {
    case "emergency":
      return <EmergencyCardView card={card} />;
    case "support":
      return <SupportCardView card={card} />;
    case "info":
      return <InfoCardView card={card} />;
    case "confirm":
      return <ConfirmCardView card={card} onAnswered={onAnswered} />;
    case "power_status":
      return <PowerStatusCardView card={card} onAnswered={onAnswered} />;
    case "cluster_picker":
      return <ClusterPickerCardView card={card} onAnswered={onAnswered} />;
    case "local_alerts":
      return <LocalAlertsCardView card={card} />;
    case "reminder":
      return <ReminderCardView card={card} onAnswered={onAnswered} />;
  }
}
