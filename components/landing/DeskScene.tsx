"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";
import { UiIcon } from "../icons";

/*
 * An afternoon at home: a laptop, a phone on its stand, tea and puff-puff.
 * The request starts on the phone and moves to the laptop, where there's room to choose.
 */

type Stage = "phone" | "moving" | "laptop" | "booked";

// Made-up clinics for the example. `x` is where each one sits on the route strip (0–100).
const CLINICS = [
  { id: "ewet", name: "Ewet Family Clinic", meta: "Open till 10pm", km: "1.2 km", x: 46 },
  { id: "harmony", name: "Harmony Medical", meta: "Open 24 hours", km: "2.5 km", x: 70 },
  { id: "grace", name: "Grace Children's Clinic", meta: "Open till 8pm", km: "3.1 km", x: 92 },
] as const;

type ClinicId = (typeof CLINICS)[number]["id"];

type Fly = { from: DOMRect; to: DOMRect; arrived: boolean };

// How long each moment stays on screen before the scene moves on by itself.
const HOLD: Record<Stage, number> = { phone: 2600, moving: 750, laptop: 2600, booked: 5000 };

export function DeskScene() {
  const reduced = usePrefersReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);
  const phoneCardRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<Stage>("phone");
  const [picked, setPicked] = useState<ClinicId | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);
  const [inView, setInView] = useState(false);

  // Only play while the desk is on screen.
  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The scene plays itself: phone, hand-off, laptop, booked, then round again.
  useEffect(() => {
    if (reduced || !inView) return;
    const timer = window.setTimeout(() => {
      if (stage === "phone") handOff();
      else if (stage === "moving") {
        setFly(null);
        setStage("laptop");
      } else if (stage === "laptop") {
        setPicked("ewet");
        setStage("booked");
      } else {
        setPicked(null);
        setStage("phone");
      }
    }, HOLD[stage]);
    return () => window.clearTimeout(timer);
    // handOff only reads refs and sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, inView, reduced]);

  function relative(el: HTMLElement | null) {
    const scene = sceneRef.current;
    if (!el || !scene) return null;
    const s = scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return new DOMRect(r.left - s.left, r.top - s.top, r.width, r.height);
  }

  function handOff() {
    if (stage !== "phone") return;
    const from = relative(phoneCardRef.current);
    const to = relative(screenRef.current);
    if (!from || !to) {
      setStage("laptop");
      return;
    }
    setFly({ from, to, arrived: false });
    setStage("moving");
    requestAnimationFrame(() => requestAnimationFrame(() => setFly((f) => (f ? { ...f, arrived: true } : f))));
  }

  // Clicking is optional: it just skips ahead.
  function book(id: ClinicId) {
    setPicked(id);
    setStage("booked");
  }

  // With reduced motion, show how it ends instead of playing it.
  const shownStage: Stage = reduced ? "booked" : stage;
  const shownPicked: ClinicId | null = reduced ? "ewet" : picked;
  const clinic = CLINICS.find((c) => c.id === shownPicked) ?? null;
  const onLaptop = shownStage === "laptop" || shownStage === "booked";

  return (
    <div>
      <div
        ref={sceneRef}
        className="relative h-[700px] overflow-hidden rounded-[32px] bg-peach md:h-[640px]"
      >
        <Room />

        {/* Laptop */}
        <div className="absolute bottom-[41%] left-1/2 w-[92%] -translate-x-1/2 md:bottom-[30%] md:w-[min(620px,56%)]">
          <div className="rounded-t-[18px] bg-forest p-[2.2%] pb-[3%]">
            <div ref={screenRef} className="relative aspect-[5/3] overflow-hidden rounded-[8px] bg-paper">
              {onLaptop ? (
                <LaptopScreen stage={shownStage} picked={shownPicked} onBook={book} />
              ) : (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.025em] text-orange md:text-[56px]">
                      oya
                    </p>
                    <p className="mt-2 text-[11px] text-body md:text-[15px]">Your chats follow you here.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="relative -mx-[5%] h-[10px] rounded-b-[12px] bg-forest-edge md:h-[14px]">
            <span className="absolute left-1/2 top-0 h-[4px] w-[16%] -translate-x-1/2 rounded-b-[6px] bg-forest" />
          </div>
        </div>

        {/* Phone on its stand */}
        <div className={`absolute bottom-[3%] left-[4%] w-[116px] md:bottom-[5%] md:left-[7%] md:w-[172px] ${shownStage === "booked" && !reduced ? "phone-buzz" : ""}`}>
          <div className="relative aspect-[9/18] rounded-[22px] bg-forest p-[6px] shadow-floating md:rounded-[28px] md:p-[8px]">
            <div className="flex h-full flex-col overflow-hidden rounded-[17px] bg-chat-bg md:rounded-[21px]">
              <div className="flex items-center gap-1.5 bg-forest px-2.5 pb-1.5 pt-3 md:gap-2 md:px-3 md:pt-4">
                <span aria-hidden="true" className="grid size-4 place-items-center rounded-full bg-orange font-display text-[9px] font-extrabold text-forest md:size-6 md:text-[12px]">
                  o
                </span>
                <span className="text-[10px] font-bold text-cream md:text-[13px]">Oya</span>
              </div>

              {shownStage === "booked" && clinic && (
                <div className="animate-rise mx-1.5 mt-1.5 rounded-[10px] bg-paper p-1.5 shadow-card md:mx-2 md:mt-2 md:rounded-[12px] md:p-2">
                  <p className="text-[9px] font-bold text-deep-leaf md:text-[11px]">Booked, 4:30 pm</p>
                  <p className="text-[9px] leading-tight text-forest md:text-[11px]">{clinic.name}. Directions sent.</p>
                </div>
              )}

              <div className="flex flex-1 flex-col justify-end gap-1 p-1.5 text-[9.5px] leading-snug text-forest md:gap-1.5 md:p-2 md:text-[12px]">
                <p className="ml-auto max-w-[88%] rounded-[10px] rounded-br-[3px] bg-mint px-2 py-1.5">
                  My son has a fever. Which clinic is open now?
                </p>
                <div ref={phoneCardRef} className="mr-auto max-w-[92%] rounded-[10px] rounded-bl-[3px] bg-paper px-2 py-1.5">
                  {shownStage === "phone" || shownStage === "moving" ? (
                    <>
                      <p>3 clinics are open near you. Want to compare them on your laptop?</p>
                      <button
                        type="button"
                        onClick={handOff}
                        className="mt-1.5 w-full rounded-[8px] bg-forest py-1 text-[9px] font-bold text-cream md:text-[11px]"
                      >
                        Open on laptop
                      </button>
                    </>
                  ) : (
                    <p>Opened on your laptop. Pick one there.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Stand */}
          <svg aria-hidden="true" viewBox="0 0 100 20" className="-mt-1 block w-full">
            <path d="M14 0h72l10 20H4z" fill="#3A5A4B" />
          </svg>
        </div>

        {/* The request travelling from phone to laptop */}
        {fly && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute z-20 grid place-items-center rounded-[10px] bg-paper text-center shadow-floating transition-all duration-700 ease-[var(--ease-oya)]"
            style={
              fly.arrived
                ? { left: fly.to.x, top: fly.to.y, width: fly.to.width, height: fly.to.height, opacity: 1 }
                : { left: fly.from.x, top: fly.from.y, width: fly.from.width, height: fly.from.height, opacity: 1 }
            }
          >
            <p className="font-display text-sm font-bold text-forest">3 clinics</p>
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-body" aria-live="polite">
        {shownStage === "booked"
          ? "Booked on the laptop, confirmed on the phone. The clinics in this example are made up."
          : onLaptop
            ? "On the laptop there's room to compare."
            : "It starts with a message on the phone."}
      </p>
    </div>
  );
}

function LaptopScreen({
  stage,
  picked,
  onBook,
}: {
  stage: Stage;
  picked: ClinicId | null;
  onBook: (id: ClinicId) => void;
}) {
  const clinic = CLINICS.find((c) => c.id === picked);
  return (
    <div className="animate-rise flex h-full flex-col p-[3.5%]">
      <p className="font-display text-[13px] font-bold leading-tight text-forest md:text-[22px]">
        {stage === "booked" && clinic ? `You're booked at ${clinic.name}` : "3 clinics open now, near home"}
      </p>

      <ul className="mt-[2.5%] grid flex-1 grid-cols-3 gap-[2.5%]">
        {CLINICS.map((c, i) => {
          const chosen = c.id === picked;
          return (
            <li
              key={c.id}
              className={`flex flex-col rounded-[8px] p-[7%] transition-colors duration-300 md:rounded-[14px] ${
                chosen ? "bg-forest text-cream" : i % 2 ? "bg-peach text-forest" : "bg-mint text-forest"
              }`}
            >
              <p className="font-display text-[11px] font-bold leading-tight md:text-[17px]">{c.name}</p>
              <p className="mt-1 text-[9.5px] leading-tight opacity-80 md:text-[13.5px]">
                {c.meta}
                <br />
                {c.km}
              </p>
              <button
                type="button"
                onClick={() => onBook(c.id)}
                disabled={stage === "booked"}
                aria-pressed={chosen}
                aria-label={chosen ? `Booked: ${c.name}` : `Book ${c.name}`}
                className={`mt-auto flex items-center justify-center gap-1 rounded-full py-1 text-[9.5px] font-bold transition-colors md:py-1.5 md:text-[13px] ${
                  chosen
                    ? "bg-orange text-forest"
                    : stage === "booked"
                      ? "bg-paper/60 text-forest/60"
                      : "bg-forest text-cream hover:bg-forest-card"
                }`}
              >
                {chosen ? (
                  <>
                    <UiIcon name="check" size={12} /> 4:30 pm
                  </>
                ) : (
                  "Book"
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Route from home to the chosen clinic */}
      <svg viewBox="0 0 100 12" preserveAspectRatio="none" className="mt-[3%] h-[14%] w-full" aria-hidden="true">
        <path d="M2 6H98" stroke="#E4DCCB" strokeWidth="0.8" strokeDasharray="1 1.6" />
        {clinic && (
          <path
            d={`M4 6H${clinic.x}`}
            stroke="#F28C28"
            strokeWidth="1.6"
            strokeLinecap="round"
            pathLength={1}
            className="route-draw"
          />
        )}
        <circle cx="4" cy="6" r="2.6" fill="#2E9E6B" />
        {CLINICS.map((c) => (
          <circle key={c.id} cx={c.x} cy="6" r={c.id === picked ? 2.6 : 1.6} fill={c.id === picked ? "#10241B" : "#B9AE98"} />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] font-bold text-body md:text-[12px]">
        <span>Home</span>
        <span>{clinic ? `${clinic.km}, about 10 minutes by keke` : "Pick one to see the way"}</span>
      </div>
    </div>
  );
}

/** The room: wall, window, clock, table, tea and puff-puff. */
function Room() {
  return (
    <div aria-hidden="true">
      {/* Arched window with the street outside */}
      <div className="absolute right-[5%] top-[8%] hidden h-[40%] w-[15%] overflow-hidden rounded-t-full border-[10px] border-b-[14px] border-paper bg-mint md:block">
        <svg viewBox="0 0 100 120" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
          <g fill="#10241B" opacity=".18">
            <rect x="0" y="70" width="30" height="50" />
            <rect x="34" y="52" width="26" height="68" />
            <rect x="66" y="78" width="34" height="42" />
          </g>
          <path d="M78 120c2-24-4-44 4-66" stroke="#10241B" strokeWidth="4" fill="none" opacity=".35" />
          <g fill="#10241B" opacity=".35">
            <path d="M82 54q-20-12-40 2 20-8 40-1z" />
            <path d="M82 54q20-14 40 0-20-6-40 2z" />
            <path d="M82 54q-6-22 12-30-12 12-10 31z" />
          </g>
        </svg>
        <span className="absolute inset-y-0 left-1/2 w-[6px] -translate-x-1/2 bg-paper" />
      </div>
      <div className="absolute right-[3.8%] top-[47%] hidden h-[3%] w-[17.4%] rounded-[4px] bg-hairline md:block" />

      {/* Wall clock, 3:58 */}
      <svg viewBox="0 0 60 60" className="absolute right-[6%] top-[5%] w-[52px] md:left-[8%] md:right-auto md:top-[10%] md:w-[84px]">
        <circle cx="30" cy="30" r="27" fill="#FFFDF8" stroke="#10241B" strokeWidth="4" />
        <path d="M30 30V17M30 30l-11 1" stroke="#10241B" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="30" cy="30" r="2.6" fill="#F28C28" />
      </svg>

      {/* Table */}
      <div className="absolute inset-x-0 bottom-0 h-[41%] bg-orange-soft md:h-[30%]">
        <div className="absolute inset-x-0 top-0 h-[10px] bg-[#F9C48F]" />
        <div className="absolute inset-x-0 bottom-0 h-[16%] bg-ember/80" />
      </div>

      {/* Charger cable */}
      <svg viewBox="0 0 300 80" preserveAspectRatio="none" className="absolute bottom-[3%] left-[10%] h-[10%] w-[30%] md:left-[13%]">
        <path d="M10 10C60 70 120 10 180 50s90 10 110 20" fill="none" stroke="#FFFDF8" strokeWidth="4" strokeLinecap="round" />
      </svg>

      {/* Tea */}
      <svg viewBox="0 0 90 110" className="absolute bottom-[10%] left-[38%] w-[58px] md:bottom-[9%] md:left-auto md:right-[25%] md:w-[88px]">
        <path className="steam" d="M34 34c-8-10 8-14 0-26" stroke="#FFFDF8" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path className="steam steam-2" d="M52 36c-8-10 8-14 0-26" stroke="#FFFDF8" strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M14 44h60v38a20 20 0 0 1-20 20H34a20 20 0 0 1-20-20z" fill="#2E9E6B" />
        <path d="M74 54h6a10 10 0 0 1 0 20h-6" fill="none" stroke="#2E9E6B" strokeWidth="7" />
        <rect x="14" y="44" width="60" height="7" fill="#1D6B47" />
      </svg>

      {/* Puff-puff */}
      <svg viewBox="0 0 200 90" className="absolute bottom-[7%] right-[4%] w-[132px] md:right-[5%] md:w-[210px]">
        <ellipse cx="100" cy="72" rx="94" ry="16" fill="#FFFDF8" />
        <ellipse cx="100" cy="68" rx="70" ry="9" fill="#F1EADC" />
        {[
          [62, 54, 20], [100, 50, 22], [138, 54, 20], [80, 34, 19], [120, 34, 19], [100, 18, 18],
        ].map(([cx, cy, r]) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={r} fill="#E0862B" />
            <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.35} fill="#F7B26E" />
            <circle cx={cx + r * 0.3} cy={cy + r * 0.1} r="1.6" fill="#FFFDF8" />
          </g>
        ))}
      </svg>
    </div>
  );
}
