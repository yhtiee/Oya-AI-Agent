import { describe, expect, it } from "vitest";
import { LOCALES } from "./config";
import en from "./en.json";
import pcm from "./pcm.json";

const catalogues: Record<(typeof LOCALES)[number], unknown> = { en, pcm };

function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("message catalogues", () => {
  it("has a catalogue for every locale", () => {
    for (const locale of LOCALES) expect(catalogues[locale], locale).toBeDefined();
  });

  it("every locale has exactly the English keys", () => {
    const reference = keys(en).sort();
    for (const locale of LOCALES) expect(keys(catalogues[locale]).sort(), locale).toEqual(reference);
  });

  it("has no empty strings", () => {
    for (const locale of LOCALES) {
      for (const key of keys(catalogues[locale])) {
        const value = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], catalogues[locale]);
        expect(String(value).trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });
});
