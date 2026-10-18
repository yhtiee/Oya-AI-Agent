import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertForm, EndAlertButton, type AlertFormValue } from "@/components/ops/AlertForm";
import { cn } from "@/lib/utils";
import { requireStaff } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";

/* Local alerts editor (SPEC §5.6, §14.11). */

type Row = {
  id: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "severe";
  area_ids: string[];
  source_url: string;
  starts_at: string;
  ends_at: string | null;
};

/** Request time (a function so render stays free of direct clock reads). */
function nowMs(): number {
  return Date.now();
}

/** ISO → the value a datetime-local input expects, in Lagos time. */
const toLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() + 3_600_000).toISOString().slice(0, 16) : "";

export default async function OpsAlerts({ searchParams }: PageProps<"/ops/alerts">) {
  await requireStaff("/ops/alerts");
  const t = await getTranslations("opsAlerts");
  const params = await searchParams;
  const client = getServiceClient();

  const [{ data: rows }, { data: areas }] = await Promise.all([
    client
      .from("local_alerts")
      .select("id, title, body, severity, area_ids, source_url, starts_at, ends_at")
      .or(`ends_at.is.null,ends_at.gt.${new Date(nowMs() - 7 * 86_400_000).toISOString()}`)
      .order("starts_at", { ascending: false })
      .limit(50),
    client.from("areas").select("id, name, kind").eq("active", true).order("kind").order("name").limit(500),
  ]);
  const alerts = (rows ?? []) as Row[];
  const areaName = new Map((areas ?? []).map((a) => [a.id as string, a.name as string]));
  const editing = typeof params.edit === "string" ? alerts.find((a) => a.id === params.edit) : undefined;
  const initial: AlertFormValue | undefined = editing && {
    id: editing.id,
    title: editing.title,
    body: editing.body,
    severity: editing.severity,
    areaIds: editing.area_ids,
    sourceUrl: editing.source_url,
    startsAt: toLocal(editing.starts_at),
    endsAt: toLocal(editing.ends_at),
  };
  const now = nowMs();
  const state = (a: Row) =>
    a.ends_at && Date.parse(a.ends_at) <= now ? "ended" : Date.parse(a.starts_at) > now ? "upcoming" : "live";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
      <section>
        <h1 className="t-h1 text-forest">{t("title")}</h1>
        <p className="mt-2 text-body">{t("lead")}</p>
        {alerts.length === 0 ? (
          <p className="mt-8 rounded-[20px] border border-hairline bg-paper p-8 text-body">{t("empty")}</p>
        ) : (
          <ul className="mt-6 grid gap-3">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-[20px] border border-hairline bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5",
                          a.severity === "severe"
                            ? "bg-ember text-paper"
                            : a.severity === "warning"
                              ? "bg-peach"
                              : "bg-sand",
                        )}
                      >
                        {t(a.severity)}
                      </span>
                      <span className="text-muted">{t(state(a))}</span>
                    </p>
                    <p className="mt-2 font-bold text-forest">{a.title}</p>
                    <p className="text-[0.9375rem] text-body">{a.body}</p>
                    <p className="mt-1 text-sm text-muted">
                      {a.area_ids.map((id) => areaName.get(id) ?? "?").join(", ")} ·{" "}
                      <a href={a.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                        {t("source")}
                      </a>
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/ops/alerts?edit=${a.id}`}
                      className="text-sm font-bold text-deep-leaf underline underline-offset-4"
                    >
                      {t("edit")}
                    </Link>
                    {state(a) !== "ended" && <EndAlertButton id={a.id} />}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <aside className="h-fit rounded-[24px] border border-hairline bg-paper p-6">
        <h2 className="t-h3 text-forest">{editing ? t("editTitle") : t("newTitle")}</h2>
        {editing && (
          <Link href="/ops/alerts" className="mt-1 inline-block text-sm text-deep-leaf underline">
            {t("newInstead")}
          </Link>
        )}
        <div className="mt-4">
          <AlertForm
            key={editing?.id ?? "new"}
            areas={(areas ?? []) as { id: string; name: string; kind: string }[]}
            initial={initial}
          />
        </div>
      </aside>
    </div>
  );
}
