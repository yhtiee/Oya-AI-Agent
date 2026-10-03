/*
 * The waitlist survey. These ids are also enforced by check constraints in
 * supabase/migrations/*_waitlist.sql, so add new options in both places.
 */

export const NEEDS = [
  { id: "power", label: "Light and prepaid units" },
  { id: "food", label: "Food" },
  { id: "artisans", label: "Plumbers, electricians, repairs" },
  { id: "government", label: "NIN, passport and other paperwork" },
  { id: "pharmacy", label: "Finding drugs at a pharmacy" },
  { id: "health", label: "Clinics, hospitals and labs" },
  { id: "housing", label: "Finding a house or room" },
  { id: "gas", label: "Cooking gas" },
  { id: "fuel", label: "Fuel" },
  { id: "transport", label: "Travel and sending parcels" },
  { id: "school", label: "Schools, tutors and exams" },
  { id: "jobs", label: "Jobs and gigs" },
  { id: "prices", label: "Market prices" },
  { id: "events", label: "Owambe and events" },
  { id: "beauty", label: "Barbers, braiders and makeup" },
  { id: "other", label: "Something else" },
] as const;

export const WAYS = [
  { id: "ask_people", label: "I ask friends and family" },
  { id: "whatsapp_groups", label: "I post in WhatsApp groups" },
  { id: "call_around", label: "I call around" },
  { id: "go_in_person", label: "I go there myself" },
  { id: "search_online", label: "I search online" },
  { id: "pay_agent", label: "I pay an agent or middleman" },
] as const;

export const LANGUAGES = [
  { id: "pidgin", label: "Pidgin" },
  { id: "english", label: "English" },
  { id: "yoruba", label: "Yoruba" },
  { id: "igbo", label: "Igbo" },
  { id: "hausa", label: "Hausa" },
  { id: "efik_ibibio", label: "Efik or Ibibio" },
] as const;

export const MAX_NEEDS = 3;

export type NeedId = (typeof NEEDS)[number]["id"];
export type WayId = (typeof WAYS)[number]["id"];
export type LanguageId = (typeof LANGUAGES)[number]["id"];

export type WaitlistInput = {
  name: string;
  email: string;
  whatsapp: string;
  area: string;
  needs: NeedId[];
  ways: WayId[];
  firstAsk: string;
  languages: LanguageId[];
  consent: boolean;
  /** Honeypot: real people never see or fill this. */
  website?: string;
};

export type WaitlistResult =
  | { ok: true; status: "joined" | "already"; areaCount: number }
  | { ok: false; error: string; field?: keyof WaitlistInput };

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Turns 0803 123 4567 or +234 803 123 4567 into +2348031234567. Returns null if it isn't a Nigerian mobile number. */
export function normaliseWhatsapp(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  const m = digits.match(/^(?:\+?234|0)([789][01]\d{8})$/);
  return m ? `+234${m[1]}` : null;
}

export function validateContact(input: Pick<WaitlistInput, "name" | "email" | "whatsapp" | "area" | "consent">) {
  if (input.name.trim().length < 1) return { field: "name" as const, error: "Tell us what to call you." };
  if (!EMAIL_RE.test(input.email.trim())) return { field: "email" as const, error: "That email doesn't look right." };
  if (input.whatsapp.trim() && !normaliseWhatsapp(input.whatsapp))
    return { field: "whatsapp" as const, error: "Use a Nigerian mobile number, like 0803 123 4567, or leave it blank." };
  if (input.area.trim().length < 2) return { field: "area" as const, error: "Tell us your area, estate or campus." };
  if (!input.consent) return { field: "consent" as const, error: "Tick this so we can get in touch." };
  return null;
}
