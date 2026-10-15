"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServiceClient } from "../db/service-client";
import { authedAction } from "./authed-action";

/*
 * Ops queue actions (SPEC §7.11, §14.11): take over a task (the agent pauses on it), hand it back, mark done.
 * Staff with two-factor only; every write is audited (internal.audit_log).
 */

const Item = z.object({ itemId: z.string().uuid() });

async function audit(actorId: string, action: string, itemId: string, diff: Record<string, unknown> = {}) {
  await getServiceClient().rpc("write_audit", {
    p_actor_id: actorId,
    p_action: action,
    p_entity: "ops_queue",
    p_entity_id: itemId,
    p_diff: diff,
  });
}

const takeOver = authedAction(
  Item,
  async ({ itemId }, { session }) => {
    const db = getServiceClient();
    const { data: item, error } = await db
      .from("ops_queue")
      .update({ status: "assigned", assigned_to: session.userId })
      .eq("id", itemId)
      .neq("status", "done")
      .select("id, task_id")
      .single();
    if (error || !item) throw new Error("item not found or already done");
    if (item.task_id) {
      await db.from("tasks").update({ agent_paused: true, assigned_ops_id: session.userId }).eq("id", item.task_id);
      await db.from("task_events").insert({
        task_id: item.task_id,
        type: "ops_note",
        visibility: "ops",
        actor_type: "ops",
        actor_id: session.userId,
        payload: { action: "take_over", item_id: itemId },
      });
    }
    await audit(session.userId, "ops.take_over", itemId, { task_id: item.task_id });
    return { ok: true };
  },
  { staff: true },
);

const handBack = authedAction(
  Item,
  async ({ itemId }, { session }) => {
    const db = getServiceClient();
    const { data: item, error } = await db
      .from("ops_queue")
      .update({ status: "done", resolved_at: new Date().toISOString() })
      .eq("id", itemId)
      .select("id, task_id")
      .single();
    if (error || !item) throw new Error("item not found");
    if (item.task_id) await db.from("tasks").update({ agent_paused: false }).eq("id", item.task_id);
    await audit(session.userId, "ops.hand_back", itemId, { task_id: item.task_id });
    return { ok: true };
  },
  { staff: true },
);

export async function takeOverItem(form: FormData) {
  await takeOver({ itemId: String(form.get("itemId")) });
  revalidatePath("/ops");
}

export async function handBackItem(form: FormData) {
  await handBack({ itemId: String(form.get("itemId")) });
  revalidatePath("/ops");
}
