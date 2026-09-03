export type Coordinates = { lat: number; lng: number };
export type ResolvedShopLocation = Coordinates & { address: string };
export type MapCoordinateCandidates = {
  place: Coordinates | null;
  explicit: Coordinates | null;
  viewport: Coordinates | null;
};

export class LocationResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LocationResolutionError";
  }
}

function validCoordinates(coordinates: Coordinates) {
  return (
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lng >= -180 &&
    coordinates.lng <= 180
  );
}

function coordinatesFromMatch(value: string, pattern: RegExp) {
  const match = value.match(pattern);
  if (!match) return null;
  const coordinates = { lat: Number(match[1]), lng: Number(match[2]) };
  return validCoordinates(coordinates) ? coordinates : null;
}

export function parseMapCoordinateCandidates(value: string): MapCoordinateCandidates {
  if (!value.trim()) return { place: null, explicit: null, viewport: null };
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // The unescaped URL can still contain usable coordinates.
  }

  return {
    place: coordinatesFromMatch(
      decoded,
      /!3d(-?\d{1,2}(?:\.\d+)?).*?!4d(-?\d{1,3}(?:\.\d+)?)/,
    ),
    explicit: coordinatesFromMatch(
      decoded,
      /[?&](?:q|query|destination)=(-?\d{1,2}(?:\.\d+)?),(?:\s|\+)*(-?\d{1,3}(?:\.\d+)?)/,
    ),
    viewport: coordinatesFromMatch(
      decoded,
      /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    ),
  };
}

export function parseMapCoordinates(value: string): Coordinates | null {
  const candidates = parseMapCoordinateCandidates(value);
  return candidates.place || candidates.explicit || candidates.viewport;
}

