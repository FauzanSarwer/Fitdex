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

const TIMEOUT_MS = 5000; // Timeout for HTTP requests (in milliseconds)
const USER_AGENT = process.env.NOMINATIM_USER_AGENT ?? "FitDex/1.0"; // User agent for API requests
const DEFAULT_CITY = "Unknown";
const DEFAULT_STATE = "Unknown";

interface GeocodeResponse {
  city: string;
  state: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
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
    return res;
  } catch (error) {
    console.error("Error during fetch:", error);
    clearTimeout(timeout);
    return null;
  }
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
  if (typeof address !== "string" || !address.trim()) {
    console.warn("Invalid address provided for forwardGeocode:", address);
    return null;
  }

  try {
    const q = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`;
    const res = await fetchWithTimeout(url);
    if (!res || !res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0];
    const lat = parseFloat(first?.lat);
    const lng = parseFloat(first?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch (error) {
    console.error("Error in forwardGeocode:", error);
    return null;
  }
}
