import { HeroAsk } from "./HeroAsk";

// A dusk sky over the street: the page's one gradient.
const SKY =
  "radial-gradient(ellipse 70% 45% at 50% 100%, rgba(242,140,40,0.32), transparent 70%), linear-gradient(180deg, #10241B 0%, #1A3428 55%, #2C4A3C 100%)";

const STARS: [number, number, number][] = [
  [6, 10, 2],
  [14, 26, 1.5],
  [23, 7, 1.5],
  [37, 18, 2],
  [44, 6, 1.5],
  [52, 28, 1.5],
  [61, 9, 2],
  [70, 20, 1.5],
  [79, 5, 1.5],
  [88, 15, 2],
  [95, 30, 1.5],
  [31, 34, 1.5],
];

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="grain relative isolate overflow-hidden px-4 pt-12 pb-[210px] sm:px-8 sm:pb-[280px] lg:px-16 lg:pt-16 lg:pb-[290px]"
      style={{ background: SKY }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        {STARS.map(([left, top, size]) => (
          <span
            key={`${left}-${top}`}
            className="absolute rounded-full bg-cream opacity-50"
            style={{ left: `${left}%`, top: `${top}%`, width: size, height: size }}
          />
        ))}
      </div>

      <HeroAsk
        intro={
          <>
            <h1
              id="hero-title"
              className="mx-auto max-w-[15ch] font-display text-[clamp(2.5rem,5.4vw,4.5rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-cream"
            >
              Everybody needs one person who knows everybody.
            </h1>
            <p className="mx-auto mt-5 max-w-[46ch] t-body-lg text-body-on-dark">
              Oya is that person, right inside WhatsApp. Say what you need, and Oya asks around, checks what&apos;s true
              today and sees it through.
            </p>
          </>
        }
      />
    </section>
  );
}
