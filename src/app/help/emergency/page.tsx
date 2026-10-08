import type { Metadata } from "next";
import Link from "next/link";
import en from "@/i18n/en.json";
import pcm from "@/i18n/pcm.json";
import { hasUnverifiedResources, verifiedResources } from "@/server/safety/emergency-resources";

/*
 * Static, no JavaScript needed: it must work on Opera Mini extreme mode and, once the service
 * worker lands (M3), with no network at all (SPEC §4.1, §14.8, §15.4). Both languages are shown
 * together so nobody has to find a language switch in an emergency.
 */

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Emergency help: call 112",
  description: "If someone is in danger or badly hurt in Nigeria, call 112. It's free on every network.",
  alternates: { canonical: "/help/emergency" },
};

const LANGS = [
  { lang: "en-NG", t: en.emergency },
  { lang: "pcm", t: pcm.emergency },
] as const;

export default function EmergencyPage() {
  const primary = verifiedResources("emergency")[0];
  const others = verifiedResources().filter((r) => r.id !== primary?.id);
  const ambulancePending = hasUnverifiedResources("ambulance");

  return (
    <main className="min-h-dvh bg-forest px-4 py-10 text-cream sm:px-8">
      <div className="mx-auto max-w-[640px]">
        <p className="font-display text-3xl font-extrabold tracking-[-0.025em] text-orange">oya</p>

        <h1 className="mt-8 font-display text-[clamp(2.25rem,8vw,3.5rem)] leading-[1.05] font-extrabold tracking-[-0.02em]">
          {en.emergency.title}
        </h1>

        {primary && (
          <a
            href={`tel:${primary.phone}`}
            className="mt-8 flex min-h-20 items-center justify-between gap-4 rounded-[24px] bg-orange px-6 py-5 text-forest focus-visible:outline-cream"
          >
            <span>
              <span className="block font-display text-4xl font-extrabold">{en.emergency.call112}</span>
              <span className="mt-1 block font-bold">{en.emergency.call112Detail}</span>
            </span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="40"
              height="40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
            </svg>
          </a>
        )}

        {others.length > 0 && (
          <ul className="mt-4 space-y-3">
            {others.map((r) => (
              <li key={r.id}>
                <a
                  href={`tel:${r.phone}`}
                  className="flex min-h-14 items-center justify-between rounded-[18px] bg-forest-card px-5 py-3"
                >
                  <span className="font-bold">{r.label}</span>
                  <span className="font-display text-xl font-bold text-orange">{r.phone}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        {LANGS.map(({ lang, t }) => (
          <section key={lang} lang={lang} className="mt-10 border-t border-forest-line pt-8">
            <p className="text-xl leading-snug font-bold">{t.lead}</p>
            <p className="mt-4 text-lg text-body-on-dark">{t.notADoctor}</p>
            <p className="mt-4 text-lg text-body-on-dark">{t.selfHarm}</p>
            {ambulancePending && <p className="mt-4 text-body-on-dark">{t.localNumbersPending}</p>}
          </section>
        ))}

        <p className="mt-10 text-sm text-body-on-dark">{en.emergency.worksOffline}</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center font-bold text-cream underline underline-offset-4"
        >
          {en.emergency.backToOya}
        </Link>
      </div>
    </main>
  );
}
