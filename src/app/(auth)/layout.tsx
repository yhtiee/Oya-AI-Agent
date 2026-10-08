import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/auth/LanguageSwitch";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Compact chrome so the whole sign-up form fits on one screen, even on small phones.
export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common");
  return (
    <NextIntlClientProvider>
      <div className="flex min-h-dvh flex-col bg-cream px-4 py-3 sm:px-8 sm:py-6">
        <header className="mx-auto flex w-full max-w-[640px] items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Oya home"
            className="font-display text-[1.75rem] leading-none font-extrabold tracking-[-0.025em] text-orange"
          >
            oya
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Link
              href="/help/emergency"
              aria-label={t("emergencyLink")}
              title={t("emergencyLink")}
              className="flex min-h-11 items-center rounded-full bg-peach px-3 text-sm font-bold text-ember"
            >
              112
            </Link>
          </div>
        </header>
        <main className="mx-auto mt-4 w-full max-w-[640px] flex-1 sm:mt-8">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
