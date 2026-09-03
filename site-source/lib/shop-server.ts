import type { Shop, ShopCategory, ShopInput } from "@/lib/shops";

export const INITIAL_SHOPS_SEED_KEY = "initial_shops_v1";

type StoredShop = Shop & {
  category: string;
  logo: string;
  logoText: string;
  logoBackground: string;
  directionsUrl: string;
  note: string;
  visitStatus: string;
  reachOutSent: boolean;
  followupSent: boolean;
  manualNotes: string;
};

const shopCategories = new Set<ShopCategory>([
  "shop",
  "museum",
  "airport",
  "train_station",
]);

function normalizeCategory(value: unknown): ShopCategory {
  return typeof value === "string" && shopCategories.has(value as ShopCategory)
    ? value as ShopCategory
    : "shop";
}

export function toStoredShopValues(shop: ShopInput) {
  return {
    ...shop,
    category: normalizeCategory(shop.category),
    logo: shop.logo ?? "",
    logoText: shop.logoText ?? "",
    logoBackground: shop.logoBackground ?? "light",
    directionsUrl: shop.directionsUrl ?? "",
    note: shop.note ?? "",
    visitStatus: shop.visitStatus === "visited" ? "visited" : "not_visited",
    reachOutSent: shop.reachOutSent ?? false,
    followupSent: shop.followupSent ?? false,
    manualNotes: shop.manualNotes ?? "",
  };
}

export function toStoredShop(id: string, shop: ShopInput) {
  return { id, ...toStoredShopValues(shop) };
}

export function toClientShop(row: StoredShop): Shop {
  return {
    id: row.id,
    name: row.name,
    category: normalizeCategory(row.category),
    initials: row.initials,
    logo: row.logo || undefined,
    logoText: row.logoText || undefined,
    logoBackground: row.logoBackground === "dark" ? "dark" : "light",
    type: row.type,
    productRange: row.productRange,
    priceRange: row.priceRange,
    contact: row.contact,
    fit: row.fit,
    address: row.address,
    neighborhood: row.neighborhood,
    website: row.website,
    directionsUrl: row.directionsUrl || undefined,
    lat: row.lat,
    lng: row.lng,
    note: row.note || undefined,
    visitStatus: row.visitStatus === "visited" ? "visited" : "not_visited",
    reachOutSent: Boolean(row.reachOutSent),
    followupSent: Boolean(row.followupSent),
    manualNotes: row.manualNotes || undefined,
  };
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table") || message.includes('from "shops"')) {
    return "The shared shop database is still being prepared. Please try again shortly.";
  }
  return "The shared shop database could not be reached. Please try again.";
}
