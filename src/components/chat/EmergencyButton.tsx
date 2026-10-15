"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildEmergencyCard } from "@/lib/safety/emergency-card";
import { EmergencyCardView } from "./cards";

/* Header Emergency button (SPEC §14.2): opens the static EmergencyCard. Needs no network once the page is loaded. */
export function EmergencyButton() {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useMemo(() => buildEmergencyCard(), []);

  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-emergency-button
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-full bg-peach px-4 text-sm font-bold text-ember"
      >
        {t("emergencyButton")}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        className="m-auto w-[min(92vw,460px)] rounded-[28px] bg-transparent p-0 backdrop:bg-forest/60"
      >
        <div className="relative">
          <EmergencyCardView card={card} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("close")}
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-ember"
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>
      </dialog>
    </>
  );
}
