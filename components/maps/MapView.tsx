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

const LABEL_MIN_ZOOM = 14;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    updateMarkers();
    map.on("zoomend", updateMarkers);
    setTimeout(() => map.invalidateSize(), 0);
  };

  const updateMarkers = () => {
    if (!mapRef.current || !markersRef.current) return;
    const L = (window as any).L;
    if (!L) return;
    const currentZoom = mapRef.current?.getZoom?.() ?? zoom;
    const key = `${centerKey}|${gymsKey}|${currentZoom}`;
    if (key === lastMarkersKeyRef.current) return;
    lastMarkersKeyRef.current = key;
    markersRef.current.clearLayers();

    const createMarkerIcon = (type: "gym" | "user") =>
      L.divIcon({
        className: "fitdex-map-marker-host",
        html:
          type === "user"
            ? '<span class="fitdex-map-marker fitdex-map-marker-user"><span class="fitdex-map-marker-core"></span></span>'
            : '<span class="fitdex-map-marker fitdex-map-marker-gym"><span class="fitdex-map-marker-core"></span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

    if (showUserMarker) {
      L.marker([latitude, longitude], {
        title: "You",
        icon: createMarkerIcon("user"),
      })
        .addTo(markersRef.current)
        .bindPopup("Your location");
    }

    // Add gym markers
    const showLabels = currentZoom >= LABEL_MIN_ZOOM;
    gyms.forEach((gym) => {
      const marker = L.marker([gym.latitude, gym.longitude], {
        title: gym.name,
        icon: createMarkerIcon("gym"),
      })
        .addTo(markersRef.current);

      if (showLabels) {
        marker.bindTooltip(escapeHtml(gym.name), {
          permanent: true,
          direction: "top",
          offset: [0, -14],
          className: "fitdex-map-label",
          opacity: 1,
        });
      }

      marker.bindPopup(
        gym.url
          ? `<div style="display:flex;flex-direction:column;gap:4px"><strong>${escapeHtml(gym.name)}</strong><a href="${gym.url}" style="color:#22c55e;text-decoration:underline" target="_blank" rel="noreferrer">View gym</a></div>`
          : escapeHtml(gym.name)
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