export function coordinatesMapUrl(coordinates: Coordinates) {
  const query = `${coordinates.lat.toFixed(6)},${coordinates.lng.toFixed(6)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function isGoogleMapsUrl(value: string) {
  if (!value.trim()) return false;
  try {
    const { hostname, protocol } = new URL(value);
    if (protocol !== "https:" && protocol !== "http:") return false;
    const host = hostname.toLocaleLowerCase("en");
    return (
      host === "maps.app.goo.gl" ||
      host === "goo.gl" ||
      host === "google.com" ||
      host.endsWith(".google.com") ||
      /^(?:www\.|maps\.)?google\.(?:es|co\.uk|fr|de|it|pt|nl)$/.test(host)
    );
  } catch {
    return false;
  }
}

export function isManualAddress(value: string) {
  const candidate = value.trim();
  return (
    candidate.length >= 3 &&
    candidate.length <= 1600 &&
    !/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) &&
    /\p{L}/u.test(candidate)
  );
}

export function isLocationInput(value: string) {
  return isGoogleMapsUrl(value) || isManualAddress(value);
}

function mapsSearchQuery(value: string) {
  try {
    const url = new URL(value);
    for (const key of ["query", "q", "destination"]) {
      const candidate = url.searchParams.get(key)?.replace(/\+/g, " ").trim();
      if (candidate && !parseMapCoordinates(candidate)) return candidate;
    }

    const parts = decodeURIComponent(url.pathname).split("/").filter(Boolean);
    const placeIndex = parts.findIndex((part) => part === "place" || part === "search");
    const candidate = placeIndex >= 0 ? parts[placeIndex + 1]?.replace(/\+/g, " ").trim() : "";
    return candidate && !parseMapCoordinates(candidate) ? candidate : "";
  } catch {
    return "";
  }
}

async function resolveGoogleMapsLink(value: string) {
  let currentUrl = value;
  let query = mapsSearchQuery(currentUrl);
  const collected: MapCoordinateCandidates = {
    place: null,
    explicit: null,
    viewport: null,
  };

  const collect = (url: string) => {
    const candidates = parseMapCoordinateCandidates(url);
    collected.place ||= candidates.place;
    collected.explicit ||= candidates.explicit;
    collected.viewport ||= candidates.viewport;
    query ||= mapsSearchQuery(url);
  };

  try {
    for (let hop = 0; hop < 6; hop += 1) {
      if (!isGoogleMapsUrl(currentUrl)) return null;
      collect(currentUrl);
      if (collected.place || collected.explicit) {
        return { ...collected, query };
      }

      const response = await fetch(currentUrl, {
        redirect: "manual",
        headers: { "User-Agent": "Ambar Madrid Retail Mapping/1.0" },
        signal: AbortSignal.timeout(8_000),
      });
      const location = response.headers.get("location");
      if (response.status < 300 || response.status >= 400 || !location) {
        const finalUrl = response.url || currentUrl;
        collect(finalUrl);
        return { ...collected, query };
      }
      currentUrl = new URL(location, currentUrl).toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function coordinateDistanceMeters(first: Coordinates, second: Coordinates) {
  const earthRadius = 6_371_000;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(second.lat - first.lat);
  const longitudeDelta = toRadians(second.lng - first.lng);
  const firstLatitude = toRadians(first.lat);
  const secondLatitude = toRadians(second.lat);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(haversine));
}

export function chooseMapCoordinates({
  exact,
  recognized,
  viewport,
}: {
  exact: Coordinates | null;
  recognized: Coordinates | null;
  viewport: Coordinates | null;
}) {
  if (exact) return exact;
  if (
    recognized &&
    (!viewport || coordinateDistanceMeters(recognized, viewport) <= 25_000)
  ) {
    return recognized;
  }
  return viewport || recognized;
}

async function coordinatesFromSearchQuery(
  searchQuery: string,
  viewport: Coordinates | null,
) {
  const query = new URLSearchParams({
    q: searchQuery + ", Madrid, Spain",
    format: "jsonv2",
    limit: "5",
    countrycodes: "es",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Ambar Madrid Retail Mapping/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const candidates = results
      .map((result) => ({ lat: Number(result.lat), lng: Number(result.lon) }))
      .filter(validCoordinates);
    if (!candidates.length) return null;
    if (!viewport) return candidates[0];
    return candidates.sort(
      (first, second) =>
        coordinateDistanceMeters(first, viewport) -
        coordinateDistanceMeters(second, viewport),
    )[0];
  } catch {
    return null;
  }
}

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  square?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
};

function formatNominatimAddress(result: {
  display_name?: string;
  address?: NominatimAddress;
}) {
  const details = result.address;
  if (!details) return result.display_name?.trim() ?? "";

  const streetName = details.road || details.pedestrian || details.footway || details.square || "";
  const street = [streetName, details.house_number].filter(Boolean).join(", ");
  const city = details.city || details.town || details.village || details.municipality || "Madrid";
  const locality = [details.postcode, city].filter(Boolean).join(" ");
  return [street, locality].filter(Boolean).join(", ") || result.display_name?.trim() || "";
}

function normalizedAddressTokens(value: string) {
  const genericWords = new Set([
    "av", "avenida", "calle", "carrer", "corso", "de", "del", "della",
    "espana", "italia", "italy", "madrid", "piazza", "plaza", "roma",
    "rome", "spain", "street", "via", "viale",
  ]);
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .match(/[a-z0-9]+/g)
    ?.filter((token) => !genericWords.has(token)) ?? [];
}

export function manualAddressQueries(value: string) {
  const address = value.trim().replace(/\s+/g, " ");
  const queries = [address];
  const hasSpanishPrefix = /^(?:av(?:enida)?\.?|c\/?|calle|carrer|plaza)\b/i.test(address);
  const hasItalianPrefix = /^(?:corso|piazza|via|viale)\b/i.test(address);
  const hasPlaceContext = /\b(?:espana|españa|italia|italy|madrid|roma|rome|spain)\b/i.test(address);

  if (!hasPlaceContext) {
    if (hasSpanishPrefix) queries.push(`${address}, Madrid, España`);
    else if (hasItalianPrefix) queries.push(`${address}, Roma, Italia`);
    else {
      queries.push(`Calle de ${address}, Madrid, España`);
      queries.push(`Via ${address}, Roma, Italia`);
    }
  }
  return [...new Set(queries)];
}

export function manualAddressMatchScore(
  input: string,
  displayName: string,
  houseNumber = "",
) {
  const expectedTokens = normalizedAddressTokens(input);
  const resultTokens = new Set(normalizedAddressTokens(displayName));
  if (!expectedTokens.length) return 0;
  const matched = expectedTokens.filter((token) => resultTokens.has(token)).length;
  const requestedNumber = expectedTokens.find((token) => /^\d+[a-z]?$/.test(token));
  const numberMatches = Boolean(
    requestedNumber &&
      (normalizedAddressTokens(houseNumber).includes(requestedNumber) ||
        resultTokens.has(requestedNumber)),
  );
  return matched / expectedTokens.length + (numberMatches ? 1 : 0);
}

type NominatimSearchResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

async function locationFromManualAddress(value: string) {
  const requestedNumber = normalizedAddressTokens(value).find((token) => /^\d+[a-z]?$/.test(token));
  let best: { location: ResolvedShopLocation; score: number } | null = null;

  for (const addressQuery of manualAddressQueries(value)) {
    const query = new URLSearchParams({
      q: addressQuery,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
    });
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
        headers: {
          Accept: "application/json",
          "Accept-Language": "es,it,en",
          "User-Agent": "Ambar Madrid Retail Mapping/1.0",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const results = (await response.json()) as NominatimSearchResult[];
      for (const result of results) {
        const coordinates = { lat: Number(result.lat), lng: Number(result.lon) };
        const normalizedResult = requestedNumber && !result.address?.house_number
          ? {
              ...result,
              address: { ...result.address, house_number: requestedNumber },
            }
          : result;
        const address = formatNominatimAddress(normalizedResult);
        if (!validCoordinates(coordinates) || !address) continue;
        const score = manualAddressMatchScore(
          value,
          result.display_name || address,
          result.address?.house_number,
        );
        if (!best || score > best.score) {
          best = { location: { ...coordinates, address }, score };
        }
      }
      const confidentScore = requestedNumber ? 1.5 : 0.75;
      if (best && best.score >= confidentScore) return best.location;
    } catch {
      // Try the next normalized street variant.
    }
  }
  return best && best.score >= 0.5 ? best.location : null;
}

export async function addressFromCoordinates(coordinates: Coordinates) {
  const query = new URLSearchParams({
    lat: String(coordinates.lat),
    lon: String(coordinates.lng),
    format: "jsonv2",
    zoom: "18",
    addressdetails: "1",
  });

  try {
    const response = await fetch("https://nominatim.openstreetmap.org/reverse?" + query, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "Ambar Madrid Retail Mapping/1.0",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return "";
    return formatNominatimAddress(
      (await response.json()) as { display_name?: string; address?: NominatimAddress },
    );
  } catch {
    return "";
  }
}

export async function resolveShopLocation({
  directionsUrl,
  manualLocation,
}: {
  directionsUrl: string;
  manualLocation?: Coordinates | null;
}): Promise<ResolvedShopLocation> {
  if (manualLocation && validCoordinates(manualLocation)) {
    const detectedAddress = await addressFromCoordinates(manualLocation);
    const fallbackAddress = isManualAddress(directionsUrl)
      ? directionsUrl.trim()
      : `${manualLocation.lat.toFixed(6)}, ${manualLocation.lng.toFixed(6)}`;
    return {
      ...manualLocation,
      address: detectedAddress || fallbackAddress,
    };
  }

  if (!directionsUrl) {
    throw new LocationResolutionError("Google Maps link or address is required.");
  }
  if (!isGoogleMapsUrl(directionsUrl)) {
    if (!isManualAddress(directionsUrl)) {
      throw new LocationResolutionError("Paste a valid Google Maps link or type a street address.");
    }
    const manualLocation = await locationFromManualAddress(directionsUrl);
    if (manualLocation) return manualLocation;
    throw new LocationResolutionError(
      "We could not recognize this address. Try adding the city or country, then save again.",
    );
  }

  const resolvedLink = await resolveGoogleMapsLink(directionsUrl);
  const exactCoordinates = resolvedLink?.place || resolvedLink?.explicit || null;
  const recognizedCoordinates =
    !exactCoordinates && resolvedLink?.query
      ? await coordinatesFromSearchQuery(
          resolvedLink.query,
          resolvedLink.viewport,
        )
      : null;
  const coordinates = chooseMapCoordinates({
    exact: exactCoordinates,
    recognized: recognizedCoordinates,
    viewport: resolvedLink?.viewport || null,
  });
  if (!coordinates) {
    throw new LocationResolutionError(
      "We could not find this shop from the Google Maps link. Open the exact shop in Google Maps, choose Share, and paste that link.",
    );
  }

  const address = await addressFromCoordinates(coordinates);
  if (address) return { ...coordinates, address };

  throw new LocationResolutionError(
    "We found the map position but could not extract its address. Please try the shop's Google Maps Share link again.",
  );
}
