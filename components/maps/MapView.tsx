"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MapViewProps {
  latitude: number;
  longitude: number;
  gyms?: Array<{ id: string; name: string; latitude: number; longitude: number }>;
  className?: string;
  zoom?: number;
}

export function MapView({ latitude, longitude, gyms = [], className, zoom = 13 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    // Load Leaflet CSS and JS
    if (typeof window === "undefined") return;
    
    // Check if Leaflet is already loaded
    if ((window as any).L) {
      initMap();
      return;
    }

    // Load Leaflet CSS
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(cssLink);

    // Load Leaflet JS
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.async = true;
    script.onload = initMap;
    document.head.appendChild(script);
  }, []);

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Create map
    const map = L.map(containerRef.current).setView([latitude, longitude], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Add user marker
    L.marker([latitude, longitude], {
      title: "You",
      icon: L.icon({
        iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      }),
    })
      .addTo(map)
      .bindPopup("Your location");

    // Add gym markers
    gyms.forEach((gym) => {
      L.marker([gym.latitude, gym.longitude], {
        title: gym.name,
        icon: L.icon({
          iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41],
        }),
      })
        .addTo(map)
        .bindPopup(gym.name);
    });

    mapRef.current = map;
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    
    // Update map view when coordinates change
    mapRef.current.setView([latitude, longitude], zoom);
  }, [latitude, longitude, zoom]);

  return (
    <div
      ref={containerRef}
      className={cn("rounded-2xl overflow-hidden min-h-[200px] bg-white/5 border border-white/10", className)}
    />
  );
}
