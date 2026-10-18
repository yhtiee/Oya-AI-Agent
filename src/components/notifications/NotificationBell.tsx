"use client";

import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { listInbox, markInboxRead, type InboxItem } from "@/server/actions/notifications";
import { snoozeReminderTap } from "@/server/actions/power";
import { enablePush, pushState, type PushState } from "./push";

/*
 * The in-app inbox (SPEC §5.7, D-026): every notification also lands here, because web push alone is unreliable on
 * popular Android phones. Polls once a minute while the page is open.
 */
export function NotificationBell() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [push, setPush] = useState<PushState>("unsupported");
  const [note, setNote] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      listInbox({}).then((r) => {
        if (alive && r.status === "ok") {
          setItems(r.data.items);
          setUnread(r.data.unread);
        }
      });
    void load();
    void pushState().then((s) => alive && setPush(s));
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const ids = items.filter((i) => !i.read).map((i) => i.id);
      if (ids.length) {
        await markInboxRead({ ids });
        setUnread(0);
      }
    }
  }

  return (
    <div className="relative" ref={panel}>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-label={unread ? t("labelUnread", { n: unread }) : t("label")}
        aria-expanded={open}
        data-inbox-button
        className="relative grid size-11 place-items-center rounded-full text-forest hover:bg-sand"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 grid min-w-5 place-items-center rounded-full bg-ember px-1 text-[0.6875rem] font-bold text-paper">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(92vw,360px)] overflow-hidden rounded-[22px] border border-hairline bg-paper shadow-[0_18px_40px_-16px_rgba(16,36,27,0.35)]">
          <p className="border-b border-hairline px-4 py-3 font-bold text-forest">{t("title")}</p>
          {push !== "on" && push !== "unsupported" && (
            <div className="border-b border-hairline bg-mint/60 px-4 py-3 text-[0.9375rem] text-forest">
              {push === "denied" ? (
                <p className="flex items-center gap-2">
                  <BellOff size={16} aria-hidden="true" /> {t("pushBlocked")}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    const s = await enablePush();
                    setPush(s);
                    setNote(s === "on" ? t("pushOn") : null);
                  }}
                  className="font-bold text-deep-leaf underline underline-offset-4"
                >
                  {t("enablePush")}
                </button>
              )}
            </div>
          )}
          {note && <p className="border-b border-hairline px-4 py-2 text-sm text-deep-leaf">{note}</p>}
          {items.length === 0 ? (
            <p className="px-4 py-6 text-[0.9375rem] text-body">{t("empty")}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto">
              {items.map((i) => (
                <li
                  key={i.id}
                  className={cn("border-b border-hairline px-4 py-3 last:border-0", !i.read && "bg-cream")}
                >
                  <p className="font-bold text-forest">{i.title}</p>
                  <p className="text-[0.9375rem] text-body">{i.body}</p>
                  <div className="mt-1 flex items-center gap-3 text-[0.8125rem] text-muted">
                    <span>
                      {new Date(i.createdAt).toLocaleString("en-GB", {
                        timeZone: "Africa/Lagos",
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        hour12: true,
                        minute: "2-digit",
                      })}
                    </span>
                    {i.reminderId && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await snoozeReminderTap({ reminderId: i.reminderId!, minutes: 60 });
                          setNote(r.status === "ok" ? r.data.text : r.status === "error" ? r.error : null);
                        }}
                        className="font-bold text-deep-leaf"
                      >
                        {t("snooze")}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
