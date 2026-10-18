import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isEnabled } from "../flags";
import { enqueueJob } from "../jobs/enqueue";
import type { Lang } from "../agent/templates";
import { sendPush, sendSms, sendWhatsApp } from "./channels";
import { renderNotification, type TemplateKey } from "./templates";

/*
 * Notifications (SPEC §5.7 delivery order, §10.5). One `notifications` row per channel, each with an idempotency
 * key, each sent by a `send_outbound` job, so retries never double-send.
 *  - push: always. It is also the in-app inbox entry (the bell), so the user sees it even if push never arrives.
 *  - whatsapp: important messages, only with the gated whatsapp_user_notifications flag and an opted-in phone.
 *  - sms: important messages for users with a phone, at most 3 a day (SPEC §10.5).
 */

export type NotifyInput = {
  userId: string;
  templateKey: TemplateKey;
  payload: Record<string, unknown>;
  /** Reminders marked important and booking messages (SPEC §5.7). */
  important?: boolean;
  /** Stable per logical message, e.g. `reminder:{id}:{epoch}`. */
  idempotencyKey: string;
};

const SMS_PER_DAY = 3;

async function createRow(
  client: SupabaseClient,
  input: NotifyInput,
  channel: "push" | "sms" | "whatsapp",
): Promise<string | null> {
  const { data, error } = await client
    .from("notifications")
    .insert({
      user_id: input.userId,
      channel,
      template_key: input.templateKey,
      payload: input.payload,
      idempotency_key: channel === "push" ? input.idempotencyKey : `${input.idempotencyKey}:${channel}`,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null; // already created by an earlier attempt
  if (error || !data) throw new Error(`create notification failed: ${error?.message}`);
  await enqueueJob("send_outbound", { notification_id: data.id }, { dedupeKey: `notify:${data.id}`, client });
  return data.id as string;
}

/** Creates the notification rows for a message and queues them. Returns the ids created (empty on a repeat). */
export async function notifyUser(client: SupabaseClient, input: NotifyInput): Promise<string[]> {
  const ids: string[] = [];
  const push = await createRow(client, input, "push");
  if (push) ids.push(push);
  if (!input.important) return ids;

  const { data: profile } = await client.from("profiles").select("phone_e164").eq("id", input.userId).single();
  if (!profile?.phone_e164) return ids;

  if (await isEnabled("whatsapp_user_notifications", { userId: input.userId })) {
    const wa = await createRow(client, input, "whatsapp");
    if (wa) ids.push(wa);
  } else {
    const sms = await createRow(client, input, "sms");
    if (sms) ids.push(sms);
  }
  return ids;
}

/** Sends one queued notification (the send_outbound job). Safe to repeat: only `queued` rows are sent. */
export async function deliverNotification(
  client: SupabaseClient,
  notificationId: string,
): Promise<"sent" | "failed" | "skipped"> {
  const { data: n } = await client
    .from("notifications")
    .select("id, user_id, channel, template_key, payload, status")
    .eq("id", notificationId)
    .single();
  if (!n || n.status !== "queued" || !n.user_id) return "skipped";

  const { data: profile } = await client.from("profiles").select("language, phone_e164").eq("id", n.user_id).single();
  const lang: Lang = profile?.language === "pcm" ? "pcm" : "en";
  const message = renderNotification(n.template_key as TemplateKey, n.payload as Record<string, unknown>, lang);

  let result;
  if (n.channel === "push") {
    result = await sendPush(client, n.user_id, { ...message, tag: n.template_key });
  } else if (n.channel === "sms") {
    const { data: allowed } = await client.rpc("hit_rate_limit", {
      p_key: `sms:user:${n.user_id}`,
      p_window_seconds: 86_400,
      p_max: SMS_PER_DAY,
    });
    if (allowed === false || !profile?.phone_e164) result = { ok: false, error: "sms cap reached or no phone" };
    else result = await sendSms(profile.phone_e164, `Oya: ${message.title}. ${message.body}`);
  } else if (n.channel === "whatsapp") {
    result = profile?.phone_e164
      ? await sendWhatsApp(profile.phone_e164, n.template_key)
      : { ok: false, error: "no phone" };
  } else {
    result = { ok: false, error: `unsupported channel ${n.channel}` };
  }

  await client
    .from("notifications")
    .update({
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      external_id: result.externalId ?? null,
      error: result.ok ? null : (result.error ?? "failed").slice(0, 1000),
      payload: { ...(n.payload as object), ...(result.detail ? { delivery: result.detail } : {}) },
    })
    .eq("id", n.id)
    .eq("status", "queued");
  return result.ok ? "sent" : "failed";
}
