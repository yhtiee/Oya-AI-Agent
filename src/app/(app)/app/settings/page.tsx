import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PasswordForm, ProfileForm, SignOutOthers } from "@/components/settings/SettingsForms";
import { requireSession } from "@/server/auth/session";
import { getServiceClient } from "@/server/db/service-client";
import { getUserClient } from "@/server/db/user-client";
import { formatInZone } from "@/lib/time";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSession("/app/settings");
  const t = await getTranslations("settings");
  const db = getUserClient(session);

  // Reads go through the user's own client, so RLS decides what comes back.
  const [{ data: profile }, { data: consents }, { data: sessions }] = await Promise.all([
    db.from("profiles").select("display_name, language, timezone").eq("id", session.userId).single(),
    db
      .from("consents")
      .select("purpose, granted, policy_version, created_at")
      .order("created_at", { ascending: false }),
    getServiceClient().rpc("auth_list_sessions", { p_user_id: session.userId }),
  ]);

  const latestConsents = new Map<string, { granted: boolean; policy_version: string; created_at: string }>();
  for (const c of consents ?? []) if (!latestConsents.has(c.purpose)) latestConsents.set(c.purpose, c);

  const others = ((sessions as { session_id: string; last_seen_at: string; user_agent: string | null }[]) ?? []).filter(
    (s) => s.session_id !== session.sessionId,
  );
  const when = (iso: string) => formatInZone(iso, "d MMM yyyy, h:mm a", session.timezone);

  return (
    <div className="space-y-10">
      <h1 className="t-h1 text-forest">{t("title")}</h1>

      <section aria-labelledby="profile-title" className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
        <h2 id="profile-title" className="t-h2 text-forest">
          {t("profileTitle")}
        </h2>
        <p className="mt-1 text-body">{session.email}</p>
        <ProfileForm
          name={profile?.display_name ?? session.displayName}
          language={profile?.language === "pcm" ? "pcm" : "en"}
          timezone={profile?.timezone ?? session.timezone}
        />
      </section>

      <section aria-labelledby="password-title" className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
        <h2 id="password-title" className="t-h2 text-forest">
          {t("passwordTitle")}
        </h2>
        <PasswordForm />
      </section>

      <section aria-labelledby="sessions-title" className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
        <h2 id="sessions-title" className="t-h2 text-forest">
          {t("sessionsTitle")}
        </h2>
        <ul className="mt-4 divide-y divide-hairline">
          <li className="py-3 font-bold text-forest">{t("thisDevice")}</li>
          {others.map((s) => (
            <li key={s.session_id} className="py-3">
              <p className="text-forest">{s.user_agent ? s.user_agent.slice(0, 80) : "Unknown device"}</p>
              <p className="text-sm text-body">{t("lastActive", { when: when(s.last_seen_at) })}</p>
            </li>
          ))}
        </ul>
        {others.length > 0 ? <SignOutOthers /> : <p className="mt-2 text-body">{t("noOtherSessions")}</p>}
      </section>

      {session.appRole && (
        <section aria-labelledby="mfa-title" className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
          <h2 id="mfa-title" className="t-h2 text-forest">
            {t("twoFactorTitle")}
          </h2>
          {session.mfaEnabled ? (
            <p className="mt-2 text-body">{t("twoFactorOn")}</p>
          ) : (
            <>
              <p className="mt-2 text-body">{t("twoFactorStaffOnly")}</p>
              <Link
                href="/ops/verify"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-orange px-6 font-bold text-forest"
              >
                {t("twoFactorSetUp")}
              </Link>
            </>
          )}
        </section>
      )}

      <section aria-labelledby="consents-title" className="rounded-card border border-hairline bg-paper p-6 sm:p-8">
        <h2 id="consents-title" className="t-h2 text-forest">
          {t("consentsTitle")}
        </h2>
        <ul className="mt-4 divide-y divide-hairline">
          {[...latestConsents.entries()].map(([purpose, c]) => (
            <li key={purpose} className="flex flex-wrap justify-between gap-2 py-3">
              <span className="font-bold text-forest capitalize">{purpose.replace(/_/g, " ")}</span>
              <span className="text-sm text-body">
                {c.granted ? t("consentGranted", { when: when(c.created_at) }) : "Withdrawn"} · v{c.policy_version}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
