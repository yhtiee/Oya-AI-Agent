import { NAV_LINKS, PRIMARY_CTA } from "@/lib/site";
import { ButtonLink } from "./ui";

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="grain overflow-hidden bg-forest px-4 pt-20 sm:px-8 md:pt-28 lg:px-16 lg:pt-36">
      <div className="mx-auto max-w-[1200px]">
        <h2 id="closing-title" className="font-display text-[clamp(3rem,8vw,7rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-orange">
          Oya. Sort am.
        </h2>
        <p className="t-body-lg mt-6 max-w-[44ch] text-body-on-dark">
          Save one contact for all the things you&apos;d normally ask around for. Free for everyone, starting in
          Nigeria.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href={PRIMARY_CTA.href}>{PRIMARY_CTA.label}</ButtonLink>
          <ButtonLink href="#top" variant="secondary" onDark>
            Try it at the top
          </ButtonLink>
        </div>

        <footer className="mt-24 flex flex-col gap-6 border-t border-forest-line pt-8 text-[0.9375rem] text-body-on-dark md:flex-row md:items-center md:justify-between">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-cream">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p>© 2026 Oya. Built in Nigeria, for everywhere.</p>
        </footer>
      </div>

      {/* Oversized wordmark, cropped by the bottom of the page */}
      <p
        aria-hidden="true"
        className="mt-10 select-none text-center font-display text-[42vw] font-extrabold leading-[0.72] tracking-[-0.05em] text-forest-card lg:text-[34vw]"
      >
        oya
      </p>
    </section>
  );
}
