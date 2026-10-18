import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getEnv } from "../env";
import type { Rendered } from "./templates";

/*
 * Delivery channels (SPEC §10.5, §14.8). Web push is live (VAPID). SMS (Termii) and WhatsApp run in mock mode
 * until the CAC registration, sender ID and approved templates exist (INTEGRATIONS_MODE=mock, D-025).
 */

export type SendResult = { ok: boolean; externalId?: string; error?: string; detail?: Record<string, unknown> };

let vapidReady: boolean | undefined;

function ensureVapid(): boolean {
  if (vapidReady !== undefined) return vapidReady;
  const env = getEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return (vapidReady = false);
  const subject = env.VAPID_SUBJECT ?? env.NEXT_PUBLIC_SITE_URL ?? "https://oya-ai-agent.vercel.app";
  webpush.setVapidDetails(subject, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  return (vapidReady = true);
}

/** Sends to every push subscription the user has; removes subscriptions the browser says are gone. */
export async function sendPush(
  client: SupabaseClient,
  userId: string,
  message: Rendered & { tag?: string },
): Promise<SendResult> {
  if (!ensureVapid()) return { ok: false, error: "web push is not configured" };
  const { data: subs } = await client
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs?.length) return { ok: true, detail: { targets: 0 } };

  let delivered = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(message),
        { TTL: 6 * 3600, urgency: "normal", timeout: 8000 },
      );
      delivered++;
      await client.from("push_subscriptions").update({ last_ok_at: new Date().toISOString() }).eq("id", s.id);
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await client.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return delivered > 0
    ? { ok: true, detail: { targets: subs.length, delivered } }
    : { ok: false, error: "no subscription accepted the push", detail: { targets: subs.length } };
}

/** Termii transactional SMS (SPEC §10.5). Mock mode records what would have been sent. */
export async function sendSms(phoneE164: string, text: string): Promise<SendResult> {
  const env = getEnv();
  if (env.INTEGRATIONS_MODE !== "live" || !env.TERMII_API_KEY || !env.TERMII_SENDER_ID) {
    return { ok: true, externalId: `mock-sms-${crypto.randomUUID()}`, detail: { mock: true, chars: text.length } };
  }
  const res = await fetch("https://api.ng.termii.com/api/sms/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to: phoneE164.replace(/^\+/, ""),
      from: env.TERMII_SENDER_ID,
      sms: text.slice(0, 300),
      type: "plain",
      channel: env.TERMII_CHANNEL ?? "dnd",
      api_key: env.TERMII_API_KEY,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const body = (await res.json().catch(() => ({}))) as { message_id?: string; message?: string };
  return res.ok
    ? { ok: true, externalId: body.message_id }
    : { ok: false, error: body.message ?? `termii ${res.status}` };
}

/** WhatsApp notification templates (SPEC §4.3a). Behind the gated whatsapp_user_notifications flag; mock only. */
export async function sendWhatsApp(_phoneE164: string, templateKey: string): Promise<SendResult> {
  return { ok: true, externalId: `mock-wa-${crypto.randomUUID()}`, detail: { mock: true, template: templateKey } };
}
