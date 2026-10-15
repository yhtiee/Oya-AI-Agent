import { z } from "zod";

/*
 * Card schemas (SPEC Appendix A). Cards are built only by server-side card builders from tool results and
 * confirmations (R3); the model never writes card JSON. The EmergencyCard and SupportCard can also be built
 * in the browser from static config, so they show offline (§14.8).
 */

export const Source = z.object({
  label: z.string(),
  asOf: z.string().datetime({ offset: true }),
  url: z.string().url().optional(),
  attribution: z.enum(["google", "none"]).default("none"),
  verified: z.boolean().default(true),
});
export type Source = z.infer<typeof Source>;

export const Action = z.object({
  id: z.string(),
  label: z.string().max(24),
  kind: z.enum(["primary", "secondary", "link", "call", "directions", "danger"]),
  confirmationId: z.string().uuid().optional(),
  href: z.string().optional(),
});
export type Action = z.infer<typeof Action>;

export const ConfirmCard = z.object({
  type: z.literal("confirm"),
  id: z.string().uuid(),
  confirmationId: z.string().uuid(),
  title: z.string(),
  lines: z.array(z.string()).max(6),
  consents: z.array(z.enum(["share_contact", "location"])).default([]),
  actions: z.array(Action).min(2).max(3),
  expiresAt: z.string().datetime({ offset: true }),
});
export type ConfirmCard = z.infer<typeof ConfirmCard>;

export const InfoCard = z.object({
  type: z.literal("info"),
  id: z.string().uuid(),
  title: z.string(),
  bodyMd: z.string().max(1200),
  steps: z.array(z.string()).max(12).default([]),
  fees: z.array(z.object({ label: z.string(), amountKobo: z.number().int(), note: z.string().optional() })).default([]),
  officialLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).max(4),
  lastVerifiedAt: z.string().datetime({ offset: true }),
  staleWarning: z.boolean(),
  source: Source,
  actions: z.array(Action),
});
export type InfoCard = z.infer<typeof InfoCard>;

const Link = z.object({ label: z.string(), href: z.string() });

export const EmergencyCard = z.object({
  type: z.literal("emergency"),
  id: z.string().uuid(),
  primary: z.object({ label: z.literal("Call 112 now"), href: z.literal("tel:112") }),
  secondary: z.array(Link).max(4),
  facilities: z
    .array(
      z.object({
        name: z.string(),
        distanceM: z.number().int(),
        callHref: z.string().optional(),
        directionsHref: z.string(),
      }),
    )
    .max(3),
  facilitiesLoading: z.boolean(),
  note: z.string(),
});
export type EmergencyCard = z.infer<typeof EmergencyCard>;

/** The self-harm supportive flow (§15.4): support lines plus 112, no other skills that turn. */
export const SupportCard = z.object({
  type: z.literal("support"),
  id: z.string().uuid(),
  lines: z.array(Link).max(4),
  emergency: z.object({ label: z.string(), href: z.literal("tel:112") }),
  note: z.string(),
});
export type SupportCard = z.infer<typeof SupportCard>;

export const Card = z.discriminatedUnion("type", [ConfirmCard, InfoCard, EmergencyCard, SupportCard]);
export type Card = z.infer<typeof Card>;
export type CardType = Card["type"];
