import { getSupabaseAdmin, SHOP_LOGO_BUCKET } from "@/lib/supabase-server";

const LOGO_PREFIX = "/api/logos/";
const LOGO_KEY_PREFIX = "logos/";

export function getLogoBucket() {
  return getSupabaseAdmin().storage.from(SHOP_LOGO_BUCKET);
}

export function uploadedLogoUrl(id: string) {
  return LOGO_PREFIX + id;
}

export function uploadedLogoKey(value: string) {
  if (!value.startsWith(LOGO_PREFIX)) return null;
  const id = value.slice(LOGO_PREFIX.length);
  if (!/^[a-f0-9-]+\.(?:png|jpg|webp|gif)$/.test(id)) return null;
  return LOGO_KEY_PREFIX + id;
}

export function logoStorageKey(id: string) {
  return LOGO_KEY_PREFIX + id;
}

export async function storeLogo(id: string, bytes: Uint8Array, contentType: string) {
  const result = await getLogoBucket().upload(logoStorageKey(id), bytes, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function downloadLogo(id: string) {
  return getLogoBucket().download(logoStorageKey(id));
}
