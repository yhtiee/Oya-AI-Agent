/*
 * PII redaction before storage and before any LLM call (R14, SPEC §7.9, §15.4).
 * Phone numbers, emails, card numbers, NIN/BVN-like 11-digit numbers, OTP-like codes and coordinates are
 * replaced with placeholders. Returns what was found so the UI can warn ("Don't share your NIN here").
 */

export type RedactionKind = "phone" | "email" | "card" | "national_id" | "otp" | "coordinates" | "account";

export type Redaction = { text: string; found: RedactionKind[] };

type Rule = { kind: RedactionKind; re: RegExp; replace: string };

/** Luhn check, so random long numbers aren't all called card numbers. */
function luhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const RULES: Rule[] = [
  { kind: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, replace: "[email]" },
  // lat,lng pairs like 5.0377, 7.9128
  { kind: "coordinates", re: /-?\d{1,2}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, replace: "[location]" },
  // Card numbers: 13–19 digits, optionally grouped by spaces or dashes (Luhn-checked below).
  { kind: "card", re: /\b(?:\d[ -]?){12,18}\d\b/g, replace: "[card number]" },
  // Nigerian phones: +234 / 234 / 0 followed by 70x/80x/81x/90x/91x and 8 more digits, any spacing.
  {
    kind: "phone",
    re: /(?:\+?234[\s-]?|\b0)[789][01]\d(?:[\s-]?\d){7}\b/g,
    replace: "[phone]",
  },
  // Other international numbers with a leading +.
  { kind: "phone", re: /\+\d(?:[\s-]?\d){7,14}\b/g, replace: "[phone]" },
  // NIN and BVN are 11 digits.
  { kind: "national_id", re: /\b\d{11}\b/g, replace: "[ID number]" },
  // NUBAN bank account numbers are 10 digits.
  { kind: "account", re: /\b\d{10}\b/g, replace: "[account number]" },
  // OTP-like codes only when the word code/otp/pin is nearby.
  {
    kind: "otp",
    re: /\b(otp|code|pin|token)\b(\s*(is|na|:|=|-)?\s*)\d{4,8}\b/gi,
    replace: "$1$2[code]",
  },
];

export function redact(input: string): Redaction {
  const found = new Set<RedactionKind>();
  let text = input;
  for (const rule of RULES) {
    text = text.replace(rule.re, (match, ...groups) => {
      if (rule.kind === "card" && !luhn(match.replace(/\D/g, ""))) return match;
      found.add(rule.kind);
      if (rule.kind === "otp") return `${groups[0]}${groups[1]}[code]`;
      return rule.replace;
    });
  }
  return { text, found: [...found] };
}

/** True if the text asked for or contains something we must never collect (NIN, BVN, card, OTP, password). */
export function containsProtectedInfo(found: RedactionKind[]): boolean {
  return found.some((k) => k === "card" || k === "national_id" || k === "otp" || k === "account");
}
