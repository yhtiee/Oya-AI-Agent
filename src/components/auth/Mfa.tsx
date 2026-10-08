"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Field, Input, Notice } from "@/components/ui/field";
import { beginMfaEnrolment, verifyMfaCode } from "@/server/actions/settings";

function CodeForm({ next }: { next: string }) {
  const t = useTranslations("ops");
  const router = useRouter();
  const [state, action, pending] = useActionState(verifyMfaCode, { status: "idle" });

  useEffect(() => {
    if (state.status === "ok") router.replace(next);
  }, [state.status, next, router]);

  return (
    <form action={action} className="mt-6 space-y-4">
      <Field id="code" label={t("code")} error={state.status === "error" ? state.fieldErrors?.code : undefined}>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          className="text-center font-display text-2xl tracking-[0.3em]"
          invalid={state.status === "error"}
          autoFocus
        />
      </Field>
      {state.status === "error" && <Notice>{state.error}</Notice>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("verifying") : t("verify")}
      </Button>
    </form>
  );
}

export function MfaVerify({ next }: { next: string }) {
  const t = useTranslations("ops");
  return (
    <div className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
      <h1 className="t-h2 text-forest">{t("verifyTitle")}</h1>
      <p className="mt-2 text-body">{t("verifyLead")}</p>
      <CodeForm next={next} />
    </div>
  );
}

export function MfaEnrol({ email, next }: { email: string; next: string }) {
  const t = useTranslations("ops");
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function begin() {
    start(async () => {
      const result = await beginMfaEnrolment({});
      if (result.status !== "ok") {
        setError(result.status === "error" ? result.error : null);
        return;
      }
      const uri = `otpauth://totp/${encodeURIComponent(`Oya:${email}`)}?secret=${result.data.secret}&issuer=Oya&algorithm=SHA1&digits=6&period=30`;
      const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#10241B", light: "#FFFDF8" } });
      setSetup({ secret: result.data.secret, qr });
    });
  }

  return (
    <div className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
      <h1 className="t-h2 text-forest">{t("enrolTitle")}</h1>
      <p className="mt-2 text-body">{t("enrolLead")}</p>

      {!setup ? (
        <div className="mt-6 space-y-3">
          {error && <Notice>{error}</Notice>}
          <Button onClick={begin} disabled={pending}>
            {t("enrolStart")}
          </Button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL generated in the browser */}
          <img
            src={setup.qr}
            alt="QR code for your authenticator app"
            width={220}
            height={220}
            className="mt-6 rounded-[12px] border border-hairline"
          />
          <p className="mt-4 text-sm text-body">{t("enrolManual")}</p>
          <p className="mt-1 font-mono text-sm break-all text-forest select-all">
            {setup.secret.match(/.{1,4}/g)?.join(" ")}
          </p>
          <CodeForm next={next} />
        </>
      )}
    </div>
  );
}
