"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DAY_ASKS, type BuildingId } from "@/lib/content";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { UiIcon } from "../icons";

const START = 6;
const END = 22;
const VIEW_W = 1600;
const VIEW_H = 240;
const BAR_H = 76;

const FOREST = "#10241B";
const LIT = "#F7B26E";
const DARK = "#1E3A2D";

// Where each building sits on the strip, and the top of its roof.
const BUILDINGS: Record<BuildingId, { cx: number; top: number }> = {
  bungalow: { cx: 130, top: 92 },
  storey: { cx: 360, top: 16 },
  kiosk: { cx: 560, top: 116 },
  block: { cx: 760, top: 40 },
  house: { cx: 980, top: 88 },
  lodge: { cx: 1180, top: 72 },
  keke: { cx: 1358, top: 144 },
  mango: { cx: 1510, top: 72 },
};

// Sky colour through the day, from the brand palette.
const SKY: [number, string][] = [
  [6, "#FCE3CB"],
  [8, "#FAF6EE"],
  [12, "#DCEFE3"],
  [16, "#FCE3CB"],
  [18, "#F7B26E"],
  [18.75, "#F28C28"],
  [19.4, "#1A3428"],
  [21, "#16301F"],
  [22, "#10241B"],
];

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v + (b[i] - v) * t)) as RGB;
const css = ([r, g, b]: RGB) => `rgb(${r}, ${g}, ${b})`;

function skyAt(hour: number): RGB {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, c0] = SKY[i];
    const [h1, c1] = SKY[i + 1];
    if (hour <= h1) return mix(toRgb(c0), toRgb(c1), Math.max(0, (hour - h0) / (h1 - h0)));
  }
  return toRgb(SKY[SKY.length - 1][1]);
}

