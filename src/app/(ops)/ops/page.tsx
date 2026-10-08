import { getTranslations } from "next-intl/server";
import { requireStaff } from "@/server/auth/session";

// Placeholder until the ops queue (M3) and console (M8).
export default async function OpsHome() {
  await requireStaff("/ops");
  const t = await getTranslations("ops");
  return (
    <div>
      <h1 className="t-h1 text-forest">{t("title")}</h1>
      <p className="mt-3 max-w-[60ch] t-body-lg text-body">{t("lead")}</p>
    </div>
  );
}
