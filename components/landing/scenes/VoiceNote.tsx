"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { UiIcon } from "../../icons";

const SAID = {
  pidgin: "I wan move go Ibadan next month. I go need house, people wey go carry my load, and school for my pikin.",
  english: "I'm moving to Ibadan next month. I'll need a place to live, people to move my things, and a school for my child.",
} as const;

type Lang = keyof typeof SAID;

const HEARD = ["Moving to Ibadan", "Next month", "A place to live", "Movers", "A school for your child"];

const BARS = [10, 18, 26, 14, 30, 22, 12, 28, 34, 18, 24, 12, 30, 20, 14, 26, 10, 18];

export function VoiceNote() {
  const reduced = usePrefersReducedMotion();
  const [lang, setLang] = useState<Lang>("pidgin");
  const [words, setWords] = useState(SAID.pidgin.split(" ").length);
  const [playing, setPlaying] = useState(false);

  const all = SAID[lang].split(" ");
  const done = words >= all.length;
  const isPlaying = playing && !done;

  useEffect(() => {
    if (!isPlaying) return;
    const total = SAID[lang].split(" ").length;
    const timer = window.setInterval(() => setWords((w) => Math.min(total, w + 1)), 150);
    return () => window.clearInterval(timer);
  }, [isPlaying, lang]);

  function play(next: Lang = lang) {
    setLang(next);
    if (reduced) {
      setWords(SAID[next].split(" ").length);
      return;
    }
    setWords(0);
    setPlaying(true);
  }

  return (
    <div>
      <svg viewBox="0 0 480 250" className={`block w-full ${isPlaying ? "is-playing" : ""}`} aria-hidden="true">
        {/* Mango branch */}
        <path d="M-10 26C60 30 110 18 170 34" stroke="#10241B" strokeWidth="9" strokeLinecap="round" fill="none" />
        <g fill="#10241B">
          <ellipse cx="34" cy="40" rx="22" ry="10" transform="rotate(18 34 40)" />
          <ellipse cx="78" cy="18" rx="22" ry="9" transform="rotate(-14 78 18)" />
          <ellipse cx="112" cy="42" rx="20" ry="9" transform="rotate(24 112 42)" />
          <ellipse cx="150" cy="22" rx="20" ry="8" transform="rotate(-20 150 22)" />
        </g>
        <ellipse cx="96" cy="58" rx="7" ry="10" fill="#F28C28" />

        {/* Ground */}
        <path d="M0 224h480" stroke="#10241B" strokeWidth="3" />

        {/* Orange plastic chair */}
        <g fill="#F28C28">
          <rect x="132" y="104" width="70" height="78" rx="20" />
          <rect x="128" y="172" width="104" height="14" rx="6" />
        </g>
        <path d="M138 186 128 224M226 186 236 224M156 186l4 38" stroke="#F28C28" strokeWidth="6" strokeLinecap="round" />

        {/* Him, sending a voice note */}
        <g fill="#10241B">
          <circle cx="190" cy="84" r="20" />
          <path d="M172 108c12-6 26-6 36 0l8 66h-48z" />
          <path d="M174 166h82a11 11 0 0 1 0 22h-82z" />
          <path d="M246 180h20l8 40h-20z" />
          <rect x="252" y="216" width="34" height="9" rx="4" />
        </g>
        <path d="M204 118 232 150 222 100" stroke="#10241B" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="214" y="80" width="14" height="22" rx="3" fill="#FFFDF8" transform="rotate(-14 221 91)" />

        {/* The voice note */}
        <path d="M262 98 240 92l18-12z" fill="#FFFDF8" />
        <rect x="258" y="58" width="200" height="58" rx="29" fill="#FFFDF8" />
        <path d="M280 77v20l16-10z" fill="#1D6B47" />
        {BARS.map((h, i) => (
          <rect
            key={i}
            className="wave-bar"
            x={306 + i * 7.4}
            y={87 - h / 2}
            width="3.6"
            height={h}
            rx="1.8"
            fill="#1D6B47"
            style={{ animationDelay: `${(i % 6) * 0.12}s` }}
          />
        ))}
      </svg>

      <div className="mt-4 rounded-[20px] bg-paper p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Language" className="flex rounded-full bg-mint p-1">
            {(["pidgin", "english"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => play(l)}
                className={`rounded-full px-4 py-1.5 text-sm font-bold capitalize transition-colors ${
                  lang === l ? "bg-forest text-cream" : "text-forest"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => play()}
            className="inline-flex items-center gap-2 rounded-full bg-orange px-4 py-2 text-sm font-bold text-forest hover:bg-orange-soft"
          >
            <UiIcon name="play" size={16} /> {isPlaying ? "Playing" : "Play voice note"}
          </button>
        </div>

        <p className="mt-4 min-h-[3.25em] text-lg italic leading-snug text-forest" aria-live="polite">
          “{all.slice(0, words).join(" ")}
          {!done && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-forest" />}
          {done && "”"}
        </p>

        <p className="mt-4 text-sm font-bold text-deep-leaf">What Oya heard</p>
        <ul className="mt-2 flex min-h-9 flex-wrap gap-2">
          {done &&
            HEARD.map((h, i) => (
              <li
                key={`${lang}-${h}`}
                className="animate-rise rounded-full bg-mint px-3 py-1.5 text-sm font-bold text-forest"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                {h}
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
