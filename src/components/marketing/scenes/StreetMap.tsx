"use client";

import { useState } from "react";

type Layer = "light" | "fuel" | "roads";

const LAYERS: { id: Layer; label: string; note: string }[] = [
  {
    id: "light",
    label: "Light",
    note: "Back on for most of Ewet Housing since 6:12pm. Block C is still off. Heard from 23 neighbours.",
  },
  {
    id: "fuel",
    label: "Fuel",
    note: "The station on Oron Road has fuel and a short queue. The one by the market has a long one. Heard from 8 drivers.",
  },
  {
    id: "roads",
    label: "Roads",
    note: "The junction near the market filling station is flooded. Oya sends you the long way round. Heard from 5 people.",
  },
];

// Houses along the streets. `off` marks Block C, still without light.
const HOUSES: { x: number; y: number; off?: boolean }[] = [
  { x: 40, y: 50 },
  { x: 84, y: 50 },
  { x: 40, y: 96 },
  { x: 84, y: 96 },
  { x: 196, y: 50 },
  { x: 240, y: 50 },
  { x: 284, y: 50 },
  { x: 196, y: 96 },
  { x: 284, y: 96 },
  { x: 404, y: 50 },
  { x: 404, y: 96 },
  { x: 40, y: 212, off: true },
  { x: 84, y: 212, off: true },
  { x: 40, y: 258, off: true },
  { x: 196, y: 276 },
  { x: 250, y: 276 },
  { x: 304, y: 276 },
  { x: 404, y: 212 },
  { x: 404, y: 258 },
];

const PAPER = "#FFFDF8";
const FOREST = "#10241B";

export function StreetMap() {
  const [layer, setLayer] = useState<Layer>("light");
  const current = LAYERS.find((l) => l.id === layer) ?? LAYERS[0];
  const dim = (l: Layer) => ({ opacity: layer === l ? 1 : 0.12, transition: "opacity 350ms" });

  return (
    <div>
      <div role="group" aria-label="What to show on the map" className="mb-4 flex gap-2">
        {LAYERS.map((l) => (
          <button
            key={l.id}
            type="button"
            aria-pressed={layer === l.id}
            onClick={() => setLayer(l.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              layer === l.id ? "bg-forest text-cream" : "bg-paper text-forest hover:bg-cream"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <svg viewBox="0 0 480 320" className="block w-full rounded-[20px]" aria-hidden="true">
        <rect width="480" height="320" fill="#F1EADC" />

        {/* Streets */}
        <g stroke={PAPER} strokeWidth="26" strokeLinecap="round">
          <path d="M-20 160h520" />
          <path d="M140 -20v360" />
          <path d="M350 -20v360" />
        </g>
        <g stroke="#E4DCCB" strokeWidth="2" strokeDasharray="8 8">
          <path d="M-20 160h520M140 -20v360M350 -20v360" />
        </g>
        <text
          x="460"
          y="150"
          textAnchor="end"
          fontSize="11"
          fontWeight="700"
          fill="#6B756F"
          fontFamily="Arial, sans-serif"
        >
          Oron Road
        </text>
        <text x="20" y="306" fontSize="11" fontWeight="700" fill="#6B756F" fontFamily="Arial, sans-serif">
          Block C
        </text>

        {/* Market block */}
        <rect x="186" y="196" width="128" height="40" rx="8" fill="#FCE3CB" />
        <text
          x="250"
          y="221"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={FOREST}
          fontFamily="Arial, sans-serif"
        >
          Market
        </text>

        {/* Houses, with light reports on top */}
        {HOUSES.map((h) => (
          <rect key={`${h.x}-${h.y}`} x={h.x - 16} y={h.y - 16} width="32" height="32" rx="6" fill={FOREST} />
        ))}
        <g style={dim("light")}>
          {HOUSES.map((h, i) =>
            h.off ? (
              <circle key={i} cx={h.x} cy={h.y} r="6" fill="none" stroke="#B9AE98" strokeWidth="2" />
            ) : (
              <g key={i}>
                {i % 4 === 0 && layer === "light" && (
                  <circle className="map-ping" cx={h.x} cy={h.y} r="7" fill="#F28C28" />
                )}
                <circle cx={h.x} cy={h.y} r="6" fill="#F7B26E" />
              </g>
            ),
          )}
        </g>

        {/* Fuel stations and their queues */}
        <g style={dim("fuel")}>
          <g>
            {layer === "fuel" && <circle className="map-ping" cx="378" cy="138" r="12" fill="#2E9E6B" />}
            <rect x="366" y="126" width="24" height="24" rx="6" fill="#2E9E6B" />
            <path d="M373 132h8v12h-8zM381 136h3v6" stroke={PAPER} strokeWidth="2" fill="none" />
            {[324, 312].map((x) => (
              <rect key={x} x={x} y="152" width="10" height="7" rx="2" fill={FOREST} />
            ))}
          </g>
          <g>
            <rect x="100" y="126" width="24" height="24" rx="6" fill="#F28C28" />
            <path d="M107 132h8v12h-8zM115 136h3v6" stroke={PAPER} strokeWidth="2" fill="none" />
            {[86, 74, 62, 50, 38, 26, 14, 2].map((x) => (
              <rect key={x} x={x} y="152" width="10" height="7" rx="2" fill={FOREST} />
            ))}
          </g>
        </g>

        {/* Flooded junction and the way round */}
        <g style={dim("roads")}>
          <rect x="118" y="132" width="44" height="58" rx="10" fill="#DCEFE3" />
          <path
            d="M124 150q6-5 12 0t12 0 12 0M124 166q6-5 12 0t12 0 12 0"
            stroke="#1D6B47"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M60 186V300H350V172"
            stroke="#F28C28"
            strokeWidth="4"
            strokeDasharray="2 8"
            strokeLinecap="round"
            fill="none"
          />
          {layer === "roads" && <circle className="map-ping" cx="140" cy="160" r="12" fill="#F28C28" />}
        </g>

        {/* You */}
        <g>
          <path
            d="M250 136s-12-12-12-21a12 12 0 0 1 24 0c0 9-12 21-12 21z"
            fill="#F28C28"
            stroke={FOREST}
            strokeWidth="2"
          />
          <circle cx="250" cy="115" r="4" fill={FOREST} />
          <text x="268" y="122" fontSize="11" fontWeight="700" fill={FOREST} fontFamily="Arial, sans-serif">
            You
          </text>
        </g>
      </svg>

      <p key={layer} className="animate-rise mt-4 rounded-[20px] bg-paper px-5 py-4 text-forest" aria-live="polite">
        {current.note}
      </p>
    </div>
  );
}
