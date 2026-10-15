import type { EmergencyCard, SupportCard } from "@/types/cards";
import { verifiedResources } from "./emergency-resources";

/*
 * Static EmergencyCard and SupportCard, built from config/emergency-resources.json only. Pure, so the browser
 * can build the same card offline (§14.8) and the server can send it before any model call (§7.2 step 2a).
 * Only ops-verified numbers appear (§15.4). Nearby facilities stream in later on the server.
 */

function newId(): string {
  return globalThis.crypto.randomUUID();
}

const tel = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export function buildEmergencyCard(opts: { facilitiesLoading?: boolean } = {}): EmergencyCard {
  const secondary = verifiedResources()
    .filter((r) => r.kind !== "self_harm" && r.phone !== "112")
    .slice(0, 4)
    .map((r) => ({ label: r.label, href: tel(r.phone) }));
  return {
    type: "emergency",
    id: newId(),
    primary: { label: "Call 112 now", href: "tel:112" },
    secondary,
    facilities: [],
    facilitiesLoading: opts.facilitiesLoading ?? false,
    note: "112 is free on all networks. If you can, stay with the person and keep the line open.",
  };
}

export function buildSupportCard(): SupportCard {
  return {
    type: "support",
    id: newId(),
    lines: verifiedResources("self_harm")
      .slice(0, 4)
      .map((r) => ({ label: r.label, href: tel(r.phone) })),
    emergency: { label: "Call 112 if you're in danger now", href: "tel:112" },
    note: "You don't have to go through this alone. Talking to someone can help, right now.",
  };
}
