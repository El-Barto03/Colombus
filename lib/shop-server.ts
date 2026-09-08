import { initialShops, type Shop, type ShopCategory, type ShopInput } from "@/lib/shops";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export const INITIAL_SHOPS_SEED_KEY = "initial_shops_v1";

export type SupabaseShopRow = {
  id: string;
  name: string;
  category: string;
  initials: string;
  logo: string;
  logo_text: string;
  logo_background: string;
  type: string;
  product_range: string;
  price_range: string;
  contact: string;
  fit: string;
  address: string;
  neighborhood: string;
  website: string;
  directions_url: string;
  lat: number;
  lng: number;
  note: string;
  visit_status: string;
  reach_out_sent: boolean;
  followup_sent: boolean;
  manual_notes: string;
  created_at?: string;
  updated_at?: string;
};

export async function readShops() {
  const supabase = getSupabaseAdmin();
  const firstRead = await supabase.from("shops").select("*").order("name");
  if (firstRead.error) throw new Error(firstRead.error.message);
  let rows = firstRead.data;

  const seedRead = await supabase.from("app_state").select("key").eq("key", INITIAL_SHOPS_SEED_KEY).maybeSingle();
  if (seedRead.error) throw new Error(seedRead.error.message);

  if (!seedRead.data) {
    if (rows.length === 0) {
      const seeded = await supabase.from("shops").upsert(
        initialShops.map((shop) => toStoredShop(shop.id, shop)),
        { onConflict: "id", ignoreDuplicates: true },
      );
      if (seeded.error) throw new Error(seeded.error.message);
    }
    const seedMarked = await supabase.from("app_state").upsert(
      { key: INITIAL_SHOPS_SEED_KEY, value: "complete" },
      { onConflict: "key" },
    );
    if (seedMarked.error) throw new Error(seedMarked.error.message);
    const refreshed = await supabase.from("shops").select("*").order("name");
    if (refreshed.error) throw new Error(refreshed.error.message);
    rows = refreshed.data;
  }

  return rows.map(toClientShop);
}

const shopCategories = new Set<ShopCategory>(["shop", "museum", "airport", "train_station"]);

function normalizeCategory(value: unknown): ShopCategory {
  return typeof value === "string" && shopCategories.has(value as ShopCategory)
    ? value as ShopCategory
    : "shop";
}

export function toStoredShopValues(shop: ShopInput) {
  return {
    name: shop.name,
    category: normalizeCategory(shop.category),
    initials: shop.initials,
    logo: shop.logo ?? "",
    logo_text: shop.logoText ?? "",
    logo_background: shop.logoBackground ?? "light",
    type: shop.type,
    product_range: shop.productRange,
    price_range: shop.priceRange,
    contact: shop.contact,
    fit: shop.fit,
    address: shop.address,
    neighborhood: shop.neighborhood,
    website: shop.website,
    directions_url: shop.directionsUrl ?? "",
    lat: shop.lat,
    lng: shop.lng,
    note: shop.note ?? "",
    visit_status: shop.visitStatus === "visited" ? "visited" : "not_visited",
    reach_out_sent: shop.reachOutSent ?? false,
    followup_sent: shop.followupSent ?? false,
    manual_notes: shop.manualNotes ?? "",
  };
}

export function toStoredShop(id: string, shop: ShopInput) {
  return { id, ...toStoredShopValues(shop) };
}

export function toClientShop(row: SupabaseShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    category: normalizeCategory(row.category),
    initials: row.initials,
    logo: row.logo || undefined,
    logoText: row.logo_text || undefined,
    logoBackground: row.logo_background === "dark" ? "dark" : "light",
    type: row.type,
    productRange: row.product_range,
    priceRange: row.price_range,
    contact: row.contact,
    fit: row.fit,
    address: row.address,
    neighborhood: row.neighborhood,
    website: row.website,
    directionsUrl: row.directions_url || undefined,
    lat: row.lat,
    lng: row.lng,
    note: row.note || undefined,
    visitStatus: row.visit_status === "visited" ? "visited" : "not_visited",
    reachOutSent: Boolean(row.reach_out_sent),
    followupSent: Boolean(row.followup_sent),
    manualNotes: row.manual_notes || undefined,
  };
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("Supabase is not configured")) return message;
  if (
    message.includes("Could not find the table") ||
    (message.includes("relation") && message.includes("shops"))
  ) {
    return "The Supabase shop tables have not been created yet. Run supabase/schema.sql in the Supabase SQL Editor.";
  }
  return "The shared shop database could not be reached. Please try again.";
}
