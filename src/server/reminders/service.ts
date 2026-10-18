import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describeRepeat, formatWhen } from "@/lib/reminders/parse-time";
import type { ReminderCard } from "@/types/cards";

/* Reminders (SPEC §5.7). The time is parsed before confirmation and stored exactly as the user saw it. */

export type ReminderRow = {
  id: string;
  title: string;
  remind_at: string;
  rrule: string | null;
  status: "scheduled" | "sent" | "cancelled" | "failed";
};

export async function createReminder(
  client: SupabaseClient,
  userId: string,
  input: { title: string; remindAt: string; rrule: string | null; important?: boolean; taskId?: string | null },
): Promise<ReminderRow> {
  if (Date.parse(input.remindAt) <= Date.now() - 60_000) throw new Error("that time has already passed");
  const { data, error } = await client
    .from("reminders")
    .insert({
      user_id: userId,
      task_id: input.taskId ?? null,
      title: input.title.trim().slice(0, 140),
      remind_at: input.remindAt,
      rrule: input.rrule,
      important: input.important ?? false,
    })
    .select("id, title, remind_at, rrule, status")
    .single();
  if (error || !data) throw new Error(`create reminder failed: ${error?.message}`);
  return data as ReminderRow;
}

export async function cancelReminder(client: SupabaseClient, userId: string, reminderId: string): Promise<boolean> {
  const { data } = await client
    .from("reminders")
    .update({ status: "cancelled" })
    .eq("id", reminderId)
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .select("id");
  return Boolean(data?.length);
}

/** Snooze: the next occurrence moves `minutes` ahead (a sent one-off is rescheduled). */
export async function snoozeReminder(
  client: SupabaseClient,
  userId: string,
  reminderId: string,
  minutes = 60,
): Promise<boolean> {
  const { data } = await client
    .from("reminders")
    .update({ status: "scheduled", remind_at: new Date(Date.now() + minutes * 60_000).toISOString() })
    .eq("id", reminderId)
    .eq("user_id", userId)
    .in("status", ["scheduled", "sent"])
    .is("rrule", null)
    .select("id");
  return Boolean(data?.length);
}

export async function listReminders(client: SupabaseClient, userId: string): Promise<ReminderRow[]> {
  const { data } = await client
    .from("reminders")
    .select("id, title, remind_at, rrule, status")
    .eq("user_id", userId)
    .eq("status", "scheduled")
    .order("remind_at")
    .limit(20);
  return (data ?? []) as ReminderRow[];
}

export function buildReminderCard(r: ReminderRow): ReminderCard {
  return {
    type: "reminder",
    id: crypto.randomUUID(),
    reminderId: r.id,
    title: r.title,
    whenText: formatWhen(new Date(r.remind_at)),
    repeatText: describeRepeat(r.rrule),
    status: r.status,
  };
}
