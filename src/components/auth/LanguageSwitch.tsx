"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/server/actions/locale";

const OPTIONS = [
  { value: "en", label: "English" },
  { value: "pcm", label: "Pidgin" },
] as const;

/** English / Pidgin toggle. Switching re-renders the page in that language straight away. */
export function LanguageSwitch() {
  const current = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="group" aria-label="Language" className="flex rounded-full bg-sand p-1" aria-busy={pending}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={current === o.value}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocale(o.value);
              router.refresh();
            })
          }
          className={`min-h-9 rounded-full px-3 text-sm font-bold transition-colors ${
            current === o.value ? "bg-forest text-cream" : "text-forest hover:bg-hairline"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
