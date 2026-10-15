import "server-only";
import type { Card, InfoCard } from "@/types/cards";
import type { CardRule } from "./skills/types";

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

export function buildCards(rules: CardRule[], results: { tool: string; output: unknown }[]): Card[] {
  const cards: Card[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    for (const rule of rules.filter((x) => x.tool === r.tool)) {
      if (rule.card === "info") {
        const card = buildInfoCard(r.output);
        const key = card ? `info:${card.title}` : "";
        if (card && !seen.has(key)) {
          seen.add(key);
          cards.push(card);
        }
      }
    }
  }
  return cards;
}
