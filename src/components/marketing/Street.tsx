"use client";

import { useState, type Dispatch, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";
import { HERO_ASK_BY_ID } from "@/lib/marketing/content";

/*
 * Dusk on a street in Uyo. Every building is somebody who needs something:
 * point at it (or tab to it) to hear what they'd ask Oya, click to ask it.
 */

const NEAR = "#10241B";
const FAR = "#24432F";
const LIT = "#F7B26E";
const DARK_WINDOW = "#1E3A2D";

const FAR_BLOCKS: [number, number, number, number][] = [
  [0, 236, 96, 100],
  [88, 254, 70, 80],
  [150, 214, 64, 120],
  [468, 226, 84, 110],
  [546, 246, 70, 90],
  [722, 206, 58, 130],
  [770, 240, 92, 96],
  [978, 218, 54, 118],
  [1160, 230, 84, 106],
  [1362, 204, 78, 132],
];

// Where each speech bubble points, in scene coordinates.
const ANCHORS: Record<string, [number, number]> = {
  power: [130, 204],
  plumber: [426, 118],
  generator: [500, 284],
  price: [660, 222],
  outing: [800, 128],
  fuel: [915, 252],
  house: [1095, 198],
  pharmacy: [1299, 150],
  farm: [1398, 180],
};

const BUBBLE_W = 300;
const BUBBLE_H = 150;

export function Street({ onAsk, className = "" }: { onAsk: (id: string) => void; className?: string }) {
  const [active, setActive] = useState<string | null>(null);

  const spot = { active, setActive, onAsk };

  const bubble = active ? ANCHORS[active] : null;

  return (
    <svg
      viewBox="0 0 1440 360"
      preserveAspectRatio="xMidYMax slice"
      overflow="visible"
      role="group"
      aria-label="A street at dusk. Each building is something people ask Oya about."
      className={`street ${className}`}
    >
      {/* Far layer */}
      <g fill={FAR} aria-hidden="true">
        {FAR_BLOCKS.map(([x, y, w, h]) => (
          <rect key={x} x={x} y={y} width={w} height={h} />
        ))}
        <path d="M1104 330 1112 70 1120 330z" />
      </g>
      <circle cx="1112" cy="66" r="4" fill="#F28C28" className="blink" aria-hidden="true" />

      {/* Wires between poles */}
      <g fill="none" stroke={NEAR} strokeWidth="2" aria-hidden="true">
        <path d="M0 150Q280 196 534 128" />
        <path d="M0 162Q280 208 534 140" />
        <path d="M586 128Q900 188 1214 128" />
        <path d="M586 140Q900 200 1214 140" />
        <path d="M1266 128Q1360 160 1440 146" />
      </g>

      {/* Birds on the wire fly off when you get close, then come back */}
      <g className="birds-perch" aria-hidden="true">
        <rect x="722" y="120" width="130" height="50" fill="transparent" />
        <g className="birds" fill={NEAR}>
          <ellipse cx="742" cy="152" rx="6" ry="4.5" />
          <circle cx="747" cy="148" r="2.6" />
          <ellipse cx="770" cy="154" rx="6" ry="4.5" />
          <circle cx="765" cy="150" r="2.6" />
          <ellipse cx="830" cy="157" rx="6" ry="4.5" />
          <circle cx="835" cy="153" r="2.6" />
        </g>
      </g>

      {/* Ground and poles */}
      <g fill={NEAR} aria-hidden="true">
        <rect x="0" y="328" width="1440" height="32" />
        <rect x="556" y="112" width="8" height="218" />
        <rect x="530" y="124" width="60" height="6" rx="2" />
        <rect x="1212" y="112" width="8" height="218" />
        <rect x="1188" y="124" width="58" height="6" rx="2" />
      </g>

      {/* Bungalow with the light gone */}
      <Hotspot {...spot} id="power" hit={[24, 196, 214, 134]}>
        <g fill={NEAR}>
          <path d="M30 252 130 204 232 252z" />
          <rect x="42" y="250" width="178" height="80" />
        </g>
        <rect className="lamp" x="70" y="274" width="30" height="24" fill={DARK_WINDOW} />
        <rect className="lamp" x="162" y="274" width="30" height="24" fill={DARK_WINDOW} />
        <rect className="lamp" x="118" y="290" width="26" height="40" fill={DARK_WINDOW} />
      </Hotspot>

      {/* Storey building with a leaking water tank */}
      <Hotspot {...spot} id="plumber" hit={[248, 112, 236, 218]}>
        <g fill={NEAR}>
          <rect x="252" y="162" width="226" height="12" />
          <rect x="260" y="172" width="210" height="158" />
          <rect x="404" y="128" width="46" height="34" rx="8" />
          <rect x="410" y="118" width="34" height="12" rx="4" />
        </g>
        <rect x="285" y="196" width="40" height="34" fill={LIT} />
        <rect x="345" y="196" width="40" height="34" fill={DARK_WINDOW} />
        <rect x="405" y="196" width="40" height="34" fill={LIT} opacity=".8" />
        <rect x="285" y="260" width="40" height="34" fill={DARK_WINDOW} />
        <rect x="345" y="260" width="40" height="34" fill={LIT} />
        <rect x="405" y="260" width="40" height="34" fill={DARK_WINDOW} />
        <path className="drip" d="M440 164c0 0-5 7-5 10a5 5 0 0 0 10 0c0-3-5-10-5-10z" fill="#DCEFE3" />
        <path className="drip drip-2" d="M440 164c0 0-5 7-5 10a5 5 0 0 0 10 0c0-3-5-10-5-10z" fill="#DCEFE3" />
      </Hotspot>

      {/* Generator that won't start */}
      <Hotspot {...spot} id="generator" hit={[474, 262, 56, 68]}>
        <g className="shake" fill={NEAR}>
          <rect x="482" y="304" width="36" height="24" rx="3" />
          <rect x="508" y="292" width="5" height="14" />
          <rect x="487" y="310" width="12" height="6" rx="1" fill={DARK_WINDOW} />
        </g>
        <circle className="puff" cx="510" cy="286" r="6" fill="#C5D6CC" />
        <circle className="puff puff-2" cx="510" cy="286" r="6" fill="#C5D6CC" />
      </Hotspot>

      {/* Kiosk running on generator */}
      <Hotspot {...spot} id="price" hit={[586, 218, 148, 112]}>
        <g fill={NEAR}>
          <rect x="600" y="260" width="120" height="70" />
          <rect x="620" y="226" width="80" height="18" rx="2" />
        </g>
        <rect className="brighten" x="614" y="274" width="92" height="30" fill={LIT} />
        <g fill={NEAR} opacity=".55">
          <rect x="622" y="284" width="8" height="20" rx="2" />
          <rect x="634" y="288" width="8" height="16" rx="2" />
          <rect x="660" y="282" width="16" height="22" rx="2" />
          <rect x="684" y="290" width="14" height="14" rx="2" />
        </g>
        <text
          x="660"
          y="239"
          textAnchor="middle"
          fontSize="10"
          fontWeight="700"
          fill="#C5D6CC"
          fontFamily="Arial, sans-serif"
        >
          RECHARGE
        </text>
        <path d="M592 262h136l-10-18H602z" fill="#F28C28" />
        <path
          d="M612 244h12l-4 18h-14zM640 244h12v18h-12zM668 244h12l2 18h-12zM696 244h12l6 18h-12z"
          fill="#FCE3CB"
          opacity=".85"
        />
      </Hotspot>

      {/* Palm tree */}
      <Hotspot {...spot} id="outing" hit={[712, 112, 160, 218]}>
        <path d="M792 330c4-50-8-100 8-150" fill="none" stroke={NEAR} strokeWidth="10" strokeLinecap="round" />
        <g className="sway" fill={NEAR}>
          <path d="M800 182q-40-24-82 6 42-18 82-2z" />
          <path d="M800 182q-28-44-70-42 40 6 70 46z" />
          <path d="M800 182q8-48 44-62-28 24-40 66z" />
          <path d="M800 182q44-26 86-4-44-8-84 8z" />
          <path d="M800 182q40 4 64 40-30-28-66-36z" />
          <path d="M800 182q-34 6-56 44 26-30 58-40z" />
        </g>
      </Hotspot>

      {/* Bungalow with a TO LET sign */}
      <Hotspot {...spot} id="house" hit={[994, 190, 204, 140]}>
        <g fill={NEAR}>
          <path d="M1000 242 1090 198 1190 242z" />
          <rect x="1010" y="240" width="170" height="90" />
          <path d="M1140 214a15 15 0 0 0 28-8z" />
          <rect x="1152" y="210" width="4" height="16" />
        </g>
        <rect x="1040" y="262" width="34" height="26" fill={LIT} />
        <rect className="lamp" x="1120" y="262" width="34" height="26" fill={DARK_WINDOW} />
        <g className="pop">
          <rect x="1194" y="298" width="4" height="32" fill={NEAR} />
          <rect x="1176" y="282" width="40" height="18" rx="2" fill="#FAF6EE" />
          <text
            x="1196"
            y="295"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill={NEAR}
            fontFamily="Arial, sans-serif"
          >
            TO LET
          </text>
        </g>
      </Hotspot>

      {/* Keke heading home */}
      <Hotspot {...spot} id="fuel" hit={[858, 244, 132, 94]}>
        <g className="drive">
          <path className="beam" d="M966 300 1060 280v44z" fill={LIT} fillOpacity=".35" />
          <g fill={NEAR}>
            <path d="M866 328v-36c2-20 14-28 34-28h48c10 0 14 8 15 18l2 46z" />
            <rect x="870" y="254" width="94" height="12" rx="5" />
          </g>
          <path d="M884 274h52v24h-56z" fill={FAR} />
          <circle cx="884" cy="330" r="11" fill={NEAR} />
          <circle cx="884" cy="330" r="4" fill={DARK_WINDOW} />
          <circle cx="950" cy="330" r="11" fill={NEAR} />
          <circle cx="950" cy="330" r="4" fill={DARK_WINDOW} />
          <circle cx="964" cy="302" r="4.5" fill={LIT} />
        </g>
      </Hotspot>

      {/* Taller block with a pharmacy on the ground floor */}
      <Hotspot {...spot} id="pharmacy" hit={[1232, 142, 134, 188]}>
        <rect x="1240" y="150" width="118" height="180" fill={NEAR} />
        {[172, 222, 272].map((y, row) =>
          [1258, 1308].map((x, col) => (
            <rect
              key={`${x}-${y}`}
              className={(row + col) % 3 === 0 ? undefined : "lamp"}
              x={x}
              y={y}
              width="30"
              height="26"
              fill={(row + col) % 3 === 0 ? LIT : DARK_WINDOW}
            />
          )),
        )}
        <circle className="glow" cx="1299" cy="314" r="16" fill="#2E9E6B" opacity=".35" />
        <path d="M1295 304h8v6h6v8h-6v6h-8v-6h-6v-8h6z" fill="#2E9E6B" />
      </Hotspot>

      {/* Mango tree */}
      <Hotspot {...spot} id="farm" hit={[1326, 174, 114, 156]}>
        <rect x="1392" y="258" width="12" height="72" fill={NEAR} />
        <g fill={NEAR}>
          <circle cx="1398" cy="226" r="46" />
          <circle cx="1434" cy="252" r="38" />
          <circle cx="1362" cy="256" r="34" />
        </g>
        <ellipse cx="1372" cy="262" rx="5" ry="7" fill="#F28C28" />
        <ellipse cx="1418" cy="240" rx="5" ry="7" fill="#F28C28" />
        <ellipse className="fall" cx="1396" cy="268" rx="5" ry="7" fill="#F28C28" />
      </Hotspot>

      {/* What the person inside would ask */}
      {active && bubble && <SpeechBubble anchor={bubble} text={HERO_ASK_BY_ID[active].ask} />}
    </svg>
  );
}

type HotspotProps = {
  id: string;
  hit: [number, number, number, number];
  active: string | null;
  setActive: Dispatch<SetStateAction<string | null>>;
  onAsk: (id: string) => void;
  children: ReactNode;
};

function Hotspot({ id, hit, active, setActive, onAsk, children }: HotspotProps) {
  const [x, y, w, h] = hit;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Ask Oya: ${HERO_ASK_BY_ID[id].ask}`}
      className="hotspot cursor-pointer outline-none"
      data-active={active === id ? "" : undefined}
      onMouseEnter={() => setActive(id)}
      onMouseLeave={() => setActive((a) => (a === id ? null : a))}
      onFocus={() => setActive(id)}
      onBlur={() => setActive((a) => (a === id ? null : a))}
      onClick={() => onAsk(id)}
      onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAsk(id);
        }
      }}
    >
      <rect className="hit" x={x} y={y} width={w} height={h} rx="10" fill="transparent" />
      {children}
    </g>
  );
}

function SpeechBubble({ anchor, text }: { anchor: [number, number]; text: string }) {
  const [ax, ay] = anchor;
  const x = Math.min(Math.max(ax - BUBBLE_W / 2, 8), 1440 - BUBBLE_W - 8);
  const y = ay - BUBBLE_H - 10;
  return (
    <foreignObject
      x={x}
      y={y}
      width={BUBBLE_W}
      height={BUBBLE_H + 10}
      className="pointer-events-none"
      aria-hidden="true"
    >
      <div className="flex h-full flex-col justify-end">
        <div className="animate-rise relative rounded-[18px] bg-paper px-4 py-3 shadow-floating">
          <p className="text-[17px] leading-snug text-forest">“{text}”</p>
          <p className="mt-1.5 text-[13px] font-bold text-deep-leaf">Click to ask Oya</p>
          <span
            className="absolute -bottom-[7px] size-4 rotate-45 bg-paper"
            style={{ left: Math.min(Math.max(ax - x - 8, 18), BUBBLE_W - 34) }}
          />
        </div>
      </div>
    </foreignObject>
  );
}
