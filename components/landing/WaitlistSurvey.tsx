"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { joinWaitlist } from "@/app/actions/waitlist";
import {
  LANGUAGES,
  MAX_NEEDS,
  NEEDS,
  WAYS,
  validateContact,
  type LanguageId,
  type NeedId,
  type WaitlistInput,
  type WayId,
} from "@/lib/waitlist";
import { UiIcon } from "../icons";

const STEPS = [
  { title: "What do you chase the most?", hint: `Pick up to ${MAX_NEEDS}. This decides what Oya learns first.` },
  { title: "How do you sort it out today?", hint: "Pick all that apply." },
  { title: "If Oya could sort one thing for you this week, what would it be?", hint: "Say it the way you'd say it to a friend." },
  { title: "Where should we find you?", hint: "We'll tell you when Oya reaches your area. No spam, ever." },
];

type Field = keyof WaitlistInput;

const inputClass =
  "mt-2 w-full rounded-[18px] border-2 bg-paper px-4 py-3 text-forest outline-none transition-colors placeholder:text-muted focus:border-forest";

export function WaitlistSurvey() {
  const [step, setStep] = useState(0);
  const [needs, setNeeds] = useState<NeedId[]>([]);
  const [ways, setWays] = useState<WayId[]>([]);
  const [firstAsk, setFirstAsk] = useState("");
  const [languages, setLanguages] = useState<LanguageId[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [area, setArea] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [error, setError] = useState<{ field?: Field; message: string } | null>(null);
  const [done, setDone] = useState<{ status: "joined" | "already"; areaCount: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const last = step === STEPS.length - 1;

  function toggle<T extends string>(set: (update: (list: T[]) => T[]) => void, id: T, max?: number) {
    setError(null);
    set((list) => {
      if (list.includes(id)) return list.filter((x) => x !== id);
      if (!max || list.length < max) return [...list, id];
      return [...list.slice(1), id];
    });
  }

  function go(next: number) {
    setError(null);
    setStep(next);
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === 0 && needs.length === 0) {
      setError({ field: "needs", message: "Pick at least one." });
      return;
    }
    if (!last) {
      go(step + 1);
      return;
    }
    const invalid = validateContact({ name, email, whatsapp, area, consent });
    if (invalid) {
      setError({ field: invalid.field, message: invalid.error });
      document.getElementById(`wl-${invalid.field}`)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await joinWaitlist({ name, email, whatsapp, area, needs, ways, firstAsk, languages, consent, website });
      if (result.ok) setDone({ status: result.status, areaCount: result.areaCount });
      else setError({ field: result.field, message: result.error });
    });
  }

  if (done) {
    const first = name.trim().split(/\s+/)[0];
    const others = done.areaCount - 1;
    return (
      <div role="status" className="animate-rise rounded-card border border-hairline bg-paper p-8 sm:p-10">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-leaf text-paper">
          <UiIcon name="check" size={28} />
        </span>
        <h3 className="t-h2 mt-6 text-forest">
          {done.status === "joined" ? `You're on the list, ${first}.` : `You're already on the list, ${first}.`}
        </h3>
        <p className="t-body-lg mt-3 text-body">
          {others > 0
            ? `${others} other ${others === 1 ? "person" : "people"} in ${area.trim()} ${others === 1 ? "is" : "are"} waiting too. The more of you there are, the sooner Oya comes.`
            : `You're the first from ${area.trim()}. Tell your neighbours: the areas with the most people waiting get Oya first.`}
        </p>
        {done.status === "joined" && (
          <>
            <p className="mt-6 text-sm font-bold text-deep-leaf">What you told us you chase</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {needs.map((n) => (
                <li key={n} className="rounded-full bg-mint px-3 py-1.5 text-sm font-bold text-forest">
                  {NEEDS.find((o) => o.id === n)?.label}
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-8 font-display text-2xl font-extrabold text-forest">Oya. Sort am.</p>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <form noValidate onSubmit={submit} className="relative rounded-card border border-hairline bg-paper p-6 sm:p-10">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-forest" : "bg-hairline"}`} />
          ))}
        </div>
        <p className="text-sm font-bold text-forest">
          {step + 1} of {STEPS.length}
        </p>
      </div>

      <div key={step} className="animate-rise mt-7">
        <h3 ref={headingRef} tabIndex={-1} className="t-h2 text-forest outline-none">
          {current.title}
        </h3>
        <p className="mt-2 text-body">{current.hint}</p>

        <div className="mt-6">
          {step === 0 && (
            <fieldset aria-describedby={error?.field === "needs" ? "wl-error" : undefined}>
              <legend className="sr-only">{current.title}</legend>
              <div className="flex flex-wrap gap-2">
                {NEEDS.map((n) => (
                  <Chip key={n.id} on={needs.includes(n.id)} onClick={() => toggle(setNeeds, n.id, MAX_NEEDS)}>
                    {n.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-4 text-sm font-bold text-forest">
                {needs.length} of {MAX_NEEDS} picked
              </p>
            </fieldset>
          )}

          {step === 1 && (
            <fieldset>
              <legend className="sr-only">{current.title}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {WAYS.map((w) => (
                  <Chip key={w.id} on={ways.includes(w.id)} onClick={() => toggle(setWays, w.id)} block>
                    {w.label}
                  </Chip>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label htmlFor="wl-firstAsk" className="sr-only">
                  {current.title}
                </label>
                <textarea
                  id="wl-firstAsk"
                  rows={3}
                  maxLength={500}
                  value={firstAsk}
                  onChange={(e) => setFirstAsk(e.target.value)}
                  placeholder="Find me a plumber who will actually show up on Saturday"
                  className={`${inputClass} mt-0 resize-none border-hairline`}
                />
                <p className="mt-1 text-right text-sm text-body">Optional</p>
              </div>
              <fieldset>
                <legend className="font-bold text-forest">Which languages would you talk to Oya in?</legend>
                <div className="mt-3 flex flex-wrap gap-2">
                  {LANGUAGES.map((l) => (
                    <Chip key={l.id} on={languages.includes(l.id)} onClick={() => toggle(setLanguages, l.id)}>
                      {l.label}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <TextField id="wl-name" label="Your name" value={name} onChange={setName} autoComplete="name" placeholder="Ini Bassey" error={error?.field === "name"} />
              <TextField id="wl-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="ini@example.com" error={error?.field === "email"} />
              <TextField
                id="wl-whatsapp"
                label="WhatsApp number (optional)"
                type="tel"
                value={whatsapp}
                onChange={setWhatsapp}
                autoComplete="tel"
                placeholder="0803 123 4567"
                error={error?.field === "whatsapp"}
              />
              <TextField id="wl-area" label="Your area, estate or campus" value={area} onChange={setArea} autoComplete="address-level2" placeholder="Ewet Housing, Uyo" error={error?.field === "area"} />

              {/* Honeypot */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="wl-website">Website</label>
                <input id="wl-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  id="wl-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  aria-invalid={error?.field === "consent"}
                  className="mt-1 size-5 shrink-0 accent-[#1D6B47]"
                />
                <span className="text-[0.9375rem] text-body">
                  Email me (and WhatsApp me, if I gave a number) about Oya. I can opt out any time, and my details are
                  never sold or shared.
                </span>
              </label>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p id="wl-error" role="alert" className="mt-5 text-sm font-bold text-ember">
          {error.message}
        </p>
      )}

      <div className="mt-8 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => go(step - 1)}
            className="inline-flex min-h-12 items-center rounded-full border-2 border-hairline px-5 font-bold text-forest hover:border-forest"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-orange px-6 font-bold text-forest transition-colors hover:bg-orange-soft disabled:opacity-70"
        >
          {pending ? "Saving…" : last ? "Join the waitlist" : step === 1 && ways.length === 0 ? "Skip" : step === 2 && !firstAsk.trim() && languages.length === 0 ? "Skip" : "Next"}
        </button>
      </div>
    </form>
  );
}

function Chip({ on, onClick, block = false, children }: { on: boolean; onClick: () => void; block?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border-2 px-4 py-2 text-left text-[0.9375rem] font-bold transition-colors duration-150 ${
        block ? "w-full rounded-[16px] py-3" : ""
      } ${on ? "border-forest bg-forest text-cream" : "border-hairline bg-paper text-forest hover:border-forest"}`}
    >
      {on && <UiIcon name="check" size={16} />}
      {children}
    </button>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="font-bold text-forest">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error}
        aria-describedby={error ? "wl-error" : undefined}
        className={`${inputClass} ${error ? "border-ember" : "border-hairline"}`}
      />
    </div>
  );
}
