/*
 * Grounding check (SPEC §7.2 step 9, R3). Every ₦ amount, clock time, date and percentage in the model's
 * text must appear in this turn's tool results or the user's own messages. Phone numbers are never allowed
 * in model text (R14): the app shows them only on cards, filled server-side.
 *
 * Both sides are normalised before matching: "₦3,000", "N3000", "NGN 3,000", "3k" and "3000 naira" are
 * the same amount; "9am", "9:00am" and "09:00" the same time; "15th March", "March 15" and "15/03" the
 * same date.
 */

export type FactKind = "amount" | "time" | "date" | "percent" | "phone";
export type Fact = { kind: FactKind; raw: string; key: string };
export type GroundingResult = { ok: true } | { ok: false; violations: Fact[] };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH_RE = String.raw`(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)`;

function monthIndex(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

const pad = (n: number) => String(n).padStart(2, "0");

function amountKey(numText: string, suffix?: string): string {
  let n = Number(numText.replace(/[,\s]/g, ""));
  if (suffix && /^k$/i.test(suffix)) n *= 1000;
  if (suffix && /^m$/i.test(suffix)) n *= 1_000_000;
  return String(Math.round(n * 100) / 100);
}

function timeKey(h: number, m: number, ampm?: string): string | null {
  if (ampm) {
    const pm = /^p/i.test(ampm);
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (pm ? 12 : 0);
  }
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

type Extractor = { kind: FactKind; re: RegExp; key: (m: RegExpExecArray) => string | null };

const NUM = String.raw`\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;

const EXTRACTORS: Extractor[] = [
  {
    kind: "phone",
    re: /(?:\+?234[\s-]?|\b0)[789][01]\d(?:[\s-]?\d){7}\b|\+\d(?:[\s-]?\d){7,14}\b|\b\d{3}[\s-]\d{3,4}[\s-]\d{4}\b/g,
    key: (m) => m[0].replace(/\D/g, "").replace(/^234/, "0"),
  },
  {
    kind: "amount",
    re: new RegExp(String.raw`(?:₦|\bNGN\s?|\bN(?=\d))\s?(${NUM})\s?([km])?\b`, "gi"),
    key: (m) => amountKey(m[1], m[2]),
  },
  {
    kind: "amount",
    re: new RegExp(String.raw`\b(${NUM})\s?([km])?\s?(?:naira|ngn)\b`, "gi"),
    key: (m) => amountKey(m[1], m[2]),
  },
  {
    kind: "amount",
    // "3k", "15k" on their own are amounts in Nigerian usage ("call-out na 3k").
    re: /\b(\d+(?:\.\d+)?)(k)\b/gi,
    key: (m) => amountKey(m[1], m[2]),
  },
  {
    kind: "percent",
    re: /\b(\d+(?:\.\d+)?)\s?(?:%|percent\b|per cent\b)/gi,
    key: (m) => String(Number(m[1])),
  },
  {
    kind: "time",
    re: /\b(\d{1,2})(?::|\.)(\d{2})\s?(am|pm|a\.m\.|p\.m\.)?(?![\d%])/gi,
    key: (m) => timeKey(Number(m[1]), Number(m[2]), m[3]),
  },
  {
    kind: "time",
    re: /\b(\d{1,2})\s?(am|pm|a\.m\.|p\.m\.)(?![a-z])/gi,
    key: (m) => timeKey(Number(m[1]), 0, m[2]),
  },
  {
    kind: "date",
    re: new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+${MONTH_RE}\b(?:,?\s+(\d{4}))?`, "gi"),
    key: (m) => `${pad(monthIndex(m[2]))}-${pad(Number(m[1]))}`,
  },
  {
    kind: "date",
    re: new RegExp(String.raw`\b${MONTH_RE}\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?`, "gi"),
    key: (m) => `${pad(monthIndex(m[1]))}-${pad(Number(m[2]))}`,
  },
  {
    kind: "date",
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    key: (m) => `${m[2]}-${m[3]}`,
  },
  {
    kind: "date",
    // Nigerian order: day/month(/year).
    re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g,
    key: (m) => (Number(m[2]) <= 12 && Number(m[1]) <= 31 ? `${pad(Number(m[2]))}-${pad(Number(m[1]))}` : null),
  },
];

