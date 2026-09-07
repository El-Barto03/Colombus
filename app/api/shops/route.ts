import { initialShops } from "@/lib/shops";
import { coordinatesMapUrl, LocationResolutionError, resolveShopLocation } from "@/lib/shop-location";
import { INITIAL_SHOPS_SEED_KEY, routeError, toClientShop, toStoredShop } from "@/lib/shop-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { slugifyShopName, validateManualLocationInput, validateShopInput } from "@/lib/shop-validation";

export const dynamic = "force-dynamic";

async function readShops() {
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

export async function GET() {
  try {
    return Response.json({ shops: await readShops() });
  } catch (error) {
    console.error("Unable to load shops", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 30_000) return Response.json({ error: "Shop entry is too large." }, { status: 413 });

    const payload = await request.json();
    const manualLocation = validateManualLocationInput(payload);
    if (!manualLocation.ok) return Response.json({ error: manualLocation.error }, { status: 400 });

    const input = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : {};
    const normalizedPayload = manualLocation.value &&
      (typeof input.directionsUrl !== "string" || !input.directionsUrl.trim())
        ? { ...input, directionsUrl: coordinatesMapUrl(manualLocation.value) }
        : payload;
    const preliminary = validateShopInput(normalizedPayload, { lat: 0, lng: 0 });
    if (!preliminary.ok) return Response.json({ error: preliminary.error }, { status: 400 });

    const directionsUrl = preliminary.value.directionsUrl ?? "";
    const location = await resolveShopLocation({ directionsUrl, manualLocation: manualLocation.value });
    const validation = validateShopInput(normalizedPayload, location);
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

    const id = `${slugifyShopName(validation.value.name)}-${crypto.randomUUID().slice(0, 8)}`;
    const created = await getSupabaseAdmin().from("shops").insert(toStoredShop(id, validation.value)).select("*").single();
    if (created.error) throw new Error(created.error.message);
    return Response.json({ shop: toClientShop(created.data) }, { status: 201 });
  } catch (error) {
    if (error instanceof LocationResolutionError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Unable to add shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
