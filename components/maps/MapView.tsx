"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MapViewProps {
  latitude: number;
  longitude: number;
  gyms?: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  className?: string;
  zoom?: number;
}

interface GoogleMapsWindow {
  google?: {
    maps: {
      Map: new (el: HTMLElement, opts: Record<string, unknown>) => unknown;
      LatLng: new (lat: number, lng: number) => unknown;
      Marker: new (opts: Record<string, unknown>) => void;
    };
  };
}

export function MapView({ latitude, longitude, gyms = [], className, zoom = 13 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!key || key === "XXXXX") {
      setScriptLoaded(true);
      return;
    }
    const w = window as unknown as { google?: { maps?: unknown } };
    if (w.google?.maps) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
  }, [key]);

  useEffect(() => {
    if (!scriptLoaded || !containerRef.current || !key || key === "XXXXX") return;
    const g = (window as unknown as GoogleMapsWindow).google;
    if (!g?.maps) return;
    const map = new g.maps.Map(containerRef.current, {
      center: { lat: latitude, lng: longitude },
      zoom,
      styles: [
        { elementType: "geometry", stylers: [{ color: "#1d1d2e" }] },
        { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
        { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d2e" }] },
      ],
      disableDefaultUI: false,
      zoomControl: true,
    });
    new g.maps.Marker({
      position: new g.maps.LatLng(latitude, longitude),
      map,
      title: "You",
    });
    gyms.forEach((gym) => {
      new g.maps.Marker({
        position: new g.maps.LatLng(gym.latitude, gym.longitude),
        map,
        title: gym.name,
      });
    });
  }, [scriptLoaded, latitude, longitude, gyms, key, zoom]);

  if (!key || key === "XXXXX") {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-muted-foreground text-sm",
          className
        )}
      >
        <div className="text-center p-6">
          <p>Map preview (set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for live map)</p>
          <p className="mt-2 text-xs">
            Your location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </p>
          {gyms.length > 0 && (
            <p className="mt-1 text-xs">{gyms.length} gym(s) nearby</p>
          )}
        </div>
      </div>
    );
  }

  if (!scriptLoaded) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-white/10 bg-white/5 animate-pulse flex items-center justify-center",
          className
        )}
      >
        <span className="text-muted-foreground text-sm">Loading map…</span>
      </div>
    );
  }

  return <div ref={containerRef} className={cn("rounded-2xl overflow-hidden min-h-[200px]", className)} />;
}
