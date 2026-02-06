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
  try {
    // Use OpenStreetMap's Nominatim API (free, no API key required)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    const data = await res.json();
    
    if (!data.address) return null;
    
    // Extract city and state from OpenStreetMap address components
    const address = data.address;
    let city = address.city || address.town || address.village || address.county || "";
    let state = address.state || "";
    
    return { 
      city: city || "Unknown", 
      state: state || "Unknown" 
    };
  } catch {
    // Fallback: if within Delhi NCR, return Delhi
    if (isWithinDelhiNCR(lat, lng)) {
      return { city: "Delhi", state: "Delhi" };
    }
    return null;
  }
}
