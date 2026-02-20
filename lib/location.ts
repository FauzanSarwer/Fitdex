const DELHI_BOUNDS = {
  latMin: 28.4,
  latMax: 28.9,
  lngMin: 76.8,
  lngMax: 77.4,
};

const DELHI_CITIES = [
  "delhi",
  "new delhi",
  "noida",
  "greater noida",
  "ghaziabad",
  "gurgaon",
  "gurugram",
  "faridabad",
  "sonipat",
  "bahadurgarh",
];

const TIMEOUT_MS = Number(process.env.GEOCODE_TIMEOUT_MS ?? 5000);
const MAX_ATTEMPTS = 2;
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "FitDex/1.0"; // User agent for API requests
const DEFAULT_CITY = "Unknown";
const DEFAULT_STATE = "Unknown";
const PROVIDER_ORDER = (process.env.GEOCODE_PROVIDER_ORDER ?? "nominatim,mapsco,photon")
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean) as GeocodeProvider[];
const MAPSCO_API_KEY = process.env.GEOCODE_MAPSCO_API_KEY ?? "";

interface GeocodeResponse {
  city: string;
  state: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

type GeocodeProvider = "nominatim" | "mapsco" | "photon";

export type ForwardGeocodeResult = Coordinates & {
  provider: GeocodeProvider;
  formattedAddress?: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCoordinates(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeCoordinates(latitude: unknown, longitude: unknown): Coordinates | null {
  const lat = parseCoordinates(latitude);
  const lng = parseCoordinates(longitude);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok && attempt < MAX_ATTEMPTS && (res.status === 429 || res.status >= 500)) {
        await sleep(200 * attempt);
        continue;
      }
      return res;
    } catch (error) {
      console.error("Error during fetch:", error);
      clearTimeout(timeout);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(200 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function forwardGeocodeNominatim(address: string): Promise<ForwardGeocodeResult | null> {
  const q = encodeURIComponent(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  const coords = normalizeCoordinates(first?.lat, first?.lon);
  if (!coords) return null;
  return {
    ...coords,
    provider: "nominatim",
    formattedAddress: typeof first?.display_name === "string" ? first.display_name : null,
  };
}

async function forwardGeocodeMapsCo(address: string): Promise<ForwardGeocodeResult | null> {
  const q = encodeURIComponent(address);
  const keyQuery = MAPSCO_API_KEY ? `&api_key=${encodeURIComponent(MAPSCO_API_KEY)}` : "";
  const url = `https://geocode.maps.co/search?q=${q}&limit=1${keyQuery}`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  const coords = normalizeCoordinates(first?.lat, first?.lon);
  if (!coords) return null;
  return {
    ...coords,
    provider: "mapsco",
    formattedAddress: typeof first?.display_name === "string" ? first.display_name : null,
  };
}

async function forwardGeocodePhoton(address: string): Promise<ForwardGeocodeResult | null> {
  const q = encodeURIComponent(address);
  const url = `https://photon.komoot.io/api/?q=${q}&limit=1`;
  const res = await fetchWithTimeout(url);
  if (!res || !res.ok) return null;
  const data = await res.json();
  const features = Array.isArray(data?.features) ? data.features : [];
  if (features.length === 0) return null;
  const first = features[0];
  const coords = Array.isArray(first?.geometry?.coordinates)
    ? normalizeCoordinates(first.geometry.coordinates[1], first.geometry.coordinates[0])
    : null;
  if (!coords) return null;
  return {
    ...coords,
    provider: "photon",
    formattedAddress:
      typeof first?.properties?.name === "string" ? first.properties.name : null,
  };
}

async function geocodeViaProvider(
  provider: GeocodeProvider,
  address: string
): Promise<ForwardGeocodeResult | null> {
  if (provider === "mapsco") return forwardGeocodeMapsCo(address);
  if (provider === "photon") return forwardGeocodePhoton(address);
  return forwardGeocodeNominatim(address);
}

export function isWithinDelhiNCR(lat: number, lng: number): boolean {
  return (
    lat >= DELHI_BOUNDS.latMin &&
    lat <= DELHI_BOUNDS.latMax &&
    lng >= DELHI_BOUNDS.lngMin &&
    lng <= DELHI_BOUNDS.lngMax
  );
}

export function isCityServiceable(city: string | null): boolean {
  if (typeof city !== "string" || !city.trim()) return false;
  const normalized = city.toLowerCase().trim();
  return DELHI_CITIES.some((c) => normalized.includes(c));
}

export function isIndia(lat: number, lng: number): boolean {
  return lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResponse | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetchWithTimeout(url);
    if (!res || !res.ok) return null;
    const data = await res.json();

    if (!data.address) return null;

    const address = data.address;
    const city = address.city || address.town || address.village || address.county || DEFAULT_CITY;
    const state = address.state || DEFAULT_STATE;

    return { city, state };
  } catch (error) {
    console.error("Error in reverseGeocode:", error);
    if (isWithinDelhiNCR(lat, lng)) {
      return { city: "Delhi", state: "Delhi" };
    }
    return null;
  }
}

export async function forwardGeocode(
  address: string
): Promise<Coordinates | null> {
  const detailed = await resolveAddressToCoordinates(address);
  if (!detailed) return null;
  return {
    latitude: detailed.latitude,
    longitude: detailed.longitude,
  };
}

export async function resolveAddressToCoordinates(
  address: string
): Promise<ForwardGeocodeResult | null> {
  if (typeof address !== "string" || !address.trim()) {
    console.warn("Invalid address provided for forwardGeocode:", address);
    return null;
  }

  try {
    for (const provider of PROVIDER_ORDER) {
      const result = await geocodeViaProvider(provider, address.trim());
      if (result) return result;
    }
    return null;
  } catch (error) {
    console.error("Error in forwardGeocode:", error);
    return null;
  }
}
