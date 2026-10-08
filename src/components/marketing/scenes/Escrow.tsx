"use client";

import { useState } from "react";

type Stage = "agreed" | "held" | "paid" | "disputed";

const STATUS: Record<Stage, string> = {
  agreed: "You and Emeka agree ₦8,000 before he comes. Nothing has moved yet.",
  held: "Your ₦8,000 is locked with Oya. Emeka can see it's there, so he knows he'll be paid.",
  paid: "You said the tap is fixed, so Emeka gets paid. Not a minute before.",
  disputed: "Your money stays locked. Oya sends Emeka back, or finds someone else to finish the job.",
};

// Where the naira note sits at each stage.
const NOTE_AT: Record<Stage, [number, number]> = {
  agreed: [86, 128],
  held: [216, 112],
  paid: [372, 124],
  disputed: [216, 112],
};

const FOREST = "#10241B";

export function Escrow() {
  const [stage, setStage] = useState<Stage>("agreed");
  const [nx, ny] = NOTE_AT[stage];
  const fixed = stage === "paid";
  const locked = stage !== "paid";

  return (
    <div>
      <svg viewBox="0 0 480 240" className="block w-full" aria-hidden="true">
        <path d="M0 214h480" stroke={FOREST} strokeWidth="3" />

        {/* The path the money travels */}
        <path
          d="M110 110Q175 60 228 104"
          fill="none"
          stroke={FOREST}
          strokeWidth="2"
          strokeDasharray="3 7"
          opacity={stage === "agreed" ? 0.35 : 0.8}
        />
        <path
          d="M252 104Q305 60 370 110"
          fill="none"
          stroke={FOREST}
          strokeWidth="2"
          strokeDasharray="3 7"
          opacity={fixed ? 0.8 : 0.35}
        />

        {/* You */}
        <g fill={FOREST}>
          <circle cx="70" cy="90" r="17" />
          <path d="M52 112c12-7 24-7 36 0l4 62H48z" />
          <rect x="54" y="172" width="12" height="42" rx="4" />
          <rect x="74" y="172" width="12" height="42" rx="4" />
        </g>
        <text
          x="70"
          y="234"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={FOREST}
          fontFamily="Arial, sans-serif"
        >
          You
        </text>

        {/* Emeka, plumber, and the tap */}
        <g fill={FOREST}>
          <circle cx="400" cy="90" r="17" />
          <rect x="381" y="70" width="38" height="8" rx="4" />
          <path d="M382 112c12-7 24-7 36 0l4 62h-44z" />
          <rect x="384" y="172" width="12" height="42" rx="4" />
          <rect x="404" y="172" width="12" height="42" rx="4" />
        </g>
        <path d="M418 124l22-16" stroke={FOREST} strokeWidth="9" strokeLinecap="round" />
        <path d="M436 104l10-8 6 6-8 10z" fill="#B9AE98" />
        <path d="M480 120h-22v18" fill="none" stroke={FOREST} strokeWidth="8" strokeLinejoin="round" />
        {!fixed && (
          <>
            <path className="tap-drip" d="M458 146c0 0-4 6-4 9a4 4 0 0 0 8 0c0-3-4-9-4-9z" fill="#2E9E6B" />
            <path className="tap-drip tap-drip-2" d="M458 146c0 0-4 6-4 9a4 4 0 0 0 8 0c0-3-4-9-4-9z" fill="#2E9E6B" />
          </>
        )}
        <text
          x="400"
          y="234"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={FOREST}
          fontFamily="Arial, sans-serif"
        >
          Emeka
        </text>

        {/* The naira note: drawn before the box so it drops inside */}
        <g
          style={{
            transform: `translate(${nx}px, ${ny}px)`,
            transition: "transform 800ms cubic-bezier(0.2, 0.8, 0.2, 1)",
          }}
        >
          <rect width="48" height="28" rx="4" fill="#2E9E6B" stroke={FOREST} strokeWidth="2" />
          <text
            x="24"
            y="19"
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill="#FFFDF8"
            fontFamily="Arial, sans-serif"
          >
            ₦8k
          </text>
        </g>

        {/* Oya's lockbox */}
        <rect x="192" y="126" width="96" height="88" rx="12" fill={FOREST} />
        <rect x="192" y="126" width="96" height="14" rx="6" fill="#1A3428" />
        <path
          d={locked ? "M228 160v-10a12 12 0 0 1 24 0v10" : "M228 160v-10a12 12 0 0 1 24 0v-6"}
          fill="none"
          stroke="#FCE3CB"
          strokeWidth="5"
          style={{ transform: locked ? "none" : "translate(0, -8px)", transition: "transform 400ms" }}
        />
        <rect x="222" y="158" width="36" height="28" rx="6" fill="#F28C28" />
        <circle cx="240" cy="171" r="4" fill={FOREST} />
        <text
          x="240"
          y="234"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={FOREST}
          fontFamily="Arial, sans-serif"
        >
          Oya holds it
        </text>
      </svg>

      <div className="mt-4 rounded-[20px] bg-paper p-5">
        <p className="min-h-[3em] text-forest" aria-live="polite">
          {STATUS[stage]}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {stage === "agreed" && (
            <button
              type="button"
              onClick={() => setStage("held")}
              className="rounded-full bg-orange px-5 py-2.5 text-sm font-bold text-forest hover:bg-orange-soft"
            >
              Pay ₦8,000
            </button>
          )}
          {(stage === "held" || stage === "disputed") && (
            <>
              <button
                type="button"
                onClick={() => setStage("paid")}
                className="rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-cream hover:bg-forest-card"
              >
                It&apos;s fixed
              </button>
              {stage === "held" && (
                <button
                  type="button"
                  onClick={() => setStage("disputed")}
                  className="rounded-full border-2 border-hairline px-5 py-2 text-sm font-bold text-forest hover:border-forest"
                >
                  Something&apos;s wrong
                </button>
              )}
            </>
          )}
          {stage === "paid" && (
            <button
              type="button"
              onClick={() => setStage("agreed")}
              className="rounded-full border-2 border-hairline px-5 py-2 text-sm font-bold text-forest hover:border-forest"
            >
              Start again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
