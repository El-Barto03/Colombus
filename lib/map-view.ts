import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import type { Shop } from "./shops";

export function fitAllShops(
  map: LeafletMap | null,
  markers: Record<string, LeafletMarker>,
  shops: Pick<Shop, "id" | "lat" | "lng">[],
) {
  if (!map) return;

  map.stop();
  map.invalidateSize({ pan: false });
  Object.values(markers).forEach((marker) => marker.closeTooltip());

  shops.forEach((shop) => {
    const marker = markers[shop.id];
    if (marker && !map.hasLayer(marker)) marker.addTo(map);
  });

  if (shops.length === 0) return;
  map.fitBounds(
    shops.map((shop) => [shop.lat, shop.lng] as [number, number]),
    { padding: [70, 70], maxZoom: 16, animate: true, duration: 0.45 },
  );
}