/** Pulls every checkable fact out of a text. Overlapping matches are kept once (phones first). */
export function extractFacts(text: string): Fact[] {
  const facts: Fact[] = [];
  const taken: [number, number][] = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  for (const ex of EXTRACTORS) {
    ex.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ex.re.exec(text))) {
      const start = m.index;
      const end = start + m[0].length;
      if (overlaps(start, end)) continue;
      const key = ex.key(m);
      if (key === null) continue;
      taken.push([start, end]);
      facts.push({ kind: ex.kind, raw: m[0].trim(), key });
    }
  }
  return facts;
}

/**
 * The grounding source for one turn: tool results (any JSON) plus the user's messages. ISO timestamps in
 * tool results are expanded into the times and dates they represent in the user's time zone, so a tool
 * result `"scheduledFor": "2026-10-16T09:00:00+01:00"` grounds "9:00am" and "16 October".
 */
export class GroundingSources {
  private keys = new Map<FactKind, Set<string>>();

  constructor(private timeZone = "Africa/Lagos") {}

  add(value: unknown): this {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    for (const f of extractFacts(text)) this.put(f.kind, f.key);
    for (const iso of text.match(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})\b/g) ??
      []) {
      this.addInstant(new Date(iso));
    }
    // Kobo amounts in tool results ground the naira figure the model will say.
    for (const m of text.matchAll(/"[a-zA-Z_]*(?:kobo|Kobo)"\s*:\s*(\d+)/g))
      this.put("amount", amountKey(String(Number(m[1]) / 100)));
    // Bare numbers in tool results can ground amounts and percentages (e.g. {"fee": 25000}, {"confidence": 82}).
    for (const m of text.matchAll(/(?<![\w.])(\d+(?:\.\d+)?)(?![\w.])/g)) {
      this.put("amount", amountKey(m[1]));
      this.put("percent", String(Number(m[1])));
    }
    return this;
  }

  private addInstant(d: Date) {
    if (Number.isNaN(d.getTime())) return;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: this.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    this.put("time", `${parts.hour}:${parts.minute}`);
    this.put("date", `${parts.month}-${parts.day}`);
  }

  private put(kind: FactKind, key: string) {
    if (!this.keys.has(kind)) this.keys.set(kind, new Set());
    this.keys.get(kind)!.add(key);
  }

  has(f: Fact): boolean {
    if (f.kind === "phone") return false; // never in model text (R14)
    return this.keys.get(f.kind)?.has(f.key) ?? false;
  }
}

export function checkGrounding(text: string, sources: GroundingSources): GroundingResult {
  const violations = extractFacts(text).filter((f) => !sources.has(f));
  return violations.length ? { ok: false, violations } : { ok: true };
}

/**
 * Releases streamed text sentence by sentence (SPEC §7.2 step 9). A sentence ends at . ! ? or a newline
 * followed by whitespace, but not inside numbers ("9.30", "₦3,000.50") or common abbreviations.
 */
export class SentenceBuffer {
  private buf = "";

  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    let start = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const c = this.buf[i];
      const next = this.buf[i + 1];
      if (c === "\n" && next !== undefined) {
        out.push(this.buf.slice(start, i + 1));
        start = i + 1;
        continue;
      }
      if ((c === "." || c === "!" || c === "?") && next !== undefined && /\s/.test(next)) {
        const before = this.buf.slice(start, i);
        if (c === "." && /\b(e\.g|i\.e|etc|dr|mr|mrs|ms|no|st|vs|approx)$/i.test(before)) continue;
        out.push(this.buf.slice(start, i + 2));
        start = i + 2;
        i++;
      }
    }
    this.buf = this.buf.slice(start);
    return out.filter((s) => s.trim());
  }

  /** Whatever is left when the stream ends. */
  flush(): string | null {
    const rest = this.buf;
    this.buf = "";
    return rest.trim() ? rest : null;
  }
}

/** Shown in place of the rest of a reply when a sentence fails the check (SPEC §7.2 step 9). */
export const GROUNDING_FALLBACK_TEXT = "Details are in the cards below.";
