/*
 * Notification texts (SPEC §5.6, §5.7). Rendered on the server from structured payloads; no model writes these.
 * Pidgin is a draft (D-008). Push titles stay short: lock screens cut them off.
 */

import type { Lang } from "../agent/templates";

export const TEMPLATE_KEYS = ["reminder_due", "power_on", "power_off", "alerts_digest"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type Rendered = { title: string; body: string; url: string };

type Payload = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);

const RENDER: Record<TemplateKey, (p: Payload, lang: Lang) => Rendered> = {
  reminder_due: (p, lang) => ({
    title: lang === "pcm" ? "Reminder" : "Reminder",
    body: str(p.title, lang === "pcm" ? "Your reminder" : "Your reminder"),
    url: "/app",
  }),
  power_on: (p, lang) => ({
    title: lang === "pcm" ? "Light don come" : "Power is back",
    body:
      lang === "pcm"
        ? `Neighbours for ${str(p.area_name, "your area")} talk say light don come.`
        : `Neighbours in ${str(p.area_name, "your area")} report power is back on.`,
    url: "/app",
  }),
  power_off: (p, lang) => ({
    title: lang === "pcm" ? "Light don go" : "Power is off",
    body:
      lang === "pcm"
        ? `Neighbours for ${str(p.area_name, "your area")} talk say light don go.`
        : `Neighbours in ${str(p.area_name, "your area")} report power went off.`,
    url: "/app",
  }),
  alerts_digest: (p, lang) => {
    const n = typeof p.count === "number" ? p.count : 1;
    return {
      title: lang === "pcm" ? "Alert for your area today" : "Alerts for your area today",
      body:
        n === 1
          ? str(p.first_title, lang === "pcm" ? "One alert don post." : "One alert posted.")
          : lang === "pcm"
            ? `${n} alerts don post. First one: ${str(p.first_title)}`
            : `${n} alerts posted. First: ${str(p.first_title)}`,
      url: "/app",
    };
  },
};

export function renderNotification(key: TemplateKey, payload: Payload, lang: Lang): Rendered {
  return RENDER[key](payload, lang);
}
