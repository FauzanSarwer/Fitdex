export const cities = [
  "delhi",
  "mumbai",
  "bangalore",
  "hyderabad",
  "chennai",
  "pune"
] as const;

export type City = typeof cities[number];
