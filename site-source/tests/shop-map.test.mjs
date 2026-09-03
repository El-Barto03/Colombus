import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import {
  chooseMapCoordinates,
  coordinatesMapUrl,
  isLocationInput,
  manualAddressMatchScore,
  manualAddressQueries,
  parseMapCoordinateCandidates,
  parseMapCoordinates,
  resolveShopLocation,
} from "../lib/shop-location.ts";
import { getDirectionsUrl } from "../lib/shops.ts";
import { fitAllShops } from "../lib/map-view.ts";

const root = new URL("../", import.meta.url);

test("includes public add, duplicate, edit, and confirmed delete workflows", async () => {
  const [page, styles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
  ]);

  assert.match(page, /className="add-button"/);
  assert.match(page, /className="duplicate-button"/);
  assert.match(page, /className="edit-button"/);
  assert.match(page, /className="delete-button"/);
  assert.match(page, /window\.confirm/);
  assert.match(page, /method: "DELETE"/);
  assert.match(page, /Museum shop/);
  assert.match(page, /className="category-filters"/);
  assert.match(page, />\s*View all <em>\{shops\.length\}<\/em>/);
  assert.match(page, /onClick=\{viewAllShops\}/);
  assert.match(page, /const viewAllShops = \(\) => \{\s*setQuery\(""\);\s*setCategoryFilter\("all"\);\s*setSelectedId\(null\);\s*fitAllShops\(mapRef\.current, markersRef\.current, shops\);\s*\}/);
  assert.doesNotMatch(page, />Madrid retail map<\/p>/i);
  assert.match(styles, /\.shop-pin\.museum-pin/);
  assert.match(page, /function PriceRangeDisplay/);
  assert.match(page, /method: mode === "edit" \? "PUT" : "POST"/);
  assert.match(page, /sortShops\(result\.shops\)/);
  assert.match(page, /normalize\("NFD"\)/);
  assert.match(page, /const openList = \(\) => \{[\s\S]*?map\.fitBounds\([\s\S]*?filteredShops\.map/);
  assert.match(page, /const worldBounds = L\.latLngBounds/);
  assert.match(page, /worldCopyJump:\s*false/);
  assert.match(page, /function installSmoothWheelZoom/);
  assert.match(page, /scrollWheelZoom:\s*false/);
  assert.match(page, /zoomSnap:\s*0/);
  assert.match(page, /requestAnimationFrame\(animateZoom\)/);
  assert.match(page, /continuousMap\._move\([\s\S]*?pinch:\s*true,[\s\S]*?round:\s*false/);
  assert.match(page, /continuousMap\._moveEnd\(true\)/);
  assert.match(page, /const wheelRate = isMouseWheel \? 0\.0026 : 0\.0017/);
  assert.match(page, /const maximumStep = isMouseWheel \? 0\.34 : 0\.13/);
  assert.match(page, /Math\.exp\(-elapsed \/ 82\)/);
  assert.match(page, /wheelTime - lastWheelTime > 180/);
  assert.match(page, /map\.mouseEventToContainerPoint\(event\)/);
  assert.match(page, /zoomAnchor = map\.containerPointToLatLng\(zoomOrigin\)/);
  assert.match(page, /const anchorPixel = map\.project\(zoomAnchor, zoom\)/);
  assert.match(page, /const centerPixel = anchorPixel\.subtract\(zoomOrigin\.subtract\(viewHalf\)\)/);
  assert.match(page, /function enableSubpixelMarkerPosition/);
  assert.match(page, /map\s*\.project\(marker\.getLatLng\(\)\)\s*\.subtract\(map\.getPixelOrigin\(\)\)/);
  assert.match(page, /smoothMarker\._setPos\(position\)/);
  assert.match(page, /enableSubpixelMarkerPosition\(marker, map\)/);
  assert.match(page, /removeSmoothWheelZoom\?\.\(\)/);
  assert.match(page, /map\.on\("movestart", cancelWheelZoom\)/);
  assert.match(page, /map\.off\("movestart", cancelWheelZoom\)/);
  assert.match(page, /useState<MobileView>\("list"\)/);
  assert.match(page, /className="mobile-map-toggle"/);
  assert.match(page, />\s*<span aria-hidden="true">⌖<\/span> View map\s*<\/button>/);
  assert.match(page, /className="mobile-list-toggle"/);
  assert.match(page, />\s*<span aria-hidden="true">←<\/span> Back to list\s*<\/button>/);
  assert.match(page, /mapRef\.current\?\.invalidateSize\(\{ pan: false \}\)/);
  assert.match(page, /marker\.on\("click", \(\) => \{[\s\S]*?setMobileView\("list"\)/);
  assert.match(page, /zoomAnimation:\s*true/);
  assert.match(page, /zoomAnimationThreshold:\s*8/);
  assert.match(page, /fadeAnimation:\s*true/);
  assert.match(page, /maxBounds:\s*worldBounds/);
  assert.match(page, /maxBoundsViscosity:\s*1/);
  assert.match(page, /const worldViewPadding = L\.point\(72, 72\)/);
  assert.match(page, /map\.setMinZoom\(map\.getBoundsZoom\(worldBounds, false, worldViewPadding\)\)/);
  assert.match(page, /noWrap:\s*true/);
  assert.match(page, /updateWhenIdle:\s*true/);
  assert.match(page, /updateWhenZooming:\s*false/);
  assert.match(page, /updateInterval:\s*50/);
  assert.match(page, /keepBuffer:\s*5/);
  assert.match(page, /bounds:\s*worldBounds/);
  assert.match(page, /World_Street_Map/);
  assert.match(page, /className:\s*"google-style-map-tile"/);
  assert.doesNotMatch(page, /World_Light_Gray_Reference/);
  assert.match(page, /Pick on map/);
  assert.match(page, /Click the map to place the shop pin/);
  assert.match(page, /payload\.manualLocation = manualLocation/);
  assert.match(page, /map\.on\("click", selectManualLocation\)/);
  assert.match(styles, /\.location-input-row\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
  assert.match(styles, /\.map-stage\.is-location-picking[^}]*cursor:\s*crosshair/s);
  assert.match(styles, /\.sidebar\s*{[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.form-view\s*{[^}]*height:\s*0[^}]*overflow-y:\s*auto/s);
  assert.match(styles, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(styles, /\.price-view-amount\s*>\s*span\s*{[^}]*line-height:\s*1[^}]*text-align:\s*right/s);
  assert.match(styles, /\.price-inputs input\s*{[^}]*line-height:\s*1[^}]*text-align:\s*right/s);
  assert.match(styles, /@media \(max-width: 760px\)\s*{[\s\S]*?\.map-app\.mobile-map-open \.map-stage\s*{[^}]*opacity:\s*1[^}]*pointer-events:\s*auto[^}]*visibility:\s*visible/s);
  assert.match(styles, /\.mobile-map-toggle\s*{[^}]*display:\s*flex[^}]*width:\s*100%/s);
  assert.match(styles, /\.mobile-list-toggle\s*{[^}]*position:\s*absolute[^}]*display:\s*inline-flex/s);
  assert.match(styles, /\.google-style-map-tile\s*{[^}]*saturate\(0\.9\)[^}]*brightness\(1\.035\)[^}]*contrast\(0\.94\)/s);
});

