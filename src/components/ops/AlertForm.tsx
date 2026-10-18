"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, Select } from "@/components/ui/field";
import type { ActionState } from "@/server/actions/authed-action";
import { endLocalAlert, saveLocalAlert } from "@/server/actions/ops-alerts";

/* Create or edit a local alert (SPEC §5.6). Times are entered in Lagos time. */

export type AlertFormValue = {
  id?: string;
  title: string;
  body: string;
  severity: "info" | "warning" | "severe";
  areaIds: string[];
  sourceUrl: string;
  startsAt: string;
  endsAt: string;
};

export function AlertForm({
  areas,
  initial,
}: {
  areas: { id: string; name: string; kind: string }[];
  initial?: AlertFormValue;
}) {
  const t = useTranslations("opsAlerts");
  const [state, action, pending] = useActionState<ActionState<{ id: string }>, FormData>(saveLocalAlert, {
    status: "idle",
  });
  const [selected, setSelected] = useState<string[]>(initial?.areaIds ?? []);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const v = (k: keyof AlertFormValue) =>
    (values[k] as string | undefined) ?? (initial?.[k] as string | undefined) ?? "";

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={initial?.id ?? ""} />
      <input type="hidden" name="areaIds" value={selected.join(",")} />
      <Field id="title" label={t("fieldTitle")} error={errors.title}>
        <Input id="title" name="title" defaultValue={v("title")} maxLength={140} invalid={!!errors.title} />
      </Field>
      <Field id="body" label={t("fieldBody")} error={errors.body}>
        <textarea
          id="body"
          name="body"
          defaultValue={v("body")}
          rows={3}
          maxLength={2000}
          className="mt-2 block w-full rounded-[18px] border-2 border-hairline bg-paper px-4 py-3 text-forest outline-none focus:border-forest"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="severity" label={t("fieldSeverity")}>
          <Select id="severity" name="severity" defaultValue={v("severity") || "info"}>
            <option value="info">{t("info")}</option>
            <option value="warning">{t("warning")}</option>
            <option value="severe">{t("severe")}</option>
          </Select>
        </Field>
        <Field id="startsAt" label={t("fieldStarts")} error={errors.startsAt}>
          <Input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={v("startsAt")}
            invalid={!!errors.startsAt}
          />
        </Field>
        <Field id="endsAt" label={t("fieldEnds")} error={errors.endsAt}>
          <Input id="endsAt" name="endsAt" type="datetime-local" defaultValue={v("endsAt")} invalid={!!errors.endsAt} />
        </Field>
      </div>
      <Field id="sourceUrl" label={t("fieldSource")} hint={t("sourceHint")} error={errors.sourceUrl}>
        <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={v("sourceUrl")} invalid={!!errors.sourceUrl} />
      </Field>
      <fieldset>
        <legend className="font-bold text-forest">{t("fieldAreas")}</legend>
        {errors.areaIds && <p className="mt-1 text-sm font-bold text-ember">{errors.areaIds}</p>}
        {areas.length === 0 ? (
          <p className="mt-2 text-body">{t("noAreas")}</p>
        ) : (
          <div className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
            {areas.map((a) => {
              const on = selected.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected((s) => (on ? s.filter((x) => x !== a.id) : [...s, a.id]))}
                  className={
                    on
                      ? "min-h-9 rounded-full bg-forest px-3 text-sm font-bold text-paper"
                      : "min-h-9 rounded-full border border-hairline bg-paper px-3 text-sm font-bold text-forest"
                  }
                >
                  {a.name} <span className="font-normal opacity-70">· {a.kind.replace("_", " ")}</span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>
      {state.status === "error" && !Object.keys(errors).length && <Notice>{state.error}</Notice>}
      {state.status === "ok" && <Notice tone="success">{t("saved")}</Notice>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : initial?.id ? t("update") : t("publish")}
        </Button>
      </div>
    </form>
  );
}

export function EndAlertButton({ id }: { id: string }) {
  const t = useTranslations("opsAlerts");
  const [, action, pending] = useActionState<ActionState<{ id: string }>, FormData>(endLocalAlert, { status: "idle" });
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" disabled={pending} className="text-sm font-bold text-ember underline underline-offset-4">
        {t("end")}
      </button>
    </form>
  );
}
