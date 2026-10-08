"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice, PasswordInput } from "@/components/ui/field";
import { signIn } from "@/server/actions/auth";

export function SignInForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signIn, { status: "idle" });

  return (
    <div className="mx-auto max-w-[440px]">
      <h1 className="t-h1 text-forest">{t("signInTitle")}</h1>
      <p className="mt-3 t-body-lg text-body">{t("signInLead")}</p>

      <form action={action} className="mt-8 space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field id="email" label={t("email")}>
          <Input
            id="email"
            name="email"
            defaultValue={state.status === "error" ? state.values?.email : undefined}
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={t("emailPlaceholder")}
            required
          />
        </Field>
        <Field id="password" label={t("password")}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            showLabel={t("showPassword")}
            hideLabel={t("hidePassword")}
            required
          />
        </Field>

        {state.status === "error" && <Notice>{state.error}</Notice>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      <p className="mt-6 text-sm text-body">{t("forgotPassword")}</p>
      <p className="mt-8 border-t border-hairline pt-6 text-body">
        {t("noAccount")}{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="font-bold text-deep-leaf underline underline-offset-4"
        >
          {t("createOne")}
        </Link>
      </p>
    </div>
  );
}
