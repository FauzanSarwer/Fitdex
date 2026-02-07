"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface MapViewProps {
  latitude: number;
  longitude: number;
  gyms?: Array<{ id: string; name: string; latitude: number; longitude: number; url?: string }>;
  className?: string;
  zoom?: number;
}

export function MapView({ latitude, longitude, gyms = [], className, zoom = 13 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);

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
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = null;
      }
    };
  }, []);

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Create map
    const map = L.map(containerRef.current).setView([latitude, longitude], zoom);

    // Add dark tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    updateMarkers();

    mapRef.current = map;
  };

  const updateMarkers = () => {
    if (!mapRef.current || !markersRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    markersRef.current.clearLayers();

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
      .addTo(markersRef.current)
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
        .addTo(markersRef.current)
        .bindPopup(
          gym.url
            ? `<div style="display:flex;flex-direction:column;gap:4px"><strong>${gym.name}</strong><a href="${gym.url}" style="color:#22c55e;text-decoration:underline" target="_blank" rel="noreferrer">View gym</a></div>`
            : gym.name
        );
    });
  };

  useEffect(() => {
    if (!mapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Update map view when coordinates change
    mapRef.current.setView([latitude, longitude], zoom);
    updateMarkers();
  }, [latitude, longitude, zoom, gyms]);

  return (
    <div
      ref={containerRef}
      className={cn("rounded-2xl overflow-hidden min-h-[200px] bg-white/5 border border-white/10", className)}
    />
  );
}
