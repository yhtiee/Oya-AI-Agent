"use server";

import { z } from "zod";
import type { Card } from "@/types/cards";
import { getServiceClient } from "../db/service-client";
import { isEnabled } from "../flags";
import { buildPowerCard, createPowerWatch, getPowerStatus, reportPower, setPowerCluster } from "../power/service";
import { cancelReminder, snoozeReminder } from "../reminders/service";
import { ActionError, authedAction } from "./authed-action";

/*
 * Card taps (SPEC §5.1, §5.7, §20.1 "tap first, AI second"). No model call. A tap is the user's own action, so
 * reports and "Alert me" don't need a separate confirmation; every write is checked against the session's user.
 */

type TapResult = { text: string; cards: Card[] };

const lang = (l: string) => (l === "pcm" ? "pcm" : "en") as "en" | "pcm";

async function requireFlag(key: "skill_power" | "watches" | "reminders", userId: string) {
  if (!(await isEnabled(key, { userId }))) throw new ActionError("That isn't switched on yet.");
}

export const reportPowerTap = authedAction(
  z.object({ areaId: z.string().uuid(), status: z.enum(["on", "off"]) }),
  async ({ areaId, status }, { session }): Promise<TapResult> => {
    await requireFlag("skill_power", session.userId);
    const client = getServiceClient();
    const l = lang(session.language);
    const r = await reportPower(client, session.userId, status, areaId);
    const text =
      r.result === "recorded"
        ? l === "pcm"
          ? "I don record am. Thank you, e dey help your neighbours."
          : "Recorded. Thanks, it helps your neighbours."
        : r.result === "too_soon"
          ? l === "pcm"
            ? "You don report in the last 10 minutes. Try again small time."
            : "You reported in the last 10 minutes. Try again a bit later."
          : r.result === "rate_limited"
            ? l === "pcm"
              ? "Na plenty reports be that. Rest small."
              : "That's a lot of reports. Take a break."
            : l === "pcm"
              ? "Pick your area first."
              : "Pick your area first.";
    const s = await getPowerStatus(client, session.userId, areaId);
    return { text, cards: s.needsCluster ? [] : [buildPowerCard(s, l)] };
  },
);

export const watchPowerTap = authedAction(
  z.object({ areaId: z.string().uuid(), type: z.enum(["power_on", "power_off"]) }),
  async ({ areaId, type }, { session }): Promise<TapResult> => {
    await requireFlag("watches", session.userId);
    const l = lang(session.language);
    try {
      const w = await createPowerWatch(getServiceClient(), session.userId, type, areaId);
      const on = type === "power_on";
      const text = w.created
        ? l === "pcm"
          ? on
            ? "I go tell you when light come back."
            : "I go tell you when light go."
          : on
            ? "I'll tell you when power comes back."
            : "I'll tell you when power goes off."
        : l === "pcm"
          ? "You don already set this alert."
          : "That alert is already on.";
      return { text, cards: [] };
    } catch (e) {
      throw new ActionError(e instanceof Error ? e.message : "Couldn't set the alert.");
    }
  },
);

export const pickClusterTap = authedAction(
  z.object({ areaId: z.string().uuid() }),
  async ({ areaId }, { session }): Promise<TapResult> => {
    await requireFlag("skill_power", session.userId);
    const client = getServiceClient();
    const l = lang(session.language);
    const area = await setPowerCluster(client, session.userId, areaId).catch(() => {
      throw new ActionError("That area isn't available.");
    });
    const s = await getPowerStatus(client, session.userId, area.id);
    return {
      text: l === "pcm" ? `I don save ${area.name} as your area.` : `Saved ${area.name} as your area.`,
      cards: s.needsCluster ? [] : [buildPowerCard(s, l)],
    };
  },
);

export const cancelReminderTap = authedAction(
  z.object({ reminderId: z.string().uuid() }),
  async ({ reminderId }, { session }): Promise<TapResult> => {
    const ok = await cancelReminder(getServiceClient(), session.userId, reminderId);
    const l = lang(session.language);
    return {
      text: ok
        ? l === "pcm"
          ? "I don cancel the reminder."
          : "Reminder cancelled."
        : l === "pcm"
          ? "That reminder no dey active again."
          : "That reminder isn't active any more.",
      cards: [],
    };
  },
);

export const snoozeReminderTap = authedAction(
  z.object({
    reminderId: z.string().uuid(),
    minutes: z
      .number()
      .int()
      .min(5)
      .max(24 * 60)
      .default(60),
  }),
  async ({ reminderId, minutes }, { session }): Promise<TapResult> => {
    await requireFlag("reminders", session.userId);
    const ok = await snoozeReminder(getServiceClient(), session.userId, reminderId, minutes);
    return { text: ok ? "Snoozed." : "Repeating reminders can't be snoozed; the next one is already set.", cards: [] };
  },
);
