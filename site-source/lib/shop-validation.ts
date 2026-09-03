import { makeInitials, type ShopCategory, type ShopInput } from "@/lib/shops";
import {
  isLocationInput,
  type Coordinates,
  type ResolvedShopLocation,
} from "@/lib/shop-location";

type ValidationResult =
  | { ok: true; value: ShopInput }
  | { ok: false; error: string };

type ManualLocationValidationResult =
  | { ok: true; value: Coordinates | null }
  | { ok: false; error: string };

export type ShopTrackingInput = {
  visitStatus: "visited" | "not_visited";
  reachOutSent: boolean;
  followupSent: boolean;
  manualNotes: string;
};

type TrackingValidationResult =
  | { ok: true; value: ShopTrackingInput }
  | { ok: false; error: string };

const shopCategories = new Set<ShopCategory>([
  "shop",
  "museum",
  "airport",
  "train_station",
]);

function normalizedCategory(value: unknown): ShopCategory {
  return typeof value === "string" && shopCategories.has(value as ShopCategory)
    ? value as ShopCategory
    : "shop";
}

const limits = {
  name: 120,
  initials: 3,
  short: 240,
  medium: 700,
  long: 4000,
  url: 1600,
};

function textValue(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberValue(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return Number.NaN;
}

export function validateShopTrackingInput(payload: unknown): TrackingValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid tracking data." };
  }

  const input = payload as Record<string, unknown>;
  if (input.visitStatus !== "visited" && input.visitStatus !== "not_visited") {
    return { ok: false, error: "Choose either Visited or Not visited." };
  }
  if (typeof input.reachOutSent !== "boolean" || typeof input.followupSent !== "boolean") {
    return { ok: false, error: "Outreach tracking values must be checked or unchecked." };
  }
  if (input.manualNotes !== undefined && typeof input.manualNotes !== "string") {
    return { ok: false, error: "Manual notes must be text." };
  }

  return {
    ok: true,
    value: {
      visitStatus: input.visitStatus,
      reachOutSent: input.reachOutSent,
      followupSent: input.followupSent,
      manualNotes: textValue(input.manualNotes, limits.long),
    },
  };
}

export function validateManualLocationInput(
  payload: unknown,
): ManualLocationValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: true, value: null };
  }

  const manualLocation = (payload as Record<string, unknown>).manualLocation;
  if (manualLocation === undefined || manualLocation === null) {
    return { ok: true, value: null };
  }
  if (typeof manualLocation !== "object" || Array.isArray(manualLocation)) {
    return { ok: false, error: "Choose a valid position on the map." };
  }

  const coordinates = manualLocation as Record<string, unknown>;
  const lat = numberValue(coordinates.lat);
  const lng = numberValue(coordinates.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { ok: false, error: "Choose a valid position on the map." };
  }

  return { ok: true, value: { lat, lng } };
}

function validWebUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validLogoUrl(value: string) {
  return (
    validWebUrl(value) ||
    /^\/api\/logos\/[a-f0-9-]+\.(?:png|jpg|webp|gif)$/.test(value)
  );
}

export function validateShopInput(
  payload: unknown,
  resolvedLocation?: Coordinates | ResolvedShopLocation,
): ValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Invalid shop data." };
  }

  const input = payload as Record<string, unknown>;
  const name = textValue(input.name, limits.name);
  const resolvedAddress =
    resolvedLocation && "address" in resolvedLocation ? resolvedLocation.address : undefined;
  const address = textValue(resolvedAddress ?? input.address, limits.medium);
  const neighborhood = textValue(input.neighborhood, limits.short);
  const lat = resolvedLocation?.lat ?? numberValue(input.lat);
  const lng = resolvedLocation?.lng ?? numberValue(input.lng);
  const logo = textValue(input.logo, limits.url);
  const website = textValue(input.website, limits.url);
  const directionsUrl = textValue(input.directionsUrl, limits.url);

  if (!name) return { ok: false, error: "Shop name is required." };
  if (!directionsUrl) return { ok: false, error: "Google Maps link or address is required." };
  if (!isLocationInput(directionsUrl)) {
    return { ok: false, error: "Paste a valid Google Maps link or type a street address." };
  }
  if (resolvedAddress !== undefined && !address) {
    return { ok: false, error: "The address could not be recognized from this location." };
  }
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "Enter a valid latitude between -90 and 90." };
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    return { ok: false, error: "Enter a valid longitude between -180 and 180." };
  }
  if (!validLogoUrl(logo)) return { ok: false, error: "Logo must be a valid uploaded image." };
  if (!validWebUrl(website)) return { ok: false, error: "Website must be a valid web URL." };
  const rawInitials = textValue(input.initials, limits.initials);

  return {
    ok: true,
    value: {
      name,
      category: normalizedCategory(input.category),
      initials: (rawInitials || makeInitials(name)).toLocaleUpperCase("es"),
      logo: logo || undefined,
      logoText: textValue(input.logoText, limits.short) || undefined,
      logoBackground: input.logoBackground === "dark" ? "dark" : "light",
      type: textValue(input.type, limits.short),
      productRange: textValue(input.productRange, limits.long),
      priceRange: textValue(input.priceRange, limits.long),
      contact: textValue(input.contact, limits.long),
      fit: textValue(input.fit, limits.long),
      address,
      neighborhood,
      website,
      directionsUrl: directionsUrl || undefined,
      lat,
      lng,
      note: textValue(input.note, limits.long) || undefined,
      visitStatus: input.visitStatus === "visited" ? "visited" : "not_visited",
      reachOutSent: input.reachOutSent === true,
      followupSent: input.followupSent === true,
      manualNotes: textValue(input.manualNotes, limits.long) || undefined,
    },
  };
}

export function slugifyShopName(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "shop"
  );
}