test("duplicates chain details into a fresh location and supports airport and train filters", async () => {
  const [page, styles, shops, server, validation] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/shops.ts", root), "utf8"),
    readFile(new URL("lib/shop-server.ts", root), "utf8"),
    readFile(new URL("lib/shop-validation.ts", root), "utf8"),
  ]);

  assert.match(page, /type FormMode = "add" \| "edit" \| "duplicate" \| null/);
  assert.match(page, /onDuplicate/);
  assert.match(page, /setFormMode\("duplicate"\)/);
  assert.match(page, /emptyDraft\(shop, isDuplicate\)/);
  assert.match(page, /address: duplicate \? "" : shop\?\.address/);
  assert.match(page, /directionsUrl: duplicate \? ""/);
  assert.match(page, /visitStatus: mode === "edit"/);
  assert.match(page, /manualNotes: mode === "edit"/);
  assert.match(page, /mode === "duplicate"[\s\S]*?Add duplicate/);
  assert.match(page, /<option value="airport">Airport shop<\/option>/);
  assert.match(page, /<option value="train_station">Train station shop<\/option>/);
  assert.match(page, /category-filter--airport/);
  assert.match(page, /category-filter--train/);
  assert.match(page, /const pinClass = category === "shop" \? "" : ` \$\{categoryDetails\[category\]\.className\}-pin`/);
  assert.match(styles, /--airport:\s*#0f9f94/);
  assert.match(styles, /--train:\s*#e58a18/);
  assert.match(styles, /\.shop-pin\.airport-pin/);
  assert.match(styles, /\.shop-pin\.train-pin/);
  assert.match(shops, /"shop" \| "museum" \| "airport" \| "train_station"/);
  assert.match(server, /"airport"/);
  assert.match(server, /"train_station"/);
  assert.match(validation, /"airport"/);
  assert.match(validation, /"train_station"/);
});

