import "server-only";
import { getServiceClient } from "./db/service-client";

/** Appends to internal.audit_log (SPEC §12.2). Never put message text or secrets in `diff`. */
export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getServiceClient().rpc("write_audit", {
    p_actor_id: entry.actorId,
    p_action: entry.action,
    p_entity: entry.entity,
    p_entity_id: entry.entityId ?? null,
    p_diff: entry.diff ?? {},
  });
  if (error)
    console.error(
      JSON.stringify({ level: "error", msg: "audit write failed", action: entry.action, error: error.message }),
    );
}
