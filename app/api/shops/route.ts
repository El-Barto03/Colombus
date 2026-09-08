import { coordinatesMapUrl, LocationResolutionError, resolveShopLocation } from "@/lib/shop-location";
import { readShops, routeError, toClientShop, toStoredShop } from "@/lib/shop-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { slugifyShopName, validateManualLocationInput, validateShopInput } from "@/lib/shop-validation";

export const dynamic = "force-dynamic";

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
