"use server";

import { createClient } from "@supabase/supabase-js";
import {
  LANGUAGES,
  MAX_NEEDS,
  NEEDS,
  WAYS,
  normaliseWhatsapp,
  validateContact,
  type WaitlistInput,
  type WaitlistResult,
} from "@/lib/waitlist";

const pick = <T extends string>(values: unknown, allowed: readonly { id: T }[]) => {
  const ids = new Set<string>(allowed.map((o) => o.id));
  return Array.isArray(values) ? [...new Set(values.filter((v): v is T => typeof v === "string" && ids.has(v)))] : [];
};

export async function joinWaitlist(input: WaitlistInput): Promise<WaitlistResult> {
  // Bots fill every field; people never see this one. Pretend it worked.
  if (input.website) return { ok: true, status: "joined", areaCount: 1 };

  const invalid = validateContact(input);
  if (invalid) return { ok: false, ...invalid };

  const needs = pick(input.needs, NEEDS).slice(0, MAX_NEEDS);
  if (needs.length === 0) return { ok: false, field: "needs", error: "Pick at least one thing you chase." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.error("joinWaitlist: Supabase env vars are missing");
    return { ok: false, error: "We couldn't save that just now. Please try again in a minute." };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("join_waitlist", {
    p_name: input.name.trim().slice(0, 120),
    p_email: input.email.trim().slice(0, 254),
    p_whatsapp: input.whatsapp.trim() ? normaliseWhatsapp(input.whatsapp) : null,
    p_area: input.area.trim().slice(0, 120),
    p_needs: needs,
    p_current_ways: pick(input.ways, WAYS),
    p_first_ask: typeof input.firstAsk === "string" ? input.firstAsk.trim().slice(0, 500) : null,
    p_languages: pick(input.languages, LANGUAGES),
  });

  if (error || !data) {
    console.error("joinWaitlist failed:", error?.message);
    return { ok: false, error: "We couldn't save that just now. Please try again in a minute." };
  }

  const result = data as { status: "joined" | "already"; area_count: number };
  return { ok: true, status: result.status, areaCount: result.area_count };
}
