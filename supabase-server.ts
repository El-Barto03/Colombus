import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export const SHOP_LOGO_BUCKET = process.env.SUPABASE_LOGO_BUCKET || "shop-logos";

export function getSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SECRET_KEY to Netlify.",
    );
  }

  adminClient = createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}
