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

export function isWithinDelhiNCR(lat: number, lng: number): boolean {
  return (
    lat >= DELHI_BOUNDS.latMin &&
    lat <= DELHI_BOUNDS.latMax &&
    lng >= DELHI_BOUNDS.lngMin &&
    lng <= DELHI_BOUNDS.lngMax
  );
}

export function isCityServiceable(city: string | null): boolean {
  if (!city || !city.trim()) return false;
  const normalized = city.toLowerCase().trim();
  return DELHI_CITIES.some((c) => normalized.includes(c));
}

export function isIndia(lat: number, lng: number): boolean {
  return lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97;
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ city: string; state: string } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key || key === "XXXXX") {
    if (isWithinDelhiNCR(lat, lng))
      return { city: "Delhi", state: "Delhi" };
    return null;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;
    const components = data.results[0].address_components as Array<{
      long_name: string;
      types: string[];
    }>;
    let city = "";
    let state = "";
    for (const c of components) {
      if (c.types.includes("locality")) city = c.long_name;
      if (c.types.includes("administrative_area_level_1")) state = c.long_name;
    }
    return { city: city || "Unknown", state: state || "Unknown" };
  } catch {
    return isWithinDelhiNCR(lat, lng) ? { city: "Delhi", state: "Delhi" } : null;
  }
}
