import {
  addressFromCoordinates,
  coordinatesMapUrl,
  type Coordinates,
} from "@/lib/shop-location";

export const dynamic = "force-dynamic";

function validCoordinate(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latitude = url.searchParams.get("lat");
  const longitude = url.searchParams.get("lng");
  const coordinates: Coordinates = {
    lat: latitude === null ? Number.NaN : Number(latitude),
    lng: longitude === null ? Number.NaN : Number(longitude),
  };

  if (
    !validCoordinate(coordinates.lat, -90, 90) ||
    !validCoordinate(coordinates.lng, -180, 180)
  ) {
    return Response.json({ error: "Invalid map position." }, { status: 400 });
  }

  const address = await addressFromCoordinates(coordinates);
  return Response.json(
    {
      address,
      mapsUrl: coordinatesMapUrl(coordinates),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
