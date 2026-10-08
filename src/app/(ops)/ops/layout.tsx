import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Ops", robots: { index: false, follow: false } };

// Staff only. Pages that need two-factor (everything except /ops/verify) also call requireStaff().
export default async function OpsLayout({ children }: LayoutProps<"/ops">) {
  const session = await requireSession("/ops");
  if (!session.appRole) redirect("/app");

  return (
    <NextIntlClientProvider>
      <div className="min-h-dvh bg-sand">
        <header className="bg-forest px-4 text-cream sm:px-8">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between">
            <Link href="/ops" className="font-display text-2xl font-extrabold tracking-[-0.025em] text-orange">
              oya <span className="text-base text-body-on-dark">ops</span>
            </Link>
            <p className="text-sm text-body-on-dark">
              {session.displayName} · {session.appRole} · {session.aal === "aal2" ? "2FA verified" : "2FA needed"}
            </p>
          </div>
        </header>
        <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
