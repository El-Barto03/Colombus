import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { appState, shops as shopsTable } from "@/db/schema";
import {
  coordinatesMapUrl,
  LocationResolutionError,
  resolveShopLocation,
} from "@/lib/shop-location";
import {
  INITIAL_SHOPS_SEED_KEY,
  routeError,
  toClientShop,
  toStoredShopValues,
} from "@/lib/shop-server";
import {
  validateManualLocationInput,
  validateShopInput,
  validateShopTrackingInput,
} from "@/lib/shop-validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10_000) {
      return Response.json({ error: "Tracking update is too large." }, { status: 413 });
    }

    const { id } = await params;
    if (!id || id.length > 100) {
      return Response.json({ error: "Invalid shop id." }, { status: 400 });
    }

    const validation = validateShopTrackingInput(await request.json());
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const db = getDb();
    const [row] = await db
      .update(shopsTable)
      .set({ ...validation.value, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(shopsTable.id, id))
      .returning();

    if (!row) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ shop: toClientShop(row) });
  } catch (error) {
    console.error("Unable to update shop tracking", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 30_000) {
      return Response.json({ error: "Shop entry is too large." }, { status: 413 });
    }

    const { id } = await params;
    if (!id || id.length > 100) {
      return Response.json({ error: "Invalid shop id." }, { status: 400 });
    }

    const payload = await request.json();
    const manualLocation = validateManualLocationInput(payload);
    if (!manualLocation.ok) {
      return Response.json({ error: manualLocation.error }, { status: 400 });
    }

    const input =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
    const normalizedPayload =
      manualLocation.value &&
      (typeof input.directionsUrl !== "string" || !input.directionsUrl.trim())
        ? { ...input, directionsUrl: coordinatesMapUrl(manualLocation.value) }
        : payload;
    const preliminary = validateShopInput(normalizedPayload, { lat: 0, lng: 0 });
    if (!preliminary.ok) {
      return Response.json({ error: preliminary.error }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db
      .select()
      .from(shopsTable)
      .where(eq(shopsTable.id, id))
      .limit(1);
    if (!existing) return Response.json({ error: "Shop not found." }, { status: 404 });

    const directionsUrl = preliminary.value.directionsUrl ?? "";
    const sameLocation = directionsUrl === existing.directionsUrl;
    const location = manualLocation.value
      ? await resolveShopLocation({ directionsUrl, manualLocation: manualLocation.value })
      : sameLocation
        ? { lat: existing.lat, lng: existing.lng, address: existing.address }
        : await resolveShopLocation({ directionsUrl });
    const validation = validateShopInput(normalizedPayload, location);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const [row] = await db
      .update(shopsTable)
      .set({ ...toStoredShopValues(validation.value), updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(shopsTable.id, id))
      .returning();

    if (!row) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ shop: toClientShop(row) });
  } catch (error) {
    if (error instanceof LocationResolutionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to update shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return Response.json({ error: "Invalid shop id." }, { status: 400 });
    }

    const db = getDb();
    await db
      .insert(appState)
      .values({ key: INITIAL_SHOPS_SEED_KEY, value: "complete" })
      .onConflictDoNothing();
    const [deleted] = await db
      .delete(shopsTable)
      .where(eq(shopsTable.id, id))
      .returning({ id: shopsTable.id });

    if (!deleted) return Response.json({ error: "Shop not found." }, { status: 404 });
    return Response.json({ deletedId: deleted.id });
  } catch (error) {
    console.error("Unable to delete shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
