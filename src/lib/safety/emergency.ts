import phrases from "../../../config/emergency-phrases.json";

/*
 * Emergency and self-harm keyword pre-filter (SPEC §7.2 step 2a, §14.8). Pure and dependency-free, so the
 * browser can run it on every keystroke, offline, and the server runs exactly the same check.
 * A match is a hint to show help immediately, never a diagnosis; the router's safety label still runs.
 */

export type EmergencyCategory = keyof typeof phrases.emergency;

export type EmergencyMatch =
  { kind: "emergency"; category: EmergencyCategory; phrase: string } | { kind: "self_harm"; phrase: string } | null;

/** Lower case, curly quotes straightened, punctuation removed, runs of 3+ letters collapsed ("pleeease"). */
export function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/([a-z])\1{2,}/g, "$1$1")
    .replace(/\s+/g, " ")
    .trim()} `;
}

const prepared = (list: string[]) => list.map((p) => ({ phrase: p, needle: normalise(p) }));

const SELF_HARM = prepared(phrases.self_harm);
const EMERGENCY = (Object.entries(phrases.emergency) as [EmergencyCategory, string[]][]).flatMap(([category, list]) =>
  prepared(list).map((p) => ({ ...p, category })),
);
// Longer phrases first, so "armed robbery" wins over "armed" and the reported phrase is the most specific.
EMERGENCY.sort((a, b) => b.needle.length - a.needle.length);
const NOT_EMERGENCY = prepared(phrases.not_emergency);
const NOT_URGENT = prepared(phrases.not_urgent_context);

/**
 * Checks a message. Self-harm wins over emergency (it needs the supportive flow, not just numbers).
 * Benign phrases ("fire extinguisher", "crash course") are removed before matching, and emergency (never
 * self-harm) matches are dropped when the message is clearly about a past event or paperwork.
 */
export function matchEmergency(text: string): EmergencyMatch {
  if (!text.trim()) return null;
  let haystack = normalise(text);
  for (const { needle } of NOT_EMERGENCY) haystack = haystack.split(needle).join(" ");

  for (const { phrase, needle } of SELF_HARM) if (haystack.includes(needle)) return { kind: "self_harm", phrase };
  // A past event or an admin question ("report a car accident to my insurance") isn't an emergency now.
  if (NOT_URGENT.some(({ needle }) => haystack.includes(needle))) return null;
  for (const { phrase, needle, category } of EMERGENCY) {
    if (haystack.includes(needle)) return { kind: "emergency", category, phrase };
  }
  return null;
}
