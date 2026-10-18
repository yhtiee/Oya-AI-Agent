"use client";

import { AlertTriangle, Bell, BellRing, Lightbulb, LightbulbOff, MapPin, Repeat } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { cancelReminderTap, pickClusterTap, reportPowerTap, watchPowerTap } from "@/server/actions/power";
import type { Card, ClusterPickerCard, LocalAlertsCard, PowerStatusCard, ReminderCard } from "@/types/cards";

/*
 * Power, alerts and reminder cards (SPEC §5.1, §5.6, §5.7, Appendix A). Buttons call server actions directly
 * (tap first, AI second); the reply comes back as an Oya message plus any updated card.
 */

export type Answer = (text: string, cards?: Card[]) => void;

function ago(iso: string | null, t: ReturnType<typeof useTranslations>): string {
  if (!iso) return t("never");
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return t("justNow");
  if (min < 60) return t("minAgo", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("hoursAgo", { n: h });
  return t("daysAgo", { n: Math.round(h / 24) });
}

function useTap(onAnswered: Answer) {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ status: string; data?: { text: string; cards: Card[] }; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.status === "ok" && r.data) onAnswered(r.data.text, r.data.cards);
      else if (r.error) onAnswered(r.error);
    });
  return { pending, run };
}

const STATUS_STYLE: Record<PowerStatusCard["status"], string> = {
  on: "bg-mint text-deep-leaf",
  off: "bg-forest text-cream",
  uncertain: "bg-sand text-forest",
  unknown: "bg-sand text-muted",
};

export function PowerStatusCardView({ card, onAnswered }: { card: PowerStatusCard; onAnswered: Answer }) {
  const t = useTranslations("power");
  const { pending, run } = useTap(onAnswered);
  const label = { on: t("on"), off: t("off"), uncertain: t("uncertain"), unknown: t("unknown") }[card.status];
  const Icon = card.status === "on" ? Lightbulb : LightbulbOff;

  return (
    <section className="rounded-[24px] border border-hairline bg-paper p-5 text-forest">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin size={14} aria-hidden="true" /> {card.areaName}
          </p>
          <p className="mt-2 font-display text-2xl font-bold">{label}</p>
          <p className="mt-0.5 text-[0.9375rem] text-body">{card.confidenceText}</p>
        </div>
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-full", STATUS_STYLE[card.status])}>
          <Icon size={22} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm text-body">
        {t("lastChange")}: {ago(card.lastChangeAt, t)}
      </p>
      {card.fewReporters && <p className="mt-2 rounded-[12px] bg-peach px-3 py-2 text-sm">{t("fewReporters")}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reportPowerTap({ areaId: card.areaId, status: "on" }))}
          className="min-h-11 rounded-full bg-forest px-4 text-sm font-bold text-paper disabled:opacity-60"
        >
          {t("reportOn")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reportPowerTap({ areaId: card.areaId, status: "off" }))}
          className="min-h-11 rounded-full border-2 border-forest px-4 text-sm font-bold text-forest disabled:opacity-60"
        >
          {t("reportOff")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => watchPowerTap({ areaId: card.areaId, type: card.status === "on" ? "power_off" : "power_on" }))
          }
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-hairline px-4 text-sm font-bold text-deep-leaf disabled:opacity-60"
        >
          <BellRing size={15} aria-hidden="true" />
          {card.status === "on" ? t("alertOff") : t("alertOn")}
        </button>
      </div>
      <p className="mt-4 text-[0.8125rem] text-muted">
        {card.source.label} · {ago(card.source.asOf, t)}
      </p>
    </section>
  );
}

export function ClusterPickerCardView({ card, onAnswered }: { card: ClusterPickerCard; onAnswered: Answer }) {
  const { pending, run } = useTap(onAnswered);
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <section className="rounded-[24px] border border-hairline bg-paper p-5 text-forest">
      <p className="font-bold">{card.note}</p>
      {card.clusters.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {card.clusters.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                disabled={pending || chosen !== null}
                onClick={() => {
                  setChosen(c.id);
                  run(() => pickClusterTap({ areaId: c.id }));
                }}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-bold disabled:opacity-60",
                  chosen === c.id ? "border-forest bg-forest text-paper" : "border-hairline text-forest",
                )}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SEVERITY: Record<LocalAlertsCard["alerts"][number]["severity"], string> = {
  severe: "border-ember bg-peach",
  warning: "border-orange/50 bg-paper",
  info: "border-hairline bg-paper",
};

export function LocalAlertsCardView({ card }: { card: LocalAlertsCard }) {
  const t = useTranslations("alerts");
  const when = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "Africa/Lagos",
      weekday: "short",
      hour: "numeric",
      hour12: true,
      minute: "2-digit",
    });
  return (
    <section className="rounded-[24px] border border-hairline bg-paper p-5 text-forest">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <MapPin size={14} aria-hidden="true" /> {card.areaName}
      </p>
      {card.alerts.length === 0 ? (
        <p className="mt-2 font-bold">{t("none")}</p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {card.alerts.map((a) => (
            <li key={a.id} className={cn("rounded-[16px] border p-4", SEVERITY[a.severity])}>
              <p className="flex items-center gap-2 font-bold">
                {a.severity !== "info" && <AlertTriangle size={16} className="text-ember" aria-hidden="true" />}
                {a.title}
              </p>
              <p className="mt-1 text-[0.9375rem] text-body">{a.body}</p>
              <p className="mt-2 text-[0.8125rem] text-muted">
                {when(a.startsAt)}
                {a.endsAt ? ` – ${when(a.endsAt)}` : ""} ·{" "}
                <a
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-deep-leaf underline"
                >
                  {t("source")}
                </a>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-[0.8125rem] text-muted">{card.source.label}</p>
    </section>
  );
}

export function ReminderCardView({ card, onAnswered }: { card: ReminderCard; onAnswered: Answer }) {
  const t = useTranslations("reminders");
  const { pending, run } = useTap(onAnswered);
  const [cancelled, setCancelled] = useState(card.status === "cancelled");
  return (
    <section className="rounded-[24px] border border-hairline bg-paper p-5 text-forest">
      <p className="flex items-center gap-2 text-sm text-muted">
        <Bell size={14} aria-hidden="true" /> {t("reminder")}
      </p>
      <p className={cn("mt-2 font-display text-xl font-bold", cancelled && "text-muted line-through")}>{card.title}</p>
      <p className="mt-1 text-body">{card.whenText}</p>
      {card.repeatText && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-body">
          <Repeat size={14} aria-hidden="true" /> {card.repeatText}
        </p>
      )}
      {!cancelled && card.status === "scheduled" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setCancelled(true);
            run(() => cancelReminderTap({ reminderId: card.reminderId }));
          }}
          className="mt-4 min-h-11 rounded-full border border-hairline px-4 text-sm font-bold text-forest disabled:opacity-60"
        >
          {t("cancel")}
        </button>
      )}
    </section>
  );
}
