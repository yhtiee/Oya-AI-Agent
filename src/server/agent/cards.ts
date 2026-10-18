import "server-only";
import type { Card, InfoCard } from "@/types/cards";
import { buildAlertsCard, type AlertRow } from "../alerts/service";
import { buildClusterPicker, buildPowerCard } from "../power/service";
import { buildReminderCard, type ReminderRow } from "../reminders/service";
import type { CardRule } from "./skills/types";
import type { Lang } from "./templates";

/*
 * Card builders (SPEC §7.2 step 8, Appendix A, R3). Cards come only from this turn's tool results, carry the
 * tool's source and freshness, and get every href from the server. The model never writes card content.
 */

const STALE_AFTER_DAYS = 60; // §5.2: ops re-verify guides at least every 60 days

type KbDocument = {
  slug: string;
  title: string;
  one_liner: string;
  body_md: string;
  steps: unknown;
  fees: unknown;
  official_urls: string[];
  last_verified_at: string;
};

function isUrl(s: unknown): s is string {
  if (typeof s !== "string") return false;
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
}

export function buildInfoCard(output: unknown, now = new Date()): InfoCard | null {
  const o = output as { found?: boolean; document?: KbDocument };
  if (!o?.found || !o.document) return null;
  const d = o.document;
  const steps = Array.isArray(d.steps)
    ? d.steps
        .map((s) => (typeof s === "string" ? s : (s as { text?: string })?.text))
        .filter((s): s is string => typeof s === "string")
        .slice(0, 12)
    : [];
  const fees = Array.isArray(d.fees)
    ? d.fees
        .map((f) => f as { label?: string; amount_kobo?: number; note?: string })
        .filter((f) => typeof f.label === "string" && Number.isInteger(f.amount_kobo))
        .map((f) => ({ label: f.label!, amountKobo: f.amount_kobo!, ...(f.note ? { note: f.note } : {}) }))
    : [];
  const verified = new Date(d.last_verified_at);
  const ageDays = (now.getTime() - verified.getTime()) / 86_400_000;
  return {
    type: "info",
    id: crypto.randomUUID(),
    title: d.title,
    bodyMd: (d.one_liner || d.body_md).slice(0, 1200),
    steps,
    fees,
    officialLinks: (d.official_urls ?? [])
      .filter(isUrl)
      .slice(0, 4)
      .map((url) => ({ label: new URL(url).hostname.replace(/^www\./, ""), url })),
    lastVerifiedAt: verified.toISOString(),
    staleWarning: ageDays > STALE_AFTER_DAYS,
    source: {
      label: "Official fee · checked by Oya",
      asOf: verified.toISOString(),
      attribution: "none",
      verified: true,
    },
    actions: [],
  };
}

/** One card from one tool result, by rule. Returns null when the result doesn't warrant a card. */
function cardFor(rule: CardRule["card"], output: unknown, lang: Lang): Card | null {
  const o = output as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || "error" in o) return null;
  switch (rule) {
    case "info":
      return buildInfoCard(output);
    case "power_status":
      return o.needsCluster === false ? buildPowerCard(o as Parameters<typeof buildPowerCard>[0], lang) : null;
    case "cluster_picker":
      return o.needsCluster === true
        ? buildClusterPicker((o.clusters as { id: string; name: string }[]) ?? [], lang)
        : null;
    case "local_alerts": {
      const area = o.area as { name: string } | null;
      return area ? buildAlertsCard(area.name, (o.alerts as AlertRow[]) ?? []) : null;
    }
    case "reminder":
      return o.reminder ? buildReminderCard(o.reminder as ReminderRow) : null;
  }
}

export function buildCards(rules: CardRule[], results: { tool: string; output: unknown }[], lang: Lang = "en"): Card[] {
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    for (const rule of rules.filter((x) => x.tool === r.tool)) {
      const card = cardFor(rule.card, r.output, lang);
      if (!card) continue;
      // One card per kind and subject per turn (a skill may call the same tool twice).
      const key =
        card.type === "info"
          ? `info:${card.title}`
          : card.type === "reminder"
            ? `reminder:${card.reminderId}`
            : card.type;
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push(card);
    }
  }
  return cards;
}

/** Cards shown after a confirmed action runs (a ConfirmCard answered in chat or by tap). */
export const CONFIRMED_CARD_RULES: CardRule[] = [{ tool: "create_reminder", card: "reminder" }];
