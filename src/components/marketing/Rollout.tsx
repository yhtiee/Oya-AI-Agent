import { Section, SectionHeading } from "./ui";
import { WaitlistSurvey } from "./WaitlistSurvey";

export function Rollout() {
  return (
    <Section id="early-access" tone="cream" labelledBy="rollout-title">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading
            id="rollout-title"
            title="Help decide what Oya sorts first."
            intro="Oya is starting small, one estate or campus at a time, so every request gets sorted properly. Then a few cities, then everywhere."
          />
          <p className="mt-5 max-w-[46ch] t-body-lg text-body">
            Four quick questions: what you chase, how you sort it today, and where you live. Your answers shape what Oya
            learns first, and the areas with the most people waiting are where it goes next.
          </p>
          <p className="mt-5 text-[0.9375rem] text-body">Takes about a minute. Free, always.</p>
        </div>
        <WaitlistSurvey />
      </div>
    </Section>
  );
}
