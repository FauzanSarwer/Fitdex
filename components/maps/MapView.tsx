"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

interface MapViewProps {
  latitude: number;
  longitude: number;
  gyms?: Array<{ id: string; name: string; latitude: number; longitude: number; url?: string }>;
  className?: string;
  zoom?: number;
  showUserMarker?: boolean;
}

export function MapView({ latitude, longitude, gyms = [], className, zoom = 13, showUserMarker = false }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const lastMarkersKeyRef = useRef<string>("");

  const gymsKey = useMemo(() => {
    if (!gyms.length) return "";
    return gyms.map((g) => `${g.id}:${g.latitude}:${g.longitude}`).join("|");
  }, [gyms]);

  const centerKey = useMemo(() => `${latitude}:${longitude}:${zoom}:${showUserMarker ? 1 : 0}`, [latitude, longitude, zoom, showUserMarker]);

  const loadLeaflet = () => {
    if (typeof window === "undefined") return Promise.resolve(null);
    if ((window as any).__fitdexLeafletPromise) return (window as any).__fitdexLeafletPromise;

    (window as any).__fitdexLeafletPromise = new Promise<void>((resolve) => {
      if ((window as any).L) {
        resolve();
        return;
      }

      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(cssLink);

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });

    return (window as any).__fitdexLeafletPromise as Promise<void>;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    loadLeaflet().then(() => {
      if (cancelled) return;
      initMap();
    });
    return () => {
      cancelled = true;
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
    const map = L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
    }).setView([latitude, longitude], zoom);

    // Add lighter tiles for better label contrast
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors © CARTO',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    updateMarkers();

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);
  };

  const updateMarkers = () => {
    if (!mapRef.current || !markersRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const key = `${centerKey}|${gymsKey}`;
    if (key === lastMarkersKeyRef.current) return;
    lastMarkersKeyRef.current = key;
    markersRef.current.clearLayers();

    if (showUserMarker) {
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
    }

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
  }, [centerKey, gymsKey]);

  return (
    <div
      ref={containerRef}
      className={cn("rounded-2xl overflow-hidden min-h-[200px] bg-white/5 border border-white/10", className)}
    />
  );
}
