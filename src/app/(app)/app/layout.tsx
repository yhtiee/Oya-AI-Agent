import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { Suspense } from "react";
import { EmergencyButton } from "@/components/chat/EmergencyButton";
import { Sidebar } from "@/components/app/Sidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { listConversations } from "@/server/agent/history";
import { requireSession } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";

export const metadata: Metadata = { title: "Oya", robots: { index: false, follow: false } };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const session = await requireSession("/app");
  const conversations = await listConversations(getServiceClient(), session.userId);

  return (
    <NextIntlClientProvider>
      <div className="min-h-dvh bg-cream">
        <Suspense>
          <Sidebar conversations={conversations} displayName={session.displayName} isStaff={!!session.appRole} />
        </Suspense>
        <div className="lg:pl-[280px]">
          <header className="sticky top-0 z-10 flex h-16 items-center justify-end gap-2 bg-cream/90 px-4 backdrop-blur sm:px-6">
            <NotificationBell />
            <EmergencyButton />
          </header>
          <main className="px-4 sm:px-6">{children}</main>
        </div>
      </div>
    </NextIntlClientProvider>
  );
}
