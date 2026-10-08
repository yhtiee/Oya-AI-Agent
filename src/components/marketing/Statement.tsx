import { Section } from "./ui";

export function Statement() {
  return (
    <Section tone="orange" labelledBy="statement-title" className="lg:py-28">
      <h2 id="statement-title" className="max-w-[18ch] t-statement text-forest">
        Say it once. Oya does the asking around, the checking and the chasing.
      </h2>
    </Section>
  );
}
