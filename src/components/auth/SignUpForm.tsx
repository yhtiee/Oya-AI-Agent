"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, PasswordInput } from "@/components/ui/field";
import { signUp, type AuthState } from "@/server/actions/auth";

/*
 * Laid out to fit one screen without scrolling, down to 360×740 phones. From tablet width up the
 * fields sit in rows (name | email, password | checkboxes); on phones they stack, because two
 * inputs side by side at 360px are too narrow to type in. Every target stays ≥ 44px.
 */
export function SignUpForm({ next, language }: { next: string; language: "en" | "pcm" }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, { status: "idle" });
  const [under18, setUnder18] = useState(false);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const values = state.status === "error" ? (state.values ?? {}) : {};

  if (under18) {
    // SPEC §3.3: explain, show emergency help, and store nothing (nothing has been sent).
    return (
      <div role="status">
        <h1 className="t-h2 text-forest">{t("under18Title")}</h1>
        <p className="mt-3 text-body">{t("under18Body")}</p>
        <a
          href="tel:112"
          className="mt-5 flex min-h-16 items-center justify-between rounded-[24px] bg-orange px-6 py-4 font-display text-2xl font-extrabold text-forest"
        >
          112 <span className="font-sans text-base font-bold">{tc("emergencyLink")}</span>
        </a>
        <Button variant="secondary" className="mt-6" onClick={() => setUnder18(false)}>
          {t("under18Back")}
        </Button>
      </div>
    );
  }

  const checkbox = "mt-0.5 size-5 shrink-0 accent-[#1D6B47]";

  return (
    <div>
      <h1 className="font-display text-[clamp(1.5rem,6vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.015em] text-forest">
        {t("signUpTitle")}
      </h1>
      <p className="mt-1 hidden text-body sm:block">{t("signUpLead")}</p>

      <form action={action} className="mt-3 grid gap-2.5 sm:mt-6 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-4" noValidate>
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="language" value={language} />

        <Field id="name" label={t("name")} error={errors.name}>
          <Input
            id="name"
            name="name"
            defaultValue={values.name}
            autoComplete="given-name"
            placeholder={t("namePlaceholder")}
            maxLength={80}
            invalid={!!errors.name}
            className="mt-1 min-h-11 py-2.5 sm:mt-1.5 sm:min-h-12 sm:py-3"
            required
          />
        </Field>
        <Field id="email" label={t("email")} error={errors.email}>
          <Input
            id="email"
            name="email"
            defaultValue={values.email}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            invalid={!!errors.email}
            className="mt-1 min-h-11 py-2.5 sm:mt-1.5 sm:min-h-12 sm:py-3"
            required
          />
        </Field>
        <Field id="password" label={t("password")} hint={t("passwordHint")} error={errors.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={10}
            invalid={!!errors.password}
            className="mt-1 min-h-11 py-2.5 sm:mt-1.5 sm:min-h-12 sm:py-3"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            required
          />
        </Field>
        <Field id="confirm" label={t("confirmPassword")} error={errors.confirm}>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            invalid={!!errors.confirm}
            className="mt-1 min-h-11 py-2.5 sm:mt-1.5 sm:min-h-12 sm:py-3"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            required
          />
        </Field>

        <div className="grid gap-1 sm:col-span-2 sm:grid-cols-2 sm:gap-x-5">
          <div className="flex min-h-11 items-start justify-between gap-3">
            <label className="flex cursor-pointer items-start gap-3 py-1">
              <input
                type="checkbox"
                name="adult"
                defaultChecked={values.adult === "on"}
                aria-invalid={!!errors.adult}
                className={checkbox}
              />
              <span className="font-bold text-forest">{t("adult")}</span>
            </label>
            <button
              type="button"
              onClick={() => setUnder18(true)}
              className="min-h-11 shrink-0 px-1 text-sm font-bold text-deep-leaf underline underline-offset-4"
            >
              {t("under18Link")}
            </button>
          </div>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
            <input
              type="checkbox"
              name="terms"
              defaultChecked={values.terms === "on"}
              aria-invalid={!!errors.terms}
              className={checkbox}
            />
            <span className="text-[0.9375rem] text-body">{t("terms")}</span>
          </label>
          {(errors.adult || errors.terms) && (
            <p className="text-sm font-bold text-ember sm:col-span-2">{errors.adult ?? errors.terms}</p>
          )}
        </div>

        {state.status === "error" && !Object.keys(errors).length && (
          <div className="sm:col-span-2">
            <Notice>{state.error}</Notice>
          </div>
        )}

        <Button type="submit" size="lg" className="w-full sm:col-span-2 sm:mt-1" disabled={pending}>
          {pending ? t("signingUp") : t("signUp")}
        </Button>

        <p className="text-center text-[0.9375rem] text-body sm:col-span-2">
          {t("haveAccount")}{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-bold text-deep-leaf underline underline-offset-4"
          >
            {t("signInInstead")}
          </Link>
        </p>
      </form>
    </div>
  );
}
