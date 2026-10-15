import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { handBackItem, takeOverItem } from "@/server/actions/ops";
import { requireStaff } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";

/*
 * Minimal ops queue (SPEC M3, §14.11): open items by priority, filter by reason and priority, take over, hand back.
 * Self-harm items show only that a safety event happened, never the text (§7.9).
 */

const REASONS = [
  "safety",
  "concierge_request",
  "no_supply",
  "provider_timeout",
  "user_dispute",
  "kb_gap",
  "low_confidence_transcript",
  "budget_exceeded",
  "tool_failure",
  "verification",
  "invite_candidate",
] as const;

type Item = {
  id: string;
  reason: string;
  priority: number;
  status: string;
  task_id: string | null;
  note: string | null;
  created_at: string;
  assigned_to: string | null;
  meta: Record<string, unknown>;
};

export default async function OpsQueue({ searchParams }: PageProps<"/ops">) {
  const session = await requireStaff("/ops");
  const t = await getTranslations("ops");
  const params = await searchParams;
  const reason =
    typeof params.reason === "string" && (REASONS as readonly string[]).includes(params.reason) ? params.reason : null;
  const priority =
    typeof params.priority === "string" && ["1", "2", "3"].includes(params.priority) ? Number(params.priority) : null;

  let query = getServiceClient()
    .from("ops_queue")
    .select("id, reason, priority, status, task_id, note, created_at, assigned_to, meta")
    .neq("status", "done")
    .order("priority")
    .order("created_at")
    .limit(100);
  if (reason) query = query.eq("reason", reason);
  if (priority) query = query.eq("priority", priority);
  const { data } = await query;
  const items = (data ?? []) as Item[];

  const taskIds = items.map((i) => i.task_id).filter(Boolean) as string[];
  const { data: tasks } = taskIds.length
    ? await getServiceClient().from("tasks").select("id, title, status, skill_id, agent_paused").in("id", taskIds)
    : { data: [] as { id: string; title: string; status: string; skill_id: string; agent_paused: boolean }[] };
  const taskOf = (id: string | null) => tasks?.find((x) => x.id === id);

  const filterHref = (next: { reason?: string | null; priority?: number | null }) => {
    const q = new URLSearchParams();
    const r = next.reason === undefined ? reason : next.reason;
    const p = next.priority === undefined ? priority : next.priority;
    if (r) q.set("reason", r);
    if (p) q.set("priority", String(p));
    const s = q.toString();
    return s ? `/ops?${s}` : "/ops";
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-h1 text-forest">{t("queueTitle")}</h1>
          <p className="mt-2 text-body">{t("queueLead", { count: items.length })}</p>
        </div>
      </div>

      <nav aria-label={t("filters")} className="mt-6 flex flex-wrap gap-2">
        <Link href={filterHref({ reason: null })} className={chip(!reason)}>
          {t("allReasons")}
        </Link>
        {REASONS.map((r) => (
          <Link key={r} href={filterHref({ reason: r })} className={chip(reason === r)}>
            {r.replace(/_/g, " ")}
          </Link>
        ))}
        <span className="mx-2 self-center text-muted">·</span>
        {[1, 2, 3].map((p) => (
          <Link key={p} href={filterHref({ priority: priority === p ? null : p })} className={chip(priority === p)}>
            P{p}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="mt-10 rounded-[20px] border border-hairline bg-paper p-8 text-body">{t("queueEmpty")}</p>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => {
            const task = taskOf(item.task_id);
            const mine = item.assigned_to === session.userId;
            return (
              <li key={item.id} className="rounded-[20px] border border-hairline bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5",
                          item.priority === 1 ? "bg-ember text-paper" : "bg-sand text-forest",
                        )}
                      >
                        P{item.priority}
                      </span>
                      <span className="text-forest">{item.reason.replace(/_/g, " ")}</span>
                      <span className="text-muted">
                        ·{" "}
                        {new Date(item.created_at).toLocaleString("en-GB", {
                          timeZone: "Africa/Lagos",
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </p>
                    {task ? (
                      <p className="mt-2 text-forest">
                        {task.title}{" "}
                        <span className="text-muted">
                          · {task.skill_id} · {task.status}
                          {task.agent_paused ? ` · ${t("agentPaused")}` : ""}
                        </span>
                      </p>
                    ) : (
                      <p className="mt-2 text-muted">
                        {item.meta?.kind === "self_harm" ? t("selfHarmItem") : t("noTask")}
                      </p>
                    )}
                    {item.note && <p className="mt-1 text-[0.9375rem] text-body">{item.note}</p>}
                  </div>
                  <div className="flex gap-2">
                    {item.status === "open" || !mine ? (
                      <form action={takeOverItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className="min-h-11 rounded-full bg-forest px-5 font-bold text-paper">
                          {t("takeOver")}
                        </button>
                      </form>
                    ) : null}
                    {item.status === "assigned" && mine && (
                      <form action={handBackItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button className="min-h-11 rounded-full border-2 border-forest px-5 font-bold text-forest">
                          {t("handBack")}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function chip(active: boolean) {
  return cn(
    "inline-flex min-h-9 items-center rounded-full px-3 text-sm font-bold",
    active ? "bg-forest text-paper" : "border border-hairline bg-paper text-forest",
  );
}
