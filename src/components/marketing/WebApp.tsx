import { Section, SectionHeading } from "./ui";
import { DeskScene } from "./DeskScene";

export function WebApp() {
  return (
    <Section id="web-app" tone="cream" labelledBy="webapp-title">
      <SectionHeading
        id="webapp-title"
        title="On a laptop? Same Oya, more room."
        intro="Start on your phone, carry on at your desk. On a bigger screen your options spread out, so you can compare them side by side and book in one go."
      />
      <div className="mt-12">
        <DeskScene />
      </div>
    </Section>
  );
}
