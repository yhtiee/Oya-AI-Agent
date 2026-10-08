import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "./config";

/*
 * No locale in the URL: Oya's links are shared on WhatsApp, so they should look the same in every
 * language. The locale comes from an explicit argument, then the cookie, then the default.
 * From M1 the signed-in user's `profiles.language` takes over.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  let locale = isLocale(explicit) ? explicit : undefined;
  if (!locale) {
    const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  }

  return {
    locale,
    timeZone: "Africa/Lagos",
    messages: (await import(`./${locale}.json`)).default,
  };
});
