import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { LOCALES } from "@/i18n/config";
import brand from "../../../config/oya-brand.json";

/* Living reference for the brand tokens (SPEC §21.4 M0, Appendix E). Not linked from the site. */

export const metadata: Metadata = {
  title: "Style",
  robots: { index: false, follow: false },
};

type ColorKey = keyof typeof brand.colors;

const TYPE_SCALE = [
  ["t-hero", "hero", "Everybody needs one person"],
  ["t-statement", "statement", "Say it once."],
  ["t-h1", "h1", "Help decide what Oya sorts first"],
  ["t-h2", "h2", "Your money waits until the job is done"],
  ["t-h3", "h3", "Ewet Family Clinic"],
  ["t-body-lg", "bodyLarge", "Oya asks around, checks what's true today and sees it through."],
  ["", "body", "Emeka can come at 11am. People rate him 4.8 and he's charging ₦8,000."],
  ["t-eyebrow text-ember", "eyebrow", "Live task"],
] as const;

export default async function StylePage() {
  const signoffs = await Promise.all(
    LOCALES.map(async (locale) => ({ locale, t: await getTranslations({ locale, namespace: "common" }) })),
  );
  const colors = Object.entries(brand.colors) as [ColorKey, { hex: string; role: string }][];

  return (
    <main className="bg-cream px-4 py-12 sm:px-8 lg:px-16">
      <div className="mx-auto max-w-[1200px]">
        <p className="font-display text-4xl font-extrabold tracking-[-0.025em] text-orange">oya</p>
        <h1 className="mt-4 t-h1 text-forest">Brand tokens</h1>
        <p className="mt-3 max-w-[60ch] t-body-lg text-body">
          Everything here comes from <code className="font-bold">config/oya-brand.json</code> and{" "}
          <code className="font-bold">src/app/globals.css</code>. A unit test keeps the two in sync.
        </p>

        <section aria-labelledby="colors" className="mt-14">
          <h2 id="colors" className="t-h2 text-forest">
            Colours
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {colors.map(([key, c]) => (
              <li key={key} className="overflow-hidden rounded-[20px] border border-hairline bg-paper">
                <div className="h-20" style={{ backgroundColor: c.hex }} />
                <div className="p-4">
                  <p className="font-bold text-forest">
                    {key} <span className="font-normal text-body">{c.hex}</span>
                  </p>
                  <p className="mt-1 text-sm text-body">{c.role}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="contrast" className="mt-14">
          <h2 id="contrast" className="t-h2 text-forest">
            Contrast pairs
          </h2>
          <p className="mt-2 max-w-[60ch] text-body">{brand.contrast.note}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {brand.contrast.pairs.map((p) => (
              <li
                key={`${p.fg}-${p.bg}`}
                className="rounded-[20px] border border-hairline p-4"
                style={{
                  backgroundColor: brand.colors[p.bg as ColorKey].hex,
                  color: brand.colors[p.fg as ColorKey].hex,
                }}
              >
                <p className="font-display text-2xl font-bold">{p.ratio}:1</p>
                <p className="mt-1 text-sm font-bold">
                  {p.fg} on {p.bg}
                </p>
                <p className="text-sm">{p.use}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="type" className="mt-14">
          <h2 id="type" className="t-h2 text-forest">
            Type scale
          </h2>
          <ul className="mt-6 divide-y divide-hairline border-y border-hairline">
            {TYPE_SCALE.map(([cls, name, sample]) => (
              <li key={name} className="grid gap-2 py-5 md:grid-cols-[160px_1fr]">
                <p className="text-sm font-bold text-ember">{name}</p>
                <p className={`${cls} text-forest`}>{sample}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="buttons" className="mt-14">
          <h2 id="buttons" className="t-h2 text-forest">
            Buttons
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button>Get early access</Button>
            <Button variant="secondary">See how it works</Button>
            <Button variant="action" size="sm">
              Book Emeka
            </Button>
            <Button variant="quiet">Not now</Button>
            <Button disabled>Saving…</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-card bg-forest p-6">
            <Button>Join the waitlist</Button>
            <Button variant="secondary-on-dark">See what people ask</Button>
          </div>
        </section>

        <section aria-labelledby="surfaces" className="mt-14">
          <h2 id="surfaces" className="t-h2 text-forest">
            Surfaces
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-card border border-hairline bg-paper p-8">
              <p className="font-bold text-forest">Card</p>
              <p className="mt-1 text-sm text-body">paper, 1px hairline, 28px radius, no shadow</p>
            </div>
            <div className="rounded-card bg-forest-card p-8 text-cream">
              <p className="font-bold">Card on dark</p>
              <p className="mt-1 text-sm text-body-on-dark">forestCard, no border</p>
            </div>
            <div className="rounded-panel bg-paper p-8 shadow-floating">
              <p className="font-bold text-forest">Floating</p>
              <p className="mt-1 text-sm text-body">Shadows only for devices and one hero element</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="i18n" className="mt-14">
          <h2 id="i18n" className="t-h2 text-forest">
            Languages
          </h2>
          <ul className="mt-6 space-y-2">
            {signoffs.map(({ locale, t }) => (
              <li key={locale} className="text-forest">
                <span className="font-bold text-ember">{locale}</span> {t("back")} · {t("tryAgain")} · {t("signoff")}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
