import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";

const FALLBACK_IMAGE = "/placeholder-gym.svg";

export interface GymCardData {
  id: string;
  slug: string;
  name: string | null;
  city: string | null;
  address: string | null;
  monthlyPrice: number | null;
  rating?: number | null;
  amenities?: string[] | null;
  imageUrl?: string | null;
}

function formatLocation(city: string | null, address: string | null): string {
  if (city && address) return `${city} · ${address}`;
  if (city) return city;
  if (address) return address;
  return "Location not listed";
}

export function GymCard({ gym }: { gym: GymCardData }) {
  const name = gym.name?.trim() || "Unnamed gym";
  const amenities = (gym.amenities ?? []).filter(Boolean).slice(0, 3);
  const imageUrl = gym.imageUrl || FALLBACK_IMAGE;
  const ratingText = typeof gym.rating === "number" && Number.isFinite(gym.rating)
    ? gym.rating.toFixed(1)
    : "New";

  return (
    <Link
      href={`/gym/${gym.slug}`}
      className="block rounded-2xl border border-white/10 bg-white/5 transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={`View ${name}`}
    >
      <article>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl bg-muted/20">
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover"
          />
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-1 text-base font-semibold">{name}</h3>
          <p className="line-clamp-1 text-sm text-muted-foreground">{formatLocation(gym.city, gym.address)}</p>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {typeof gym.monthlyPrice === "number" ? `Starts at ${formatPrice(gym.monthlyPrice)}` : "Price on request"}
            </span>
            <span className="font-medium text-foreground">{ratingText}</span>
          </div>
          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {amenities.map((amenity) => (
                <span
                  key={amenity}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {amenity}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

export function GymCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="aspect-[4/3] w-full animate-pulse bg-white/10" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
