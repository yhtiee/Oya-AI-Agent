import type { ReactNode } from "react";

type Tone = "cream" | "sand" | "forest" | "orange";

const TONE_BG: Record<Tone, string> = {
  cream: "bg-cream",
  sand: "bg-sand",
  forest: "bg-forest",
  orange: "bg-orange",
};

export function Section({
  id,
  tone,
  labelledBy,
  className = "",
  children,
}: {
  id?: string;
  tone: Tone;
  labelledBy?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={`${TONE_BG[tone]} px-4 py-16 sm:px-8 md:py-24 lg:px-16 lg:py-32 ${className}`}
    >
      <div className="mx-auto max-w-[1200px]">{children}</div>
    </section>
  );
}

export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" | "statement" }) {
  const color = tone === "dark" ? "text-orange" : tone === "statement" ? "text-forest" : "text-ember";
  return <p className={`t-eyebrow ${color}`}>{children}</p>;
}

export function SectionHeading({
  id,
  title,
  intro,
  onDark = false,
  className = "",
}: {
  id: string;
  title: ReactNode;
  intro?: ReactNode;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 id={id} className={`t-h1 max-w-[20ch] ${onDark ? "text-cream" : "text-forest"}`}>
        {title}
      </h2>
      {intro && (
        <p className={`t-body-lg mt-5 max-w-[60ch] ${onDark ? "text-body-on-dark" : "text-body"}`}>{intro}</p>
      )}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  onDark = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  onDark?: boolean;
  className?: string;
}) {
  const external = href.startsWith("http");
  const look =
    variant === "primary"
      ? "bg-orange text-forest hover:bg-orange-soft"
      : onDark
        ? "border-2 border-forest-edge text-cream hover:border-cream"
        : "border-2 border-hairline text-forest hover:border-forest";
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-bold transition-colors duration-150 ${look} ${className}`}
    >
      {children}
    </a>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`font-display font-extrabold tracking-[-0.025em] text-orange ${className}`}>oya</span>;
}

/** Status mark that never relies on colour alone: always pair it with text. */
export function StepMark({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf text-paper">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5 10 17.5 19 7.5" />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-orange">
        <span className="animate-pulse-dot size-2.5 rounded-full bg-orange" />
      </span>
    );
  }
  return <span aria-hidden="true" className="size-6 shrink-0 rounded-full border-2 border-hairline" />;
}
