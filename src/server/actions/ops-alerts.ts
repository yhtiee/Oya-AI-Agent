"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "../audit";
import { getServiceClient } from "../db/service-client";
import { ActionError, authedFormAction } from "./authed-action";

/*
 * Local alerts editor (SPEC §5.6, §14.11). Ops-only with two-factor; every alert needs an official source URL and
 * is recorded as verified by the ops person who posts it. Never AI-written.
 */

const lagosLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use the date and time picker.")
  .transform((v) => new Date(`${v}:00+01:00`).toISOString());

const AlertInput = z
  .object({
    id: z
      .string()
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    title: z.string().trim().min(1, "Add a title.").max(140, "Use 140 characters or fewer."),
    body: z.string().trim().min(1, "Say what's happening.").max(2000),
    severity: z.enum(["info", "warning", "severe"]),
    areaIds: z
      .string()
      .transform((v) =>
        v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().uuid()).min(1, "Pick at least one area.").max(200)),
    sourceUrl: z
      .string()
      .trim()
      .url("Paste the official source link.")
      .startsWith("http", "Paste the official source link."),
    startsAt: lagosLocal,
    endsAt: z
      .string()
      .optional()
      .transform((v, ctx) => {
        if (!v) return null;
        const r = lagosLocal.safeParse(v);
        if (!r.success) {
          ctx.addIssue({ code: "custom", message: "Use the date and time picker." });
          return z.NEVER;
        }
        return r.data;
      }),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.startsAt, { message: "The end must be after the start.", path: ["endsAt"] });

export const saveLocalAlert = authedFormAction(
  AlertInput,
  async (input, { session }) => {
    const client = getServiceClient();
    const row = {
      title: input.title,
      body: input.body,
      severity: input.severity,
      area_ids: input.areaIds,
      source_url: input.sourceUrl,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      verified_by: session.userId,
    };
    const { data, error } = input.id
      ? await client.from("local_alerts").update(row).eq("id", input.id).select("id").single()
      : await client.from("local_alerts").insert(row).select("id").single();
    if (error || !data) throw new ActionError("Couldn't save the alert. Check the fields and try again.");
    await audit({
      actorId: session.userId,
      action: input.id ? "local_alert_updated" : "local_alert_created",
      entity: "local_alert",
      entityId: data.id,
      diff: { title: input.title, severity: input.severity, areas: input.areaIds.length },
    });
    revalidatePath("/ops/alerts");
    return { id: data.id as string };
  },
  { staff: true },
);

export const endLocalAlert = authedFormAction(
  z.object({ id: z.string().uuid() }),
  async ({ id }, { session }) => {
    const { error } = await getServiceClient()
      .from("local_alerts")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new ActionError("Couldn't end the alert.");
    await audit({ actorId: session.userId, action: "local_alert_ended", entity: "local_alert", entityId: id });
    revalidatePath("/ops/alerts");
    return { id };
  },
  { staff: true },
);
