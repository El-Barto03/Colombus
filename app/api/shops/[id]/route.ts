import { coordinatesMapUrl, LocationResolutionError, resolveShopLocation } from "@/lib/shop-location";
import { INITIAL_SHOPS_SEED_KEY, routeError, toClientShop, toStoredShopValues } from "@/lib/shop-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { validateManualLocationInput, validateShopInput, validateShopTrackingInput } from "@/lib/shop-validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) return Response.json({ error: "Tracking update is too large." }, { status: 413 });
    const { id } = await params;
    if (!id || id.length > 100) return Response.json({ error: "Invalid shop id." }, { status: 400 });
    const validation = validateShopTrackingInput(await request.json());
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

    const updated = await getSupabaseAdmin().from("shops").update({
      visit_status: validation.value.visitStatus,
      reach_out_sent: validation.value.reachOutSent,
      followup_sent: validation.value.followupSent,
      manual_notes: validation.value.manualNotes,
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").maybeSingle();
    if (updated.error) throw new Error(updated.error.message);
    if (!updated.data) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ shop: toClientShop(updated.data) });
  } catch (error) {
    console.error("Unable to update shop tracking", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 30_000) return Response.json({ error: "Shop entry is too large." }, { status: 413 });
    const { id } = await params;
    if (!id || id.length > 100) return Response.json({ error: "Invalid shop id." }, { status: 400 });

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

    const supabase = getSupabaseAdmin();
    const existingRead = await supabase.from("shops").select("*").eq("id", id).maybeSingle();
    if (existingRead.error) throw new Error(existingRead.error.message);
    const existing = existingRead.data;
    if (!existing) return Response.json({ error: "Shop not found." }, { status: 404 });

    const directionsUrl = preliminary.value.directionsUrl ?? "";
    const sameLocation = directionsUrl === existing.directions_url;
    const location = manualLocation.value
      ? await resolveShopLocation({ directionsUrl, manualLocation: manualLocation.value })
      : sameLocation
        ? { lat: existing.lat, lng: existing.lng, address: existing.address }
        : await resolveShopLocation({ directionsUrl });
    const validation = validateShopInput(normalizedPayload, location);
    if (!validation.ok) return Response.json({ error: validation.error }, { status: 400 });

    const updated = await supabase.from("shops").update({
      ...toStoredShopValues(validation.value),
      updated_at: new Date().toISOString(),
    }).eq("id", id).select("*").maybeSingle();
    if (updated.error) throw new Error(updated.error.message);
    if (!updated.data) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ shop: toClientShop(updated.data) });
  } catch (error) {
    if (error instanceof LocationResolutionError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Unable to update shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || id.length > 100) return Response.json({ error: "Invalid shop id." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const seedMarked = await supabase.from("app_state").upsert(
      { key: INITIAL_SHOPS_SEED_KEY, value: "complete" },
      { onConflict: "key" },
    );
    if (seedMarked.error) throw new Error(seedMarked.error.message);
    const deleted = await supabase.from("shops").delete().eq("id", id).select("id").maybeSingle();
    if (deleted.error) throw new Error(deleted.error.message);
    if (!deleted.data) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ deletedId: deleted.data.id });
  } catch (error) {
    console.error("Unable to delete shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