test("View all restores every category and refits on every click using current shops", () => {
  const shops = [
    { id: "shop", lat: 40.42, lng: -3.7 },
    { id: "museum", lat: 41.89, lng: 12.49 },
  ];
  const fits = [];
  const visible = new Set();
  const closed = [];
  const operations = [];
  const map = {
    stop: () => operations.push("stop"),
    invalidateSize: (options) => {
      assert.deepEqual(options, { pan: false });
      operations.push("resize");
    },
    hasLayer: (marker) => visible.has(marker),
    fitBounds: (positions, options) => fits.push({ positions, options }),
  };
  const makeMarker = (id) => ({
    closeTooltip: () => closed.push(id),
    addTo: (target) => {
      assert.equal(target, map);
      visible.add(markers[id]);
    },
  });
  const markers = { shop: makeMarker("shop"), museum: makeMarker("museum") };
  visible.add(markers.shop);

  fitAllShops(map, markers, shops);
  assert.deepEqual(operations, ["stop", "resize"]);
  assert.deepEqual(closed, ["shop", "museum"]);
  assert.equal(visible.size, 2);
  assert.deepEqual(fits[0], {
    positions: [[40.42, -3.7], [41.89, 12.49]],
    options: { padding: [70, 70], maxZoom: 16, animate: true, duration: 0.45 },
  });

  // An already-active View all button must still reset a panned/zoomed map.
  fitAllShops(map, markers, shops);
  assert.equal(fits.length, 2);

  shops.push({ id: "new", lat: 35.68, lng: 139.76 });
  markers.new = makeMarker("new");
  fitAllShops(map, markers, shops);
  assert.equal(visible.size, 3);
  assert.deepEqual(fits[2].positions, [[40.42, -3.7], [41.89, 12.49], [35.68, 139.76]]);
});

test("View all safely handles a single shop, no shops, and a map still loading", () => {
  const fits = [];
  const map = {
    stop: () => {},
    invalidateSize: () => {},
    hasLayer: () => true,
    fitBounds: (positions, options) => fits.push({ positions, options }),
  };
  fitAllShops(null, {}, []);
  fitAllShops(map, {}, []);
  assert.equal(fits.length, 0);
  fitAllShops(map, {}, [{ id: "only", lat: 40.42, lng: -3.7 }]);
  assert.deepEqual(fits[0].positions, [[40.42, -3.7]]);
  assert.equal(fits[0].options.maxZoom, 16);
});

