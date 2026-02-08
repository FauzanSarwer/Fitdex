export type AmenityOption = {
  value: string;
  label: string;
  emoji: string;
};

export const AMENITY_OPTIONS: AmenityOption[] = [
  { value: "Sauna", label: "Sauna", emoji: "🔥" },
  { value: "Paid Locker Facility", label: "Paid Locker Facility", emoji: "🔒" },
  { value: "Free Locker Facility", label: "Free Locker Facility", emoji: "🆓" },
  { value: "Changing Rooms", label: "Changing Rooms", emoji: "🚪" },
  { value: "Professional Trainers", label: "Professional Trainers", emoji: "🏋️" },
  { value: "Shower", label: "Shower", emoji: "🚿" },
  { value: "Parking", label: "Parking", emoji: "🚗" },
  { value: "AC", label: "Air conditioning", emoji: "❄️" },
];

const AMENITY_ICON_MAP = new Map(AMENITY_OPTIONS.map((a) => [a.value.toLowerCase(), a.emoji]));

export function getAmenityEmoji(name?: string | null) {
  if (!name) return "";
  return AMENITY_ICON_MAP.get(name.toLowerCase()) ?? "✨";
}
