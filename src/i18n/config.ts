/** Languages with a message catalogue (SPEC §14.9). `ibb`, `yo`, `ig` and `ha` come later. */
export const LOCALES = ["en", "pcm"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie that remembers the reader's language until it's stored on their profile (M1). */
export const LOCALE_COOKIE = "oya_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tags for `<html lang>` and `Intl` formatting. */
export const HTML_LANG: Record<Locale, string> = { en: "en-NG", pcm: "pcm" };
