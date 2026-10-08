import { getTranslations } from "next-intl/server";
import { requireSession } from "@/server/auth/session";

// Placeholder home until the conversation lands in M3.
export default async function AppHome() {
  const session = await requireSession("/app");
  const t = await getTranslations("app");

  return (
    <div>
      <h1 className="t-h1 text-forest">{t("greeting", { name: session.displayName })}</h1>
      <p className="mt-3 max-w-[56ch] t-body-lg text-body">{t("lead")}</p>
      <section className="mt-10 rounded-card border border-hairline bg-paper p-8">
        <h2 className="t-h3 text-forest">{t("emptyTitle")}</h2>
        <p className="mt-2 text-body">{t("emptyBody")}</p>
      </section>
    </div>
  );
}
