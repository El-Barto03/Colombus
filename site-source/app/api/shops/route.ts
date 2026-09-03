import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { appState, shops as shopsTable } from "@/db/schema";
import { initialShops } from "@/lib/shops";
import {
  coordinatesMapUrl,
  LocationResolutionError,
  resolveShopLocation,
} from "@/lib/shop-location";
import {
  INITIAL_SHOPS_SEED_KEY,
  routeError,
  toClientShop,
  toStoredShop,
} from "@/lib/shop-server";
import {
  slugifyShopName,
  validateManualLocationInput,
  validateShopInput,
} from "@/lib/shop-validation";

export const dynamic = "force-dynamic";

async function readShops() {
  const db = getDb();
  let rows = await db.select().from(shopsTable).orderBy(asc(shopsTable.name));
  const [seedState] = await db
    .select()
    .from(appState)
    .where(eq(appState.key, INITIAL_SHOPS_SEED_KEY))
    .limit(1);

  if (!seedState) {
    if (rows.length === 0) {
      for (const shop of initialShops) {
        await db
          .insert(shopsTable)
          .values(toStoredShop(shop.id, shop))
          .onConflictDoNothing();
      }
    }
    await db
      .insert(appState)
      .values({ key: INITIAL_SHOPS_SEED_KEY, value: "complete" })
      .onConflictDoNothing();
    rows = await db.select().from(shopsTable).orderBy(asc(shopsTable.name));
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
    if (contentLength > 30_000) {
      return Response.json({ error: "Shop entry is too large." }, { status: 413 });
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

    const directionsUrl = preliminary.value.directionsUrl ?? "";
    const location = await resolveShopLocation({
      directionsUrl,
      manualLocation: manualLocation.value,
    });
    const validation = validateShopInput(normalizedPayload, location);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    const id = `${slugifyShopName(validation.value.name)}-${crypto.randomUUID().slice(0, 8)}`;
    const db = getDb();
    const [row] = await db
      .insert(shopsTable)
      .values(toStoredShop(id, validation.value))
      .returning();

    return Response.json({ shop: toClientShop(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof LocationResolutionError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to add shop", error);
    return Response.json({ error: routeError(error) }, { status: 500 });
  }
}
