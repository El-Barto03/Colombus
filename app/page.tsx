import ShopMapClient from "@/app/shop-map-client";
import { initialShops, sortShops, type Shop } from "@/lib/shops";
import { readShops, routeError } from "@/lib/shop-server";

export const dynamic = "force-dynamic";

export default async function Page() {
  let shops: Shop[] = sortShops(initialShops);
  let initialSyncError = "";

  try {
    shops = sortShops(await readShops());
  } catch (error) {
    console.error("Unable to load shops for the initial page", error);
    initialSyncError = routeError(error);
  }

  return (
    <ShopMapClient
      initialShopData={shops}
      initialSyncError={initialSyncError}
    />
  );
}