test("supports adaptive branding, direct logo uploads, and typed contacts", async () => {
  const [page, styles, shops, uploadRoute, logoRoute, hosting] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("lib/shops.ts", root), "utf8"),
    readFile(new URL("app/api/logos/route.ts", root), "utf8"),
    readFile(new URL("app/api/logos/[id]/route.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.match(page, /function AutoFitWordmark/);
  assert.match(page, /new ResizeObserver\(fit\)/);
  assert.match(page, /document\.fonts\?\.ready/);
  assert.match(page, /type="file"/);
  assert.match(page, /accept="image\/png,image\/jpeg,image\/webp,image\/gif"/);
  assert.match(page, /onDrop=\{handleLogoDrop\}/);
  assert.match(page, /text\/uri-list/);
  assert.match(page, /function LogoCropDialog/);
  assert.match(page, /role="dialog"/);
  assert.match(page, /canvas\.toBlob/);
  assert.match(page, /Use this crop/);
  assert.match(page, /preview:\s*true/);
  assert.match(page, /shop\.logo\.startsWith\("\/api\/logos\/"\)/);
  assert.match(page, /shop\.logo\.startsWith\("blob:"\)/);
  assert.match(page, /isCroppedUpload \? "logo-full-bleed"/);
  assert.doesNotMatch(page, /Logo image URL/);
  assert.doesNotMatch(page, /Text logo/);
  assert.match(page, /Updates from the first three words/);
  assert.match(page, /function ContactEditor/);
  assert.match(page, /Add another contact/);
  assert.match(styles, /\.brand-mark\.logo-dark \.logo-wordmark,[\s\S]*?color:\s*#ffffff/);
  assert.match(styles, /\.logo-wordmark\s*{[^}]*text-align:\s*center[^}]*white-space:\s*nowrap/s);
  assert.match(styles, /\.logo-crop-viewport\s*{[^}]*aspect-ratio:\s*3\s*\/\s*2/s);
  assert.match(styles, /\.brand-mark\.logo-full-bleed\s*{[^}]*aspect-ratio:\s*3\s*\/\s*2[^}]*padding:\s*0/s);
  assert.match(styles, /\.brand-mark\.logo-full-bleed \.shop-logo-img\s*{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*cover/s);
  assert.doesNotMatch(styles, /\.logo-wordmark\s*{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(shops, /words\.slice\(0,\s*3\)/);
  assert.match(uploadRoute, /getLogoBucket\(\)\.put/);
  assert.match(uploadRoute, /async function importRemoteLogo/);
  assert.match(uploadRoute, /redirect:\s*"manual"/);
  assert.match(uploadRoute, /hasExpectedSignature/);
  assert.match(uploadRoute, /body\.preview === true/);
  assert.match(uploadRoute, /"Cache-Control":\s*"private, no-store"/);
  assert.match(logoRoute, /object\.writeHttpMetadata/);
  assert.equal(JSON.parse(hosting).r2, "UPLOADS");
});

test("supports inline persistent prospect tracking without opening Edit", async () => {
  const [page, styles, itemRoute, schema, server, validation] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("app/api/shops/[id]/route.ts", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("lib/shop-server.ts", root), "utf8"),
    readFile(new URL("lib/shop-validation.ts", root), "utf8"),
  ]);

  assert.match(page, /function ShopTracker/);
  assert.match(page, /<ShopTracker key=\{shop\.id\} shop=\{shop\} onUpdated=\{onTracked\} \/>/);
  assert.match(page, /<option value="visited">Visited<\/option>/);
  assert.match(page, /<option value="not_visited">Not visited<\/option>/);
  assert.match(page, />Reach out sent<\/span>/);
  assert.match(page, />Followup sent<\/span>/);
  assert.match(page, />Manual notes<\/span>/);
  assert.match(page, /method: "PATCH"/);
  assert.match(page, /window\.setTimeout\([\s\S]*?, 550\)/);
  assert.match(page, /Add notes about calls, emails, replies or next steps/);
  assert.match(styles, /\.prospect-tracker\s*{/);
  assert.match(styles, /\.prospect-tracker-grid\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/s);
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /validateShopTrackingInput\(await request\.json\(\)\)/);
  assert.match(schema, /visitStatus:\s*text\("visit_status"\)/);
  assert.match(schema, /reachOutSent:\s*integer\("reach_out_sent", \{ mode: "boolean" \}\)/);
  assert.match(schema, /followupSent:\s*integer\("followup_sent", \{ mode: "boolean" \}\)/);
  assert.match(schema, /manualNotes:\s*text\("manual_notes"\)/);
  assert.match(server, /visitStatus: row\.visitStatus === "visited" \? "visited" : "not_visited"/);
  assert.match(server, /manualNotes: row\.manualNotes \|\| undefined/);
  assert.match(validation, /export function validateShopTrackingInput/);
  assert.match(validation, /input\.visitStatus !== "visited" && input\.visitStatus !== "not_visited"/);
  assert.match(validation, /typeof input\.reachOutSent !== "boolean"/);
  assert.match(validation, /typeof input\.followupSent !== "boolean"/);
  assert.match(validation, /manualNotes: textValue\(input\.manualNotes, limits\.long\)/);
});

test("uses the revised title and streamlined location form", async () => {
  const [page, layout, location, collectionRoute, itemRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("lib/shop-location.ts", root), "utf8"),
    readFile(new URL("app/api/shops/route.ts", root), "utf8"),
    readFile(new URL("app/api/shops/[id]/route.ts", root), "utf8"),
  ]);

  assert.match(page, /Ambar - Madrid Retail Mapping/);
  assert.match(layout, /Ambar - Madrid Retail Mapping/);
  assert.match(layout, /favicon-32x32\.png/);
  assert.match(layout, /icon-512\.png/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.doesNotMatch(page, /className="count-badge"/);
  assert.doesNotMatch(page, /label="Neighbourhood"/);
  assert.doesNotMatch(page, /label="Address"/);
  assert.doesNotMatch(page, /label="Latitude"/);
  assert.doesNotMatch(page, /label="Longitude"/);
  assert.match(page, /label="Google Maps link or address"[\s\S]*?required/);
  assert.match(page, /Claudio Coello 24/);
  assert.match(page, /Giuseppe Failla 61/);
  assert.match(page, /directionsUrl:\s*duplicate\s*\?\s*""\s*:\s*shop\?\.directionsUrl\s*\|\|\s*\(shop\s*\?\s*getDirectionsUrl\(shop\)\s*:\s*""\)/);
  assert.match(page, /function PriceRangeEditor/);
  assert.match(page, /Add another product/);
  assert.match(location, /parseMapCoordinates/);
  assert.match(location, /nominatim\.openstreetmap\.org\/reverse/);
  assert.match(location, /addressFromCoordinates/);
  assert.match(collectionRoute, /resolveShopLocation/);
  assert.match(itemRoute, /resolveShopLocation/);
});

