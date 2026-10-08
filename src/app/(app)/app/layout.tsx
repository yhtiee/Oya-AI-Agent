import type { Metadata } from "next";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { signOut } from "@/server/actions/auth";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Oya", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession("/app");
  const t = await getTranslations("app");
  const tc = await getTranslations("common");

  return (
    <NextIntlClientProvider>
      <div className="min-h-dvh bg-cream">
        <header className="border-b border-hairline bg-paper px-4 sm:px-8">
          <nav aria-label="Account" className="mx-auto flex h-16 max-w-[960px] items-center justify-between gap-4">
            <Link href="/app" className="font-display text-3xl font-extrabold tracking-[-0.025em] text-orange">
              oya
            </Link>
            <div className="flex items-center gap-1 sm:gap-3">
              <Link href="/help/emergency" className="hidden px-2 text-sm font-bold text-ember sm:inline">
                {tc("emergencyLink")}
              </Link>
              {session.appRole && (
                <Link href="/ops" className="px-2 py-2 text-sm font-bold text-forest">
                  {t("ops")}
                </Link>
              )}
              <Link href="/app/settings" className="px-2 py-2 text-sm font-bold text-forest">
                {t("settings")}
              </Link>
              <form action={signOut}>
                <Button variant="secondary" size="sm" type="submit">
                  {t("signOut")}
                </Button>
              </form>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-[960px] px-4 py-10 sm:px-8">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
