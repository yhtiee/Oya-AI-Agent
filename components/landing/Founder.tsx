import { PROMISES } from "@/lib/content";
import { Section } from "./ui";

// Draft copy in the founder's voice. Edit freely; it should sound like you.
export function Founder() {
  return (
    <Section id="why" tone="sand" labelledBy="why-title">
      <div className="grid gap-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <article className="rounded-[6px] bg-paper px-6 py-10 shadow-card sm:px-12 sm:py-14">
          <h2 id="why-title" className="t-h1 text-forest">
            Why Oya
          </h2>
          <div className="t-body-lg mt-6 max-w-[58ch] space-y-5 text-body">
            <p>
              Getting anything done here usually starts with one question: who do you know? Who knows a plumber who
              will actually come, which pharmacy has the drug, whether light has come back, what the passport office
              really wants from you.
            </p>
            <p>
              The answers exist. They&apos;re just scattered across phone calls, WhatsApp groups, and trips that end
              with “come back tomorrow”.
            </p>
            <p>
              Oya puts all of that in one chat. You say what you need the way you&apos;d say it to a friend, and Oya
              does the asking around, the checking and the chasing. It&apos;s free, because the people who run around
              the most shouldn&apos;t have to pay to stop.
            </p>
            <p>We&apos;re starting small, one estate or campus at a time, so we get it right.</p>
          </div>
          <p className="mt-10 font-accent text-5xl font-bold leading-none text-forest">Utibeabasi</p>
          <p className="mt-2 text-body">Utibeabasi Ekpenyong, founder</p>
        </article>

        <div className="lg:pt-6">
          <h3 className="t-h2 text-forest">What we promise you</h3>
          <ul className="mt-8 space-y-6">
            {PROMISES.map((p) => (
              <li key={p} className="t-body-lg border-t-2 border-forest pt-4 text-forest">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