test("uses exact Google place coordinates instead of the zoom-dependent viewport", () => {
  const link = "https://www.google.com/maps/place/Example+Shop/@40.4101,-3.7012,14z/data=!4m6!3m5!1sabc!8m2!3d40.42555!4d-3.70444";
  const candidates = parseMapCoordinateCandidates(link);

  assert.deepEqual(candidates.place, { lat: 40.42555, lng: -3.70444 });
  assert.deepEqual(candidates.viewport, { lat: 40.4101, lng: -3.7012 });
  assert.deepEqual(parseMapCoordinates(link), candidates.place);
});

test("validates and applies optional manual map positions", async () => {
  const [validation, collectionRoute, itemRoute, reverseRoute] = await Promise.all([
    readFile(new URL("lib/shop-validation.ts", root), "utf8"),
    readFile(new URL("app/api/shops/route.ts", root), "utf8"),
    readFile(new URL("app/api/shops/[id]/route.ts", root), "utf8"),
    readFile(new URL("app/api/location/reverse/route.ts", root), "utf8"),
  ]);

  assert.match(validation, /export function validateManualLocationInput/);
  assert.match(validation, /lat < -90[\s\S]*?lat > 90/);
  assert.match(validation, /lng < -180[\s\S]*?lng > 180/);
  assert.match(collectionRoute, /validateManualLocationInput\(payload\)/);
  assert.match(collectionRoute, /manualLocation:\s*manualLocation\.value/);
  assert.match(itemRoute, /validateManualLocationInput\(payload\)/);
  assert.match(itemRoute, /manualLocation:\s*manualLocation\.value/);
  assert.match(reverseRoute, /addressFromCoordinates\(coordinates\)/);
  assert.match(reverseRoute, /mapsUrl:\s*coordinatesMapUrl\(coordinates\)/);
  assert.equal(
    coordinatesMapUrl({ lat: 40.41348, lng: -3.71119 }),
    "https://www.google.com/maps/search/?api=1&query=40.413480%2C-3.711190",
  );
});

test("keeps a recognized shop fixed when Google viewport coordinates change", () => {
  const recognized = { lat: 40.42555, lng: -3.70444 };
  const firstViewport = { lat: 40.424, lng: -3.706 };
  const secondViewport = { lat: 40.412, lng: -3.69 };

  assert.deepEqual(
    chooseMapCoordinates({ exact: null, recognized, viewport: firstViewport }),
    recognized,
  );
  assert.deepEqual(
    chooseMapCoordinates({ exact: null, recognized, viewport: secondViewport }),
    recognized,
  );
  assert.deepEqual(
    chooseMapCoordinates({
      exact: { lat: 40.426, lng: -3.705 },
      recognized,
      viewport: firstViewport,
    }),
    { lat: 40.426, lng: -3.705 },
  );
});

