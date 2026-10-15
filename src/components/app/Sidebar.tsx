"use client";

import {
  CalendarClock,
  CheckCircle2,
  CircleDot,
  LogOut,
  MapPin,
  Menu,
  PenSquare,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/server/actions/auth";

/*
 * App sidebar (SPEC §14.2): New request, the task sections, recent conversations, account. 280 px on desktop; a
 * drawer on mobile. Task sections fill in as skills create tasks (M4+).
 */

export type SidebarConversation = { id: string; title: string; lastAt: string };

function groupLabel(iso: string, now: Date, t: (k: string) => string): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return t("today");
  if (diff === 1) return t("yesterday");
  if (diff < 7) return t("thisWeek");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function NavItem({
  href,
  icon,
  children,
  active,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-10 items-center gap-3 rounded-[12px] px-3 text-[0.9375rem] text-cream/90 transition-colors hover:bg-forest-line",
        active && "bg-forest-line text-cream",
      )}
    >
      <span className="text-body-on-dark">{icon}</span>
      {children}
    </Link>
  );
}

export function Sidebar({
  conversations,
  displayName,
  isStaff,
}: {
  conversations: SidebarConversation[];
  displayName: string;
  isStaff: boolean;
}) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const current = params.get("c");

  const now = new Date();
  const groups: { label: string; items: SidebarConversation[] }[] = [];
  for (const c of conversations) {
    const label = groupLabel(c.lastAt, now, t);
    const g = groups.at(-1);
    if (g?.label === label) g.items.push(c);
    else groups.push({ label, items: [c] });
  }

  const panel = (
    // Any link tap closes the mobile drawer.
    <div
      className="flex h-full flex-col bg-forest text-cream"
      onClickCapture={(e) => {
        if ((e.target as HTMLElement).closest("a")) setOpen(false);
      }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/app?new=1" className="font-display text-3xl font-extrabold tracking-[-0.025em] text-orange">
          oya
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t("close")}
          className="grid size-10 place-items-center rounded-full text-body-on-dark lg:hidden"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label={t("label")} className="space-y-0.5 px-3">
        <Link
          href="/app?new=1"
          className="mb-2 flex min-h-11 items-center gap-3 rounded-[14px] bg-orange px-3 font-bold text-forest hover:bg-orange-soft"
        >
          <PenSquare size={18} aria-hidden="true" />
          {t("newRequest")}
        </Link>
        <NavItem href="/app?new=1" icon={<CircleDot size={18} />}>
          {t("active")}
        </NavItem>
        <NavItem href="/app?new=1" icon={<CalendarClock size={18} />}>
          {t("scheduled")}
        </NavItem>
        <NavItem href="/app?new=1" icon={<CheckCircle2 size={18} />}>
          {t("done")}
        </NavItem>
        <NavItem href="/app/settings" icon={<MapPin size={18} />}>
          {t("savedPlaces")}
        </NavItem>
        {isStaff && (
          <NavItem href="/ops" icon={<ShieldCheck size={18} />}>
            {t("ops")}
          </NavItem>
        )}
      </nav>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {groups.length === 0 ? (
          <p className="px-3 text-sm text-body-on-dark">{t("noConversations")}</p>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-4">
              <h2 className="px-3 pb-1 text-xs font-bold tracking-wide text-body-on-dark/80 uppercase">{g.label}</h2>
              <ul>
                {g.items.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/app?c=${c.id}`}
                      aria-current={pathname === "/app" && current === c.id ? "page" : undefined}
                      className={cn(
                        "block truncate rounded-[10px] px-3 py-2 text-[0.9375rem] text-cream/85 hover:bg-forest-line hover:text-cream",
                        pathname === "/app" && current === c.id && "bg-forest-line text-cream",
                      )}
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-forest-line px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-leaf font-bold text-forest">
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-bold">{displayName}</span>
        <Link
          href="/app/settings"
          aria-label={t("settings")}
          className="grid size-10 place-items-center rounded-full text-body-on-dark hover:bg-forest-line hover:text-cream"
        >
          <Settings size={19} aria-hidden="true" />
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            aria-label={t("signOut")}
            className="grid size-10 place-items-center rounded-full text-body-on-dark hover:bg-forest-line hover:text-cream"
          >
            <LogOut size={19} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        className="fixed top-3 left-3 z-30 grid size-10 place-items-center rounded-full bg-paper text-forest shadow-[0_1px_0_rgba(16,36,27,0.1)] lg:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[280px] lg:block">{panel}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t("close")}
            className="absolute inset-0 bg-forest/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[min(86vw,300px)] shadow-xl">{panel}</aside>
        </div>
      )}
    </>
  );
}
