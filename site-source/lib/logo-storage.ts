import { env } from "cloudflare:workers";

const LOGO_PREFIX = "/api/logos/";
const LOGO_KEY_PREFIX = "logos/";

type UploadEnvironment = {
  UPLOADS?: R2Bucket;
};

export function getLogoBucket() {
  const bucket = (env as unknown as UploadEnvironment).UPLOADS;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding UPLOADS is unavailable. Set the r2 field in .openai/hosting.json to UPLOADS.",
    );
  }
  return bucket;
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
