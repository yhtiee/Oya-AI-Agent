import { CategoryExplorer } from "./CategoryExplorer";
import { Section, SectionHeading } from "./ui";

export function Categories() {
  return (
    <Section id="categories" tone="sand" labelledBy="categories-title">
      <SectionHeading
        id="categories-title"
        title="Thirty everyday things. One contact."
        intro="Oya starts with the five things people chase every day, then grows into the rest of daily life. Keep scrolling to see every group."
      />
      <div className="mt-12">
        <CategoryExplorer />
      </div>
    </Section>
  );
}
