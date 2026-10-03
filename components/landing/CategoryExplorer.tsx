"use client";

import { useEffect, useRef, useState } from "react";
import { PACKS, type Pack } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { CategoryIcon, UiIcon } from "../icons";

const tileTone = (i: number) => (i % 2 ? "bg-peach" : "bg-mint");

// Desktop: how far you scroll before the next card opens, and where the drawer pins.
const STEP = 440;
const PIN_TOP = 96;
const LAST = PACKS.length - 1;

export function CategoryExplorer() {
  return (
    <>
      <ScrollDrawer />
      <StackedCards />
    </>
  );
}

/**
 * Desktop: the drawer pins under the nav and each stretch of scrolling opens the next card.
 * The page only moves on once the last card has been shown.
 */
function ScrollDrawer() {
  const reduced = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (track.offsetHeight === 0) return;
      const scrolled = PIN_TOP - track.getBoundingClientRect().top;
      setActive(Math.min(LAST, Math.max(0, Math.floor(scrolled / STEP + 0.3))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Clicking a tab scrolls to it, so the page and the drawer stay in step.
  function goTo(i: number) {
    const track = trackRef.current;
    if (!track) return;
    const top = track.getBoundingClientRect().top + window.scrollY - PIN_TOP + i * STEP + 1;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <div
      ref={trackRef}
      className="relative hidden xl:block"
      style={{ height: `calc(min(100vh - ${PIN_TOP + 32}px, 680px) + ${LAST * STEP + STEP * 0.7}px)` }}
    >
      <div className="sticky flex flex-col gap-4" style={{ top: PIN_TOP, height: `min(100vh - ${PIN_TOP + 32}px, 680px)` }}>
        <div className="flex min-h-0 flex-1 gap-2">
          {PACKS.map((pack, i) => {
            const open = i === active;
            return (
              <div
                key={pack.id}
                className={`relative overflow-hidden rounded-card transition-[flex,background-color] duration-[450ms] ease-[var(--ease-oya)] ${
                  open ? "border border-hairline bg-paper" : tileTone(i)
                }`}
                style={{ flex: open ? "1 1 0%" : "0 0 76px" }}
              >
                {open ? (
                  <div className="h-full min-w-[640px] overflow-y-auto p-8">
                    <PackDetail key={pack.id} pack={pack} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show ${pack.name}`}
                    className="group flex h-full w-full flex-col items-center justify-between pb-6 pt-8"
                  >
                    <span className="rotate-180 font-display text-2xl font-bold text-forest [writing-mode:vertical-rl] transition-transform duration-[250ms] group-hover:-translate-y-1">
                      {pack.name}
                    </span>
                    <CategoryIcon name={pack.icon} size={48} tone={i % 2 ? "mint" : "peach"} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4" aria-hidden="true">
          <div className="flex flex-1 gap-1.5">
            {PACKS.map((pack, i) => (
              <span
                key={pack.id}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= active ? "bg-forest" : "bg-hairline"}`}
              />
            ))}
          </div>
          <p className="w-[190px] text-right text-sm font-bold text-forest">
            {active < LAST ? `${active + 1} of ${PACKS.length}. Keep scrolling` : `${PACKS.length} of ${PACKS.length}. That's all of them`}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Below xl: every card is open, and each title sticks while you read its list. */
function StackedCards() {
  return (
    <div className="space-y-4 xl:hidden">
      {PACKS.map((pack, i) => (
        <section key={pack.id} aria-labelledby={`pack-${pack.id}`} className="rounded-card border border-hairline bg-paper">
          <div className={`sticky top-16 z-10 flex items-center gap-4 rounded-t-card px-4 py-3 sm:px-6 ${tileTone(i)}`}>
            <CategoryIcon name={pack.icon} size={44} tone={i % 2 ? "mint" : "peach"} />
            <h3 id={`pack-${pack.id}`} className="flex-1 font-display text-xl font-bold text-forest">
              {pack.name}
            </h3>
            <span className="text-sm font-bold text-forest">{pack.items.length} things</span>
          </div>
          <div className="px-4 pb-4 pt-4 sm:px-6">
            <PackDetail pack={pack} compact />
          </div>
        </section>
      ))}
    </div>
  );
}

function PackDetail({ pack, compact = false }: { pack: Pack; compact?: boolean }) {
  return (
    <div className={compact ? "" : "animate-rise"}>
      {!compact && (
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="t-h2 text-forest">{pack.name}</h3>
          {pack.badge && <span className="rounded-full bg-peach px-3 py-1 text-sm font-bold text-forest">{pack.badge}</span>}
        </div>
      )}
      {compact && pack.badge && (
        <span className="mb-3 inline-block rounded-full bg-peach px-3 py-1 text-sm font-bold text-forest">{pack.badge}</span>
      )}
      <p className="max-w-[60ch] text-body md:mt-2">{pack.blurb}</p>

      <ul className="mt-4 divide-y divide-hairline">
        {pack.items.map((c, i) => (
          <li key={c.name} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 py-4 sm:grid-cols-[auto_1.25fr_1fr] sm:gap-x-6">
            <CategoryIcon name={c.icon} size={52} tone={i % 2 ? "peach" : "mint"} />
            <div>
              <p className="font-display text-lg font-bold leading-tight text-forest">{c.name}</p>
              <p className="mt-1 text-[0.9375rem] text-body">{c.agent}</p>
            </div>
            <p className="col-start-2 flex gap-2 text-[0.9375rem] font-bold text-deep-leaf sm:col-start-auto">
              <UiIcon name="check" size={18} className="mt-0.5" />
              {c.get}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
