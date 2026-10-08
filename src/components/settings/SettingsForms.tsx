"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, PasswordInput, Select } from "@/components/ui/field";
import { changePassword, signOutOtherSessions, updateProfile } from "@/server/actions/settings";

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Accra",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Europe/London",
  "America/New_York",
];

export function ProfileForm({ name, language, timezone }: { name: string; language: "en" | "pcm"; timezone: string }) {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(updateProfile, { status: "idle" });
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  return (
    <form action={action} className="mt-6 space-y-5">
      <Field id="name" label={ta("name")} error={errors.name}>
        <Input
          id="name"
          name="name"
          defaultValue={values.name ?? name}
          maxLength={80}
          autoComplete="given-name"
          invalid={!!errors.name}
        />
      </Field>
      <Field id="language" label={ta("language")}>
        <Select id="language" name="language" defaultValue={values.language ?? language}>
          <option value="en">{ta("languageEn")}</option>
          <option value="pcm">{ta("languagePcm")}</option>
        </Select>
      </Field>
      <Field id="timezone" label={t("timezone")} error={errors.timezone}>
        <Select id="timezone" name="timezone" defaultValue={values.timezone ?? timezone}>
          {(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((z) => (
            <option key={z} value={z}>
              {z.replace("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      {state.status === "error" && <Notice>{state.error}</Notice>}
      {state.status === "ok" && <Notice tone="success">{tc("saved")}</Notice>}
      <Button type="submit" disabled={pending}>
        {pending ? tc("saving") : tc("save")}
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const t = useTranslations("settings");
  const ta = useTranslations("auth");
  const [state, action, pending] = useActionState(changePassword, { status: "idle" });
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={action} className="mt-6 space-y-5" key={state.status === "ok" ? "done" : "form"}>
      <Field id="current" label={t("currentPassword")} error={errors.current}>
        <PasswordInput
          showLabel={ta("showPassword")}
          hideLabel={ta("hidePassword")}
          id="current"
          name="current"
          autoComplete="current-password"
          invalid={!!errors.current}
        />
      </Field>
      <Field id="next" label={t("newPassword")} hint={ta("passwordHint")} error={errors.next}>
        <PasswordInput
          showLabel={ta("showPassword")}
          hideLabel={ta("hidePassword")}
          id="next"
          name="next"
          autoComplete="new-password"
          invalid={!!errors.next}
        />
      </Field>
      <Field id="confirm" label={t("confirmPassword")} error={errors.confirm}>
        <PasswordInput
          showLabel={ta("showPassword")}
          hideLabel={ta("hidePassword")}
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          invalid={!!errors.confirm}
        />
      </Field>
      {state.status === "error" && <Notice>{state.error}</Notice>}
      {state.status === "ok" && <Notice tone="success">{t("passwordChanged")}</Notice>}
      <Button type="submit" disabled={pending}>
        {t("changePassword")}
      </Button>
    </form>
  );
}

export function SignOutOthers() {
  const t = useTranslations("settings");
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="mt-4 space-y-3">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await signOutOtherSessions({});
            setMessage(
              result.status === "ok"
                ? t("signedOutOthers", { count: result.data.count })
                : result.status === "error"
                  ? result.error
                  : null,
            );
          })
        }
      >
        {t("signOutOthers")}
      </Button>
      {message && <Notice tone="success">{message}</Notice>}
    </div>
  );
}
