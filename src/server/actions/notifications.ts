"use server";

import { z } from "zod";
import { renderNotification, type TemplateKey } from "../notifications/templates";
import { getServiceClient } from "../db/service-client";
import { getEnv } from "../env";
import { authedAction } from "./authed-action";

/*
 * The in-app inbox (the bell) and web push subscriptions (SPEC §14.8). The inbox lists the user's push-channel
 * notifications, which are created for every message whether or not push is delivered.
 */

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  read: boolean;
  reminderId: string | null;
};

export const listInbox = authedAction(z.object({}), async (_input, { session }) => {
  const { data } = await getServiceClient()
    .from("notifications")
    .select("id, template_key, payload, created_at, read_at")
    .eq("user_id", session.userId)
    .eq("channel", "push")
    .order("created_at", { ascending: false })
    .limit(30);
  const lang = session.language === "pcm" ? "pcm" : "en";
  const items: InboxItem[] = (data ?? []).map((n) => {
    const r = renderNotification(n.template_key as TemplateKey, (n.payload ?? {}) as Record<string, unknown>, lang);
    const payload = (n.payload ?? {}) as Record<string, unknown>;
    return {
      id: n.id,
      title: r.title,
      body: r.body,
      url: r.url,
      createdAt: n.created_at,
      read: n.read_at !== null,
      reminderId: typeof payload.reminder_id === "string" ? payload.reminder_id : null,
    };
  });
  return { items, unread: items.filter((i) => !i.read).length };
});

export const markInboxRead = authedAction(
  z.object({ ids: z.array(z.string().uuid()).max(50) }),
  async ({ ids }, { session }) => {
    if (!ids.length) return { updated: 0 };
    const { data } = await getServiceClient()
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .eq("user_id", session.userId)
      .is("read_at", null)
      .select("id");
    return { updated: data?.length ?? 0 };
  },
);

const Subscription = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** The VAPID public key the browser needs to subscribe. Safe to expose. */
export const pushPublicKey = authedAction(z.object({}), async () => ({ key: getEnv().VAPID_PUBLIC_KEY ?? null }));

export const savePushSubscription = authedAction(
  z.object({ subscription: Subscription, userAgent: z.string().max(400).optional() }),
  async ({ subscription, userAgent }, { session }) => {
    const client = getServiceClient();
    // An endpoint belongs to one browser; if it moved to this user (shared device), take it over.
    const { error } = await client.from("push_subscriptions").upsert(
      {
        user_id: session.userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  },
);

export const removePushSubscription = authedAction(
  z.object({ endpoint: z.string().url() }),
  async ({ endpoint }, { session }) => {
    await getServiceClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", session.userId);
    return { removed: true };
  },
);