test("recognizes abbreviated Spanish and Italian street addresses", async (t) => {
  assert.equal(isLocationInput("Claudio Coello 24"), true);
  assert.equal(isLocationInput("giuseppe failla 61"), true);
  assert.equal(isLocationInput("https://example.com/not-google-maps"), false);
  assert.ok(manualAddressQueries("Claudio Coello 24").includes("Calle de Claudio Coello 24, Madrid, España"));
  assert.ok(manualAddressQueries("giuseppe failla 61").includes("Via giuseppe failla 61, Roma, Italia"));
  assert.ok(manualAddressMatchScore("Claudio Coello 24", "Calle de Claudio Coello, 24, Madrid", "24") >= 1.5);

  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (input) => {
    const query = new URL(String(input)).searchParams.get("q") || "";
    const result = query.toLocaleLowerCase("es").includes("giuseppe")
      ? {
          lat: "41.78061",
          lon: "12.35671",
          display_name: "Via Giuseppe Failla, Roma, Roma Capitale, Lazio, Italia",
          address: {
            road: "Via Giuseppe Failla",
            postcode: "00125",
            city: "Roma",
          },
        }
      : {
          lat: "40.43081",
          lon: "-3.68591",
          display_name: "24, Calle de Claudio Coello, Madrid, Comunidad de Madrid, España",
          address: {
            house_number: "24",
            road: "Calle de Claudio Coello",
            postcode: "28001",
            city: "Madrid",
          },
        };
    return new Response(JSON.stringify([result]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const madrid = await resolveShopLocation({ directionsUrl: "Claudio Coello 24" });
  const rome = await resolveShopLocation({ directionsUrl: "giuseppe failla 61" });
  assert.deepEqual(madrid, {
    lat: 40.43081,
    lng: -3.68591,
    address: "Calle de Claudio Coello, 24, 28001 Madrid",
  });
  assert.deepEqual(rome, {
    lat: 41.78061,
    lng: 12.35671,
    address: "Via Giuseppe Failla, 61, 00125 Roma",
  });
  assert.match(
    getDirectionsUrl({ directionsUrl: "Claudio Coello 24", address: madrid.address }),
    /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=/,
  );
});

test("ships the supplied Ambar browser icons", async () => {
  const iconFiles = [
    "public/favicon-32x32.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
  ];

  const iconStats = await Promise.all(
    iconFiles.map((path) => stat(new URL(path, root))),
  );

  assert.ok(iconStats.every((icon) => icon.isFile() && icon.size > 0));
});

test("ships the database schema and migrations", async () => {
  const [schema, initialMigration, stateMigration, categoryMigration, directionsMigration, trackingMigration, hosting] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("drizzle/0000_talented_rafael_vega.sql", root), "utf8"),
    readFile(new URL("drizzle/0001_smiling_doctor_faustus.sql", root), "utf8"),
    readFile(new URL("drizzle/0002_ordinary_iron_fist.sql", root), "utf8"),
    readFile(new URL("drizzle/0003_backfill_directions_urls.sql", root), "utf8"),
    readFile(new URL("drizzle/0004_loud_mephisto.sql", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
  ]);

  assert.match(schema, /sqliteTable\("shops"/);
  assert.match(schema, /sqliteTable\("app_state"/);
  assert.match(initialMigration, /CREATE TABLE `shops`/);
  assert.equal(initialMigration.match(/CREATE TABLE/g)?.length, 1);
  assert.match(stateMigration, /CREATE TABLE `app_state`/);
  assert.match(categoryMigration, /ADD `category`/);
  assert.match(categoryMigration, /Thyssen-Bornemisza Museo Nacional/);
  assert.doesNotMatch(categoryMigration, /\(Tienda Museo\)/i);
  assert.match(directionsMigration, /UPDATE `shops`/);
  assert.match(directionsMigration, /WHERE trim\(`directions_url`\) = ''/);
  assert.match(trackingMigration, /ADD `visit_status` text DEFAULT 'not_visited' NOT NULL/);
  assert.match(trackingMigration, /ADD `reach_out_sent` integer DEFAULT false NOT NULL/);
  assert.match(trackingMigration, /ADD `followup_sent` integer DEFAULT false NOT NULL/);
  assert.match(trackingMigration, /ADD `manual_notes` text DEFAULT '' NOT NULL/);
  assert.equal(JSON.parse(hosting).d1, "DB");
  assert.equal(JSON.parse(hosting).r2, "UPLOADS");
});

test("validates shared add, edit, tracking, and delete API routes", async () => {
  const [collectionRoute, itemRoute] = await Promise.all([
    readFile(new URL("app/api/shops/route.ts", root), "utf8"),
    readFile(new URL("app/api/shops/[id]/route.ts", root), "utf8"),
  ]);

  assert.match(collectionRoute, /export async function GET/);
  assert.match(collectionRoute, /export async function POST/);
  assert.match(itemRoute, /export async function PUT/);
  assert.match(itemRoute, /export async function PATCH/);
  assert.match(itemRoute, /export async function DELETE/);
  assert.match(itemRoute, /\.delete\(shopsTable\)/);
  assert.match(collectionRoute, /onConflictDoNothing/);
});
