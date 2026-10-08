"use client";

import { useState } from "react";

const FIRST_WEEKDAY = 2; // the 1st falls on a Wednesday (Monday = 0)
const DAYS_IN_MONTH = 30;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const NUDGES: Record<number, string> = {
  6: "Your gas usually runs out around now. Want me to find a refill?",
  12: "The plumber didn't show. Another one is booked for 2pm.",
  18: "Your passport is ready for collection. Bring the old one.",
  20: "Your car papers expire in 10 days. Should I start the renewal?",
  27: "School admission closes tomorrow. Your forms are ready to submit.",
};

function ordinal(n: number) {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${s}`;
}

export function Calendar() {
  const [day, setDay] = useState(20);
  const cells = Array.from({ length: FIRST_WEEKDAY + DAYS_IN_MONTH }, (_, i) => i - FIRST_WEEKDAY + 1);

  return (
    <div className="grid items-center gap-5 sm:grid-cols-[1.15fr_0.85fr]">
      {/* The wall calendar */}
      <div className="relative mx-auto w-full max-w-[340px] -rotate-[1.5deg] pt-4">
        <span aria-hidden="true" className="absolute top-0 left-1/2 size-3 -translate-x-1/2 rounded-full bg-forest" />
        <span
          aria-hidden="true"
          className="absolute top-1 left-1/2 h-6 w-28 -translate-x-1/2 rounded-t-full border-2 border-b-0 border-forest"
        />
        <div className="relative mt-4 overflow-hidden rounded-[10px] bg-paper shadow-floating">
          <div className="flex items-center justify-between bg-forest px-4 py-3">
            <p className="font-display text-lg font-bold text-cream">This month</p>
            <div aria-hidden="true" className="flex gap-6">
              <span className="size-2.5 rounded-full bg-chat-bg" />
              <span className="size-2.5 rounded-full bg-chat-bg" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1 px-3 pt-3 pb-4 text-center">
            {WEEKDAYS.map((d) => (
              <span key={d} aria-hidden="true" className="pb-1 text-xs font-bold text-body">
                {d[0]}
              </span>
            ))}
            {cells.map((n, i) => {
              if (n < 1) return <span key={`blank-${i}`} />;
              const nudge = NUDGES[n];
              if (!nudge) {
                return (
                  <span key={n} className="grid h-9 place-items-center text-sm text-body">
                    {n}
                  </span>
                );
              }
              const selected = n === day;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${WEEKDAYS[i % 7]} the ${ordinal(n)}: Oya has a reminder`}
                  onClick={() => setDay(n)}
                  className={`relative grid h-9 place-items-center rounded-full text-sm font-bold ${
                    selected ? "text-cream" : "text-forest"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-forest"
                    />
                  )}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 44 40"
                    className="absolute -inset-1 h-[calc(100%+8px)] w-[calc(100%+8px)]"
                  >
                    <path
                      d="M8 22C6 10 17 4 25 5c10 1 15 8 14 17-1 10-11 15-19 14C10 35 5 27 8 17"
                      fill="none"
                      stroke="#F28C28"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="relative">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* What Oya says that day */}
      <div key={day} className="animate-rise" aria-live="polite">
        <p className="text-sm font-bold text-deep-leaf">
          {WEEKDAYS[(FIRST_WEEKDAY + day - 1) % 7]} the {ordinal(day)}, 9:00 am
        </p>
        <div className="mt-2 flex items-start gap-2">
          <span
            aria-hidden="true"
            className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-orange font-display font-extrabold text-forest"
          >
            o
          </span>
          <p className="rounded-[20px] rounded-tl-[6px] bg-paper px-4 py-3 text-forest shadow-card">{NUDGES[day]}</p>
        </div>
        <p className="mt-3 text-sm text-forest">Tap a circled day.</p>
      </div>
    </div>
  );
}
