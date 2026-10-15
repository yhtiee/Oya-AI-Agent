import { z } from "zod";
import raw from "../../../config/emergency-resources.json";

const resourceSchema = z.object({
  id: z.string(),
  kind: z.enum(["emergency", "ambulance", "police", "fire", "self_harm"]),
  label: z.string(),
  phone: z.string().nullable(),
  tollFree: z.boolean().nullable(),
  scope: z.string(),
  verified: z.boolean(),
  verifiedAt: z.string().nullable(),
  source: z.string(),
});

const fileSchema = z.object({ version: z.number(), resources: z.array(resourceSchema) });

export type EmergencyResource = z.infer<typeof resourceSchema>;

const ALL = fileSchema.parse(raw).resources;

/** Only numbers ops have confirmed by phone are ever shown (SPEC §15.4). */
export function verifiedResources(kind?: EmergencyResource["kind"]): (EmergencyResource & { phone: string })[] {
  return ALL.filter(
    (r): r is EmergencyResource & { phone: string } => r.verified && r.phone !== null && (!kind || r.kind === kind),
  );
}

export function hasUnverifiedResources(kind: EmergencyResource["kind"]): boolean {
  return ALL.some((r) => r.kind === kind && !r.verified);
}