function luminance([r, g, b]: RGB) {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function formatHour(hour: number) {
  let h = Math.floor(hour);
  let m = Math.round((hour - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Letting go near an ask lands exactly on it.
function snap(hour: number) {
  const near = DAY_ASKS.find((a) => Math.abs(a.hour - hour) < 0.15);
  return near ? near.hour : hour;
}

function activeIndexAt(hour: number) {
  let index = -1;
  DAY_ASKS.forEach((a, i) => {
    if (a.hour <= hour) index = i;
  });
  return index;
}

const STARS: [number, number][] = [
  [8, 14], [17, 30], [26, 9], [38, 22], [47, 6], [58, 26], [66, 12], [74, 32], [83, 8], [92, 20],
];

export function DayOnTheStreet() {
  const reduced = usePrefersReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const holdUntil = useRef(0);
  const [width, setWidth] = useState(0);
  const [hour, setHour] = useState(START + 0.1);
  const [playing, setPlaying] = useState(false);
  const [touched, setTouched] = useState(false);

  const isPlaying = playing && hour < END;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Play through the day once, the first time the street scrolls into view.
  useEffect(() => {
    const el = panelRef.current;
    if (!el || reduced || touched) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced, touched]);

  // Move through the day, pausing at each ask long enough to read it.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      if (Date.now() < holdUntil.current) return;
      setHour((h) => {
        const next = Math.min(END, h + 0.05);
        const reached = DAY_ASKS.find((a) => a.hour > h && a.hour <= next);
        if (reached) {
          holdUntil.current = Date.now() + 3600;
          return reached.hour;
        }
        return next;
      });
    }, 40);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  function takeOver(next: number) {
    setTouched(true);
    setPlaying(false);
    setHour(Math.min(END, Math.max(START, next)));
  }

  function togglePlay() {
    setTouched(true);
    if (isPlaying) {
      setPlaying(false);
      return;
    }
    if (hour >= END) setHour(START + 0.01);
    holdUntil.current = 0;
    setPlaying(true);
  }

  function onSliderKey(e: KeyboardEvent<HTMLInputElement>) {
    const i = activeIndexAt(hour);
    let target: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") target = DAY_ASKS[Math.min(i + 1, DAY_ASKS.length - 1)].hour;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = i > 0 ? DAY_ASKS[i - 1].hour : START;
    if (e.key === "Home") target = START;
    if (e.key === "End") target = END;
    if (target !== null) {
      e.preventDefault();
      takeOver(target);
    }
  }

  const activeIndex = activeIndexAt(hour);
  const active = activeIndex >= 0 ? DAY_ASKS[activeIndex] : null;

  const sky = skyAt(hour);
  const onDark = luminance(sky) < 0.3;
  const night = hour >= 18.8;
  const far = css(mix(sky, toRgb(FOREST), 0.28));

  // Camera: the street pans so whoever is asking sits in the middle.
  const narrow = width > 0 && width < 640;
  const panelH = narrow ? 580 : 620;
  const stripH = narrow ? 170 : 220;
  const scale = stripH / VIEW_H;
  const stripW = VIEW_W * scale;
  const focus = BUILDINGS[active?.building ?? "bungalow"];
  const tx =
    stripW <= width ? (width - stripW) / 2 : Math.min(0, Math.max(width - stripW, width / 2 - focus.cx * scale));
  const bx = focus.cx * scale + tx;

  const bubbleW = Math.min(380, width - 32);
  const bubbleLeft = Math.min(Math.max(bx - bubbleW / 2, 16), width - bubbleW - 16);
  const bubbleBottom = BAR_H + stripH - focus.top * scale + 18;

  // Sun by day, moon by night.
  const skyTop = 28;
  const skyBottom = panelH - BAR_H - stripH * 0.55;
  const dayProgress = Math.min(1, Math.max(0, (hour - 6) / 12.8));
  const sunX = 40 + dayProgress * (width - 80);
  const sunY = skyBottom - (skyBottom - skyTop - 50) * Math.sin(Math.PI * dayProgress);
  const nightProgress = Math.min(1, Math.max(0, (hour - 19) / 3));
  const moonX = width * (0.2 + nightProgress * 0.55);

  const textColor = onDark ? "text-cream" : "text-forest";

  return (
    <div>
      <div
        ref={panelRef}
        className="relative overflow-hidden rounded-[32px] border border-hairline transition-colors duration-300"
        style={{ height: panelH, backgroundColor: css(sky) }}
      >
        {/* Stars */}
        <div aria-hidden="true" className="absolute inset-0 transition-opacity duration-500" style={{ opacity: Math.min(1, Math.max(0, hour - 19.6)) }}>
          {STARS.map(([l, t]) => (
            <span key={`${l}-${t}`} className="absolute size-[3px] rounded-full bg-cream" style={{ left: `${l}%`, top: `${t}%` }} />
          ))}
        </div>

        {/* Sun and moon */}
        {width > 0 && (
          <>
            <span
              aria-hidden="true"
              className="absolute size-16 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[opacity,background-color] duration-500"
              style={{ left: sunX, top: sunY, opacity: hour < 18.9 ? 1 : 0, backgroundColor: hour > 17.3 ? "#FCE3CB" : "#F28C28", boxShadow: "0 0 0 14px rgba(252,227,203,0.3)" }}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 40 40"
              className="absolute size-12 -translate-x-1/2 transition-opacity duration-500"
              style={{ left: moonX, top: skyTop + 24, opacity: hour >= 19.2 ? 1 : 0 }}
            >
              <mask id="moon-cut">
                <rect width="40" height="40" fill="white" />
                <circle cx="27" cy="14" r="15" fill="black" />
              </mask>
              <circle cx="20" cy="20" r="17" fill="#FAF6EE" mask="url(#moon-cut)" />
            </svg>
          </>
        )}

        {/* Clock */}
        <div className={`absolute left-5 top-5 sm:left-8 sm:top-7 ${textColor} transition-colors duration-300`}>
          <p className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
            {formatHour(hour)}
          </p>
          <p className="mt-1 text-[0.9375rem] opacity-80">A day on Ewet Housing</p>
        </div>

        {/* The street */}
        {width > 0 && (
          <div
            aria-hidden="true"
            className="absolute left-0 transition-transform duration-700 ease-[var(--ease-oya)]"
            style={{ bottom: BAR_H, width: stripW, height: stripH, transform: `translateX(${tx}px)` }}
          >
            <Strip night={night} far={far} />
          </div>
        )}

        {/* Who's asking, and what Oya said */}
        {active && width > 0 && (
          <div
            className="absolute transition-[left,bottom] duration-700 ease-[var(--ease-oya)]"
            style={{ left: bubbleLeft, bottom: bubbleBottom, width: bubbleW }}
          >
            <div key={activeIndex} aria-live="polite">
              <div className="animate-rise rounded-[20px] bg-mint px-4 py-3 text-forest shadow-floating">
                <p className="flex items-center gap-1.5 text-sm font-bold text-deep-leaf">
                  {active.voice && <UiIcon name="mic" size={15} />}
                  {active.who}, {active.time}
                </p>
                <p className="mt-1 leading-snug">{active.text}</p>
              </div>
              <div className="animate-rise mt-2 flex items-start gap-2" style={{ animationDelay: "450ms" }}>
                <span aria-hidden="true" className="mt-1 grid size-8 shrink-0 place-items-center rounded-full bg-orange font-display font-extrabold text-forest ring-2 ring-paper">
                  o
                </span>
                <p className="rounded-[20px] rounded-tl-[6px] bg-paper px-4 py-3 leading-snug text-forest shadow-floating">
                  {active.reply}
                </p>
              </div>
            </div>
            <span
              aria-hidden="true"
              className="absolute -bottom-[18px] h-[18px] border-l-2 border-dashed border-orange"
              style={{ left: Math.min(Math.max(bx - bubbleLeft, 20), bubbleW - 20) }}
            />
          </div>
        )}

        {/* Time of day */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 bg-forest px-4 sm:px-6" style={{ height: BAR_H }}>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause the day" : hour >= END ? "Replay the day" : "Play the day"}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-orange text-forest transition-colors hover:bg-orange-soft"
          >
            {isPlaying ? (
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <UiIcon name="play" size={20} />
            )}
          </button>
          <span className="hidden text-sm font-bold text-body-on-dark sm:block">6am</span>
          <div className="relative flex-1">
            <label htmlFor="day-time" className="sr-only">
              Time of day
            </label>
            <input
              id="day-time"
              type="range"
              min={START}
              max={END}
              step="any"
              value={hour}
              onChange={(e) => takeOver(snap(parseFloat(e.target.value)))}
              onPointerDown={() => {
                setTouched(true);
                setPlaying(false);
              }}
              onKeyDown={onSliderKey}
              aria-valuetext={`${formatHour(hour)}${active ? `. ${active.who} asks: ${active.text}` : ""}`}
              className="day-range relative z-10 block w-full"
            />
            {DAY_ASKS.map((a, i) => (
              <span
                key={a.time}
                aria-hidden="true"
                className={`pointer-events-none absolute top-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ${
                  i === activeIndex ? "size-2.5 bg-orange" : "size-1.5 bg-body-on-dark/70"
                }`}
                style={{ left: `calc(16px + ${(a.hour - START) / (END - START)} * (100% - 32px))` }}
              />
            ))}
          </div>
          <span className="hidden text-sm font-bold text-body-on-dark sm:block">10pm</span>
        </div>
      </div>
      <p className="mt-4 text-sm text-body">
        Drag the sun, or use the arrow keys to jump between asks. The street and its people are illustrations.
      </p>
    </div>
  );
}

const PATTERN = [true, false, true, true, false, true, true, true, false, true, false, true];

function Strip({ night, far }: { night: boolean; far: string }) {
  let n = 0;
  const win = () => (night && PATTERN[n++ % PATTERN.length] ? LIT : DARK);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} width="100%" height="100%" className="block">
      {/* Far layer */}
      <g fill={far} className="transition-[fill] duration-300">
        {[
          [0, 120, 90, 100], [200, 96, 70, 124], [470, 110, 80, 110], [620, 130, 70, 90], [840, 100, 60, 120],
          [1070, 118, 80, 102], [1260, 96, 70, 124], [1420, 126, 90, 94], [1540, 104, 60, 116],
        ].map(([x, y, w, h]) => (
          <rect key={x} x={x} y={y} width={w} height={h} />
        ))}
      </g>

      {/* Wires */}
      <g fill="none" stroke={FOREST} strokeWidth="2">
        <path d="M0 64Q230 104 456 38" />
        <path d="M464 38Q870 100 1276 38" />
        <path d="M1284 38Q1450 74 1600 54" />
      </g>
      <g fill={FOREST}>
        <rect x="456" y="22" width="8" height="198" />
        <rect x="432" y="34" width="56" height="6" rx="2" />
        <rect x="1276" y="22" width="8" height="198" />
        <rect x="1252" y="34" width="56" height="6" rx="2" />
        <rect x="0" y="220" width={VIEW_W} height="20" />
      </g>

      {/* Bungalow */}
      <g fill={FOREST}>
        <path d="M30 140 130 92 232 140z" />
        <rect x="42" y="138" width="178" height="82" />
      </g>
      <rect x="70" y="162" width="30" height="24" fill={win()} />
      <rect x="162" y="162" width="30" height="24" fill={win()} />

      {/* Storey building with tank and generator */}
      <g fill={FOREST}>
        <rect x="248" y="58" width="224" height="12" />
        <rect x="256" y="68" width="208" height="152" />
        <rect x="400" y="26" width="46" height="32" rx="8" />
        <rect x="406" y="16" width="34" height="12" rx="4" />
        <rect x="476" y="196" width="36" height="24" rx="3" />
        <rect x="502" y="184" width="5" height="14" />
      </g>
      {[280, 340, 400].map((x) => (
        <rect key={`s1-${x}`} x={x} y="92" width="40" height="34" fill={win()} />
      ))}
      {[280, 340, 400].map((x) => (
        <rect key={`s2-${x}`} x={x} y="152" width="40" height="34" fill={win()} />
      ))}

      {/* Kiosk */}
      <g fill={FOREST}>
        <rect x="528" y="150" width="120" height="70" />
        <rect x="548" y="116" width="80" height="18" rx="2" />
      </g>
      <rect x="542" y="164" width="92" height="30" fill={LIT} />
      <text x="588" y="129" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C5D6CC" fontFamily="Arial, sans-serif">
        PROVISIONS
      </text>
      <path d="M520 152h136l-10-18H530z" fill="#F28C28" />
      <path d="M540 134h12l-4 18h-14zM568 134h12v18h-12zM596 134h12l2 18h-12zM624 134h12l6 18h-12z" fill="#FCE3CB" opacity=".85" />

      {/* Block with pharmacy */}
      <rect x="700" y="40" width="120" height="180" fill={FOREST} />
      {[60, 110, 160].map((y) =>
        [718, 768].map((x) => <rect key={`b-${x}-${y}`} x={x} y={y} width="30" height="26" fill={win()} />),
      )}
      <path d="M756 196h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#2E9E6B" />

      {/* House with dish */}
      <g fill={FOREST}>
        <path d="M890 132 980 88 1080 132z" />
        <rect x="900" y="130" width="170" height="90" />
        <path d="M1030 104a15 15 0 0 0 28-8z" />
        <rect x="1042" y="100" width="4" height="16" />
      </g>
      <rect x="930" y="152" width="34" height="26" fill={win()} />
      <rect x="1010" y="152" width="34" height="26" fill={win()} />

      {/* Student lodge */}
      <g fill={FOREST}>
        <rect x="1100" y="92" width="160" height="128" />
        <rect x="1130" y="72" width="100" height="18" rx="2" />
      </g>
      <text x="1180" y="85" textAnchor="middle" fontSize="10" fontWeight="700" fill="#C5D6CC" fontFamily="Arial, sans-serif">
        GRACE LODGE
      </text>
      {[106, 164].map((y) =>
        [1118, 1166, 1214].map((x) => <rect key={`l-${x}-${y}`} x={x} y={y} width="32" height="28" fill={win()} />),
      )}
      <path d="M1100 150h160" stroke="#2C4A3C" strokeWidth="3" />

      {/* Keke by the road */}
      <g fill={FOREST}>
        <path d="M1306 218v-36c2-20 14-28 34-28h48c10 0 14 8 15 18l2 46z" />
        <rect x="1310" y="144" width="94" height="12" rx="5" />
      </g>
      <path d="M1324 164h52v24h-56z" fill={far} />
      <circle cx="1324" cy="220" r="11" fill={FOREST} />
      <circle cx="1390" cy="220" r="11" fill={FOREST} />
      <circle cx="1404" cy="192" r="4.5" fill={night ? LIT : DARK} />

      {/* Mango tree */}
      <rect x="1504" y="150" width="12" height="70" fill={FOREST} />
      <g fill={FOREST}>
        <circle cx="1510" cy="118" r="46" />
        <circle cx="1546" cy="142" r="38" />
        <circle cx="1474" cy="146" r="34" />
      </g>
      <ellipse cx="1486" cy="152" rx="5" ry="7" fill="#F28C28" />
      <ellipse cx="1530" cy="130" rx="5" ry="7" fill="#F28C28" />
    </svg>
  );
}
