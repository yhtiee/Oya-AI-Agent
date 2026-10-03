import { DayOnTheStreet } from "./DayOnTheStreet";
import { Section, SectionHeading } from "./ui";

export function Asks() {
  return (
    <Section id="ask" tone="sand" labelledBy="ask-title">
      <SectionHeading
        id="ask-title"
        title="If you'd normally ask around, ask Oya."
        intro="Every hour, somebody on the street needs something. Drag the sun through one day and see what Oya does with each ask."
      />
      <div className="mt-12">
        <DayOnTheStreet />
      </div>
    </Section>
  );
}
