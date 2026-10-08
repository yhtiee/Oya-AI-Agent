import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv, requireEnv } from "../env";

let client: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS, so only use it after an `authedAction()` ownership
 * check (R13), and never import it from code that can reach the browser (R6).
 */
export function getServiceClient(): SupabaseClient {
  client ??= createClient(getEnv().NEXT_PUBLIC_SUPABASE_URL, requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export function hasServiceClient(): boolean {
  return Boolean(getEnv().SUPABASE_SERVICE_ROLE_KEY);
}
