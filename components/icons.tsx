import type { ReactNode } from "react";

/* Illustrated icons: 120×120 grid, forest 5px stroke, orange / leaf / paper fills. */

const F = "#10241B";
const O = "#F28C28";
const L = "#2E9E6B";
const P = "#FFFDF8";

const ICONS = {
  power: (
    <>
      <path d="M60 18c-15.5 0-28 12-28 27 0 9.5 5 17 12 22v11h32V67c7-5 12-12.5 12-22 0-15-12.5-27-28-27z" fill={O} />
      <path d="M63 32 53 50h13l-10 18" stroke={P} />
      <path d="M46 88h28M50 98h20" />
    </>
  ),
  food: (
    <>
      <path d="M22 58h76c0 20-17 34-38 34S22 78 22 58z" fill={O} />
      <path d="M44 26c-5 6 5 10 0 16M60 22c-5 6 5 10 0 16M76 26c-5 6 5 10 0 16" />
      <path d="M46 100h28" />
    </>
  ),
  artisans: (
    <>
      <path d="M30 30 88 88" />
      <rect x="18" y="24" width="28" height="13" rx="6.5" transform="rotate(45 32 30.5)" fill={L} />
      <path d="M32 90 72 50" />
      <circle cx="80" cy="40" r="16" fill={O} />
      <path d="m80 40 12-12" stroke={P} strokeWidth={7} />
    </>
  ),
  gov: (
    <>
      <path d="M30 18h40l18 18v62a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4z" fill={P} />
      <path d="M70 18v18h18M40 50h32M40 62h32M40 74h18" />
      <circle cx="84" cy="88" r="15" fill={L} />
      <path d="m77 88 5 5 9-10" stroke={P} />
    </>
  ),
  pharmacy: (
    <>
      <g transform="rotate(-45 60 64)">
        <rect x="26" y="50" width="68" height="28" rx="14" fill={P} />
        <path d="M40 50h20v28H40a14 14 0 0 1 0-28z" fill={L} />
      </g>
      <path d="M92 16v20M82 26h20" stroke={O} strokeWidth={6} />
    </>
  ),
  house: (
    <>
      <path d="M34 54v40h44V54" fill={P} />
      <path d="M24 60 56 32l32 28" />
      <rect x="48" y="72" width="14" height="22" fill={L} />
      <circle cx="86" cy="76" r="13" fill={O} />
      <path d="m95 85 9 9" />
    </>
  ),
  gas: (
    <>
      <rect x="48" y="16" width="24" height="14" rx="3" fill={P} />
      <rect x="34" y="30" width="52" height="70" rx="20" fill={O} />
      <path d="M34 62h52" />
    </>
  ),
  moving: (
    <>
      <rect x="14" y="36" width="58" height="42" rx="5" fill={O} />
      <path d="M72 50h18l14 16v12H72z" fill={P} />
      <circle cx="36" cy="84" r="9" fill={P} />
      <circle cx="86" cy="84" r="9" fill={P} />
    </>
  ),
  laundry: (
    <>
      <rect x="26" y="18" width="68" height="84" rx="12" fill={P} />
      <path d="M26 38h68M38 28h0M48 28h0" />
      <circle cx="60" cy="68" r="20" fill={L} />
      <path d="M46 70c5-5 9 5 14 0s9 5 14 0" stroke={P} />
    </>
  ),
  staff: (
    <>
      <circle cx="54" cy="40" r="16" fill={O} />
      <path d="M24 98c0-18 13-32 30-32s30 14 30 32z" fill={P} />
      <circle cx="88" cy="86" r="14" fill={L} />
      <path d="m81 86 5 5 9-10" stroke={P} />
    </>
  ),
  clinic: (
    <>
      <path d="M42 18h30M48 18v68a9 9 0 0 0 18 0V18" fill={P} />
      <path d="M48 58h18v28a9 9 0 0 1-18 0z" fill={L} />
      <path d="M90 26v22M79 37h22" stroke={O} strokeWidth={6} />
    </>
  ),
  emergency: (
    <>
      <path d="M36 86V64a24 24 0 0 1 48 0v22z" fill={O} />
      <rect x="28" y="86" width="64" height="12" rx="4" fill={F} />
      <path d="M60 16v10M28 30l7 7M92 30l-7 7M16 60h8M96 60h8" />
      <path d="M50 66a10 10 0 0 1 10-10" stroke={P} />
    </>
  ),
  tutor: (
    <>
      <path d="M36 58v18c0 7 11 14 24 14s24-7 24-14V58" fill={P} />
      <path d="M60 28 16 48l44 20 44-20z" fill={O} />
      <path d="M104 48v22" />
    </>
  ),
  school: (
    <>
      <path d="M28 56 60 34l32 22v42H28z" fill={P} />
      <rect x="52" y="74" width="16" height="24" fill={O} />
      <rect x="35" y="62" width="11" height="10" fill={L} stroke="none" />
      <rect x="74" y="62" width="11" height="10" fill={L} stroke="none" />
      <path d="M60 34V14" />
      <path d="M60 14h16l-5 6 5 6H60z" fill={L} />
    </>
  ),
  price: (
    <>
      <path d="M22 26v30l40 40 34-34-40-40H26a4 4 0 0 0-4 4z" fill={O} />
      <circle cx="38" cy="38" r="6" fill={P} />
      <path d="M54 76V54l14 22V54M49 62h24M49 69h24" strokeWidth={4} />
    </>
  ),
  legal: (
    <>
      <path d="M60 22v70M38 98h44M24 34h72M24 34 13 62M24 34l11 28M96 34 85 62M96 34l11 28" />
      <path d="M12 62h24a12 12 0 0 1-24 0z" fill={O} />
      <path d="M84 62h24a12 12 0 0 1-24 0z" fill={O} />
    </>
  ),
  jobs: (
    <>
      <path d="M44 38v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8" />
      <rect x="18" y="38" width="84" height="56" rx="10" fill={O} />
      <path d="M18 60h84" />
      <rect x="53" y="53" width="14" height="14" rx="2" fill={P} />
    </>
  ),
  wholesale: (
    <>
      <rect x="44" y="20" width="32" height="32" rx="3" fill={L} />
      <rect x="26" y="52" width="34" height="40" rx="3" fill={O} />
      <rect x="60" y="52" width="34" height="40" rx="3" fill={P} />
    </>
  ),
  business: (
    <>
      <path d="M42 70l6 22h12l-4-22" fill={P} />
      <path d="M24 50h18l40-22v64L42 70H24z" fill={O} />
      <path d="M42 50v20M94 48a16 16 0 0 1 0 24" />
    </>
  ),
  fuel: (
    <>
      <rect x="26" y="22" width="44" height="72" rx="6" fill={O} />
      <rect x="34" y="32" width="28" height="16" rx="3" fill={P} />
      <path d="M18 96h60M70 46h8a6 6 0 0 1 6 6v28a6 6 0 0 0 12 0V42l-8-8" />
    </>
  ),
  bus: (
    <>
      <rect x="16" y="30" width="88" height="54" rx="12" fill={L} />
      <rect x="28" y="40" width="18" height="12" rx="2" fill={P} />
      <rect x="51" y="40" width="18" height="12" rx="2" fill={P} />
      <rect x="74" y="40" width="18" height="12" rx="2" fill={P} />
      <path d="M16 64h88" />
      <circle cx="38" cy="88" r="9" fill={P} />
      <circle cx="82" cy="88" r="9" fill={P} />
    </>
  ),
  car: (
    <>
      <path d="M16 80V66l12-4 12-18h40l12 18 12 4v14z" fill={O} />
      <path d="M46 50h28l7 12H39z" fill={P} />
      <circle cx="38" cy="82" r="10" fill={P} />
      <circle cx="82" cy="82" r="10" fill={P} />
    </>
  ),
  phone: (
    <>
      <rect x="34" y="14" width="46" height="88" rx="9" fill={P} />
      <path d="M50 92h14" />
      <path d="m60 28-8 16 10 6-8 16" stroke={O} strokeWidth={4} />
      <path d="m84 86 16-16" stroke={L} strokeWidth={7} />
    </>
  ),
  events: (
    <>
      <path d="M28 58v36M92 58v36M44 80h32M50 80v14M70 80v14" />
      <path d="M18 50 60 24l42 26z" fill={O} />
      <path d="M18 50a7 6 0 0 0 14 0 7 6 0 0 0 14 0 7 6 0 0 0 14 0 7 6 0 0 0 14 0 7 6 0 0 0 14 0 7 6 0 0 0 14 0" fill={P} />
    </>
  ),
  beauty: (
    <>
      <path d="M44 76 84 18M76 76 36 18" />
      <circle cx="40" cy="86" r="12" fill={O} />
      <circle cx="80" cy="86" r="12" fill={O} />
    </>
  ),
  places: (
    <>
      <path d="M60 104S28 74 28 48a32 32 0 0 1 64 0c0 26-32 56-32 56z" fill={O} />
      <circle cx="60" cy="48" r="11" fill={P} />
    </>
  ),
  pets: (
    <>
      <path d="M60 58c-15 0-28 18-28 30 0 9 8 11 15 9 5-1 9-3 13-3s8 2 13 3c7 2 15 0 15-9 0-12-13-30-28-30z" fill={O} />
      <ellipse cx="32" cy="50" rx="8" ry="11" fill={O} />
      <ellipse cx="48" cy="30" rx="8" ry="11" fill={O} />
      <ellipse cx="72" cy="30" rx="8" ry="11" fill={O} />
      <ellipse cx="88" cy="50" rx="8" ry="11" fill={O} />
    </>
  ),
  farm: (
    <>
      <path d="M60 96V56M28 96h64" />
      <path d="M60 62c-2-16-16-26-34-24 2 16 16 26 34 24z" fill={L} />
      <path d="M60 56c2-16 16-26 34-24-2 16-16 26-34 24z" fill={L} />
      <path d="M40 106h40" stroke={O} />
    </>
  ),
  tractor: (
    <>
      <path d="M50 52V28h28v24" fill={P} />
      <rect x="24" y="52" width="74" height="26" rx="4" fill={O} />
      <circle cx="44" cy="84" r="16" fill={P} />
      <circle cx="44" cy="84" r="4" fill={F} />
      <circle cx="88" cy="88" r="11" fill={P} />
    </>
  ),
  alerts: (
    <>
      <path d="M34 82V58a26 26 0 0 1 52 0v24l8 8H26z" fill={O} />
      <path d="M50 98a10 10 0 0 0 20 0M18 46c2-8 6-14 12-19M102 46c-2-8-6-14-12-19" />
    </>
  ),
  mic: (
    <>
      <rect x="46" y="16" width="28" height="52" rx="14" fill={O} />
      <path d="M32 56a28 28 0 0 0 56 0M60 84v16M46 100h28" />
    </>
  ),
  spark: (
    <>
      <path d="M54 22c4 20 12 28 32 32-20 4-28 12-32 32-4-20-12-28-32-32 20-4 28-12 32-32z" fill={O} />
      <path d="M90 18c1.5 7 4 9.5 11 11-7 1.5-9.5 4-11 11-1.5-7-4-9.5-11-11 7-1.5 9.5-4 11-11z" fill={L} />
    </>
  ),
  chat: (
    <>
      <path d="M18 24h54a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H40L26 74V62h-8a4 4 0 0 1-4-4V28a4 4 0 0 1 4-4z" fill={P} />
      <path d="M50 48h48a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4h-6v12L80 84H50a4 4 0 0 1-4-4V52a4 4 0 0 1 4-4z" fill={L} />
    </>
  ),
  shield: (
    <>
      <path d="M60 16 94 30v26c0 24-15 40-34 48-19-8-34-24-34-48V30z" fill={O} />
      <path d="m44 60 11 11 21-23" stroke={P} strokeWidth={6} />
    </>
  ),
  track: (
    <>
      <path d="M26 92c26 0 18-36 44-40" strokeDasharray="2 9" />
      <circle cx="26" cy="92" r="8" fill={L} />
      <path d="M84 72S66 54 66 40a18 18 0 0 1 36 0c0 14-18 32-18 32z" fill={O} />
      <circle cx="84" cy="40" r="6" fill={P} />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function CategoryIcon({
  name,
  size = 64,
  tone = "mint",
  className = "",
}: {
  name: IconName;
  size?: number;
  tone?: "mint" | "peach";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center ${tone === "mint" ? "bg-mint" : "bg-peach"} ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg viewBox="0 0 120 120" width={size * 0.74} height={size * 0.74}>
        <g fill="none" stroke={F} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round">
          {ICONS[name]}
        </g>
      </svg>
    </span>
  );
}

/* UI icons: rounded 24px line set, 2px stroke, currentColor. */

const UI = {
  check: <path d="M5 12.5 10 17.5 19 7.5" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-up": <path d="M12 19V5M6 11l6-6 6 6" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M6 12h12" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  zap: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  "thumbs-up": <path d="M7 10v11M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 7a2 2 0 0 1-1.9 1.4H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3l4-8a3 3 0 0 1 4 3.9z" />,
  panel: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4M7 17l3-3 3 2 4-4" />
    </>
  ),
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 8.7-8.7M16 6l3 3M14 8l2 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  "id-card": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M14.5 10h3.5M14.5 14h3.5" />
    </>
  ),
  "shield-check": (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2 .6 3 2.6 3 6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z" />
    </>
  ),
  "minus-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8" />
    </>
  ),
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.8 2.8L16.5 9.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type UiIconName = keyof typeof UI;

export function UiIcon({ name, size = 20, className = "" }: { name: UiIconName; size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {UI[name]}
    </svg>
  );
}
