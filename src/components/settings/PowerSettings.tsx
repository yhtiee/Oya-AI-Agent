"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice, Select } from "@/components/ui/field";
import { enablePush, pushState, type PushState } from "@/components/notifications/push";
import { updatePowerPrefs } from "@/server/actions/settings";

/* Power & alerts settings (SPEC §5.1, §5.6, §5.7). */
export function PowerSettings({
  clusters,
  areaId,
  overnightAlerts,
  alertsDigest,
  kwhPerDay,
}: {
  clusters: { id: string; name: string }[];
  areaId: string | null;
  overnightAlerts: boolean;
  alertsDigest: boolean;
  kwhPerDay: number | null;
}) {
  const t = useTranslations("settingsPower");
  const [area, setArea] = useState(areaId ?? "");
  const [overnight, setOvernight] = useState(overnightAlerts);
  const [digest, setDigest] = useState(alertsDigest);
  const [usage, setUsage] = useState(kwhPerDay ? String(kwhPerDay) : "");
  const [push, setPush] = useState<PushState>("unsupported");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  const save = () =>
    start(async () => {
      const r = await updatePowerPrefs({
        areaId: area || null,
        overnightAlerts: overnight,
        alertsDigest: digest,
        kwhPerDay: usage ? Number(usage) : null,
      });
      setResult(
        r.status === "ok" ? { ok: true, text: t("saved") } : { ok: false, text: r.status === "error" ? r.error : "" },
      );
    });

  const toggle = "mt-0.5 size-5 shrink-0 accent-[#1D6B47]";

  return (
    <div className="mt-5 grid gap-5">
      <div>
        <label htmlFor="power-area" className="font-bold text-forest">
          {t("area")}
        </label>
        {clusters.length ? (
          <Select id="power-area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{t("noArea")}</option>
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : (
          <p className="mt-2 text-body">{t("noClusters")}</p>
        )}
      </div>

      <div>
        <label htmlFor="power-usage" className="font-bold text-forest">
          {t("usage")}
        </label>
        <Select id="power-usage" value={usage} onChange={(e) => setUsage(e.target.value)}>
          <option value="">{t("usageUnset")}</option>
          <option value="3">{t("usageSmall")}</option>
          <option value="8">{t("usageFamily")}</option>
        </Select>
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={overnight}
          onChange={(e) => setOvernight(e.target.checked)}
          className={toggle}
        />
        <span>
          <span className="font-bold text-forest">{t("overnight")}</span>
          <span className="block text-sm text-body">{t("overnightHint")}</span>
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={digest} onChange={(e) => setDigest(e.target.checked)} className={toggle} />
        <span>
          <span className="font-bold text-forest">{t("digest")}</span>
          <span className="block text-sm text-body">{t("digestHint")}</span>
        </span>
      </label>

      <div className="rounded-[18px] bg-sand px-4 py-3">
        <p className="font-bold text-forest">{t("push")}</p>
        <p className="text-sm text-body">
          {push === "on"
            ? t("pushOn")
            : push === "denied"
              ? t("pushDenied")
              : push === "unsupported"
                ? t("pushUnsupported")
                : t("pushOff")}
        </p>
        {push === "off" && (
          <Button variant="secondary" size="sm" className="mt-2" onClick={async () => setPush(await enablePush())}>
            {t("pushEnable")}
          </Button>
        )}
      </div>

      {result && <Notice tone={result.ok ? "success" : "error"}>{result.text}</Notice>}
      <div>
        <Button onClick={save} disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
