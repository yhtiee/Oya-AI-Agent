import type { ReactNode } from "react";
import { Calendar } from "./scenes/Calendar";
import { Escrow } from "./scenes/Escrow";
import { StreetMap } from "./scenes/StreetMap";
import { VoiceNote } from "./scenes/VoiceNote";
import { Section } from "./ui";

const FEATURES: { title: string; text: string; scene: ReactNode }[] = [
  {
    title: "Talk to it the way you talk to your guy",
    text: "Voice note or text, Pidgin or English. No forms, no menus, no “press 1”. Say it however it comes out, and Oya works out what you need. Play the voice note, then switch the language.",
    scene: <VoiceNote />,
  },
  {
    title: "It knows what's happening on your street",
    text: "Search can only show what someone posted, whenever they posted it. Oya hears from people around you and checks with real providers, so the answer is true today. Switch between light, fuel and roads.",
    scene: <StreetMap />,
  },
  {
    title: "Your money waits until the job is done",
    text: "When you pay through Oya, the money is held by a licensed payment provider. The plumber gets paid when you say the tap is fixed. Not before. Try it.",
    scene: <Escrow />,
  },
  {
    title: "It remembers, so you don't have to",
    text: "Oya keeps track of every request until it's sorted. It chases no-shows, remembers your deadlines and messages you first when something changes.",
    scene: <Calendar />,
  },
];

export function Features() {
  return (
    <Section id="what-it-does" tone="cream" labelledBy="features-title">
      <h2 id="features-title" className="sr-only">
        What Oya does
      </h2>
      <div className="space-y-20 md:space-y-28">
        {FEATURES.map((f, i) => (
          <article
            key={f.title}
            className={`grid items-center gap-8 md:gap-14 ${i % 2 ? "md:grid-cols-[1.15fr_0.85fr]" : "md:grid-cols-[0.85fr_1.15fr]"}`}
          >
            <div className={i % 2 ? "md:order-2" : ""}>
              <h3 className="t-h1 max-w-[14ch] text-forest">{f.title}</h3>
              <p className="t-body-lg mt-5 max-w-[42ch] text-body">{f.text}</p>
            </div>
            <div className={`rounded-[32px] p-4 sm:p-7 ${i % 2 ? "bg-peach md:order-1" : "bg-mint"}`}>{f.scene}</div>
          </article>
        ))}
      </div>
    </Section>
  );
}
