"use client";

import { useState } from "react";
import { NAV_LINKS, PRIMARY_CTA } from "@/lib/site";
import { UiIcon } from "../icons";
import { ButtonLink, Wordmark } from "./ui";

export function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-forest-line bg-forest/95 px-4 backdrop-blur sm:px-8 lg:px-16">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-6">
        <a href="#top" aria-label="Oya, back to top" className="rounded-lg">
          <Wordmark className="text-[2rem] leading-none" />
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="font-bold text-body-on-dark transition-colors hover:text-cream">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <ButtonLink href={PRIMARY_CTA.href} className="hidden min-h-11 sm:inline-flex">
            {PRIMARY_CTA.label}
          </ButtonLink>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 place-items-center rounded-full border-2 border-forest-edge text-cream lg:hidden"
          >
            <UiIcon name={open ? "close" : "menu"} />
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu" className="mx-auto max-w-[1200px] border-t border-forest-line py-4 lg:hidden">
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 text-lg font-bold text-cream"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <ButtonLink href={PRIMARY_CTA.href} className="mt-3 w-full sm:hidden">
            {PRIMARY_CTA.label}
          </ButtonLink>
        </div>
      )}
    </header>
  );
}
