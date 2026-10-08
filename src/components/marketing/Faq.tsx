import { FAQS } from "@/lib/marketing/content";
import { Section, SectionHeading } from "./ui";

export function Faq() {
  return (
    <Section id="faq" tone="sand" labelledBy="faq-title">
      <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
        <SectionHeading id="faq-title" title="Questions you might have" />
        <div className="border-t-2 border-forest">
          {FAQS.map((f, i) => (
            <details key={f.q} open={i === 0} className="group border-b border-hairline">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-display text-xl font-bold text-forest [&::-webkit-details-marker]:hidden">
                {f.q}
                <span
                  aria-hidden="true"
                  className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-forest text-forest transition-transform duration-[250ms] group-open:rotate-45"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p className="max-w-[60ch] pb-6 t-body-lg text-body">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  );
}
