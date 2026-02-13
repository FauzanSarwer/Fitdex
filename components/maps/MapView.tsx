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

type LeafletMapLike = {
  setView: (coords: [number, number], zoom: number) => LeafletMapLike;
  on: (eventName: string, handler: () => void) => void;
  getZoom: () => number;
  invalidateSize: () => void;
  remove: () => void;
};

type LeafletMarkerLike = {
  addTo: (layer: LeafletLayerGroupLike) => LeafletMarkerLike;
  bindPopup: (content: string) => LeafletMarkerLike;
  bindTooltip: (
    content: string,
    options: { permanent: boolean; direction: "top"; offset: [number, number]; className: string; opacity: number }
  ) => LeafletMarkerLike;
};

type LeafletLayerGroupLike = {
  addTo: (map: LeafletMapLike) => LeafletLayerGroupLike;
  clearLayers: () => void;
};

type LeafletLike = {
  map: (container: HTMLDivElement, options: { zoomControl: boolean; preferCanvas: boolean }) => LeafletMapLike;
  tileLayer: (url: string, options: { maxZoom: number; attribution: string }) => { addTo: (map: LeafletMapLike) => void };
  layerGroup: () => LeafletLayerGroupLike;
  marker: (
    coords: [number, number],
    options: { title: string; icon: unknown }
  ) => LeafletMarkerLike;
  divIcon: (options: { className: string; html: string; iconSize: [number, number]; iconAnchor: [number, number] }) => unknown;
};

type FitdexWindow = Window & {
  L?: LeafletLike;
  __fitdexLeafletPromise?: Promise<void>;
};

const LABEL_MIN_ZOOM = 14;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getLeafletWindow = (): FitdexWindow | null => {
  if (typeof window === "undefined") return null;
  return window as FitdexWindow;
};

export function MapView({ latitude, longitude, gyms = [], className, zoom = 13, showUserMarker = false }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapLike | null>(null);
  const markersRef = useRef<LeafletLayerGroupLike | null>(null);
  const markerIconsRef = useRef<{ gym: unknown; user: unknown } | null>(null);
  const lastMarkersKeyRef = useRef<string>("");

  const gymsKey = useMemo(() => {
    if (!gyms.length) return "";
    return gyms.map((g) => `${g.id}:${g.latitude}:${g.longitude}:${g.url ?? ""}`).join("|");
  }, [gyms]);

  const centerKey = useMemo(
    () => `${latitude}:${longitude}:${zoom}:${showUserMarker ? 1 : 0}`,
    [latitude, longitude, zoom, showUserMarker]
  );

  const loadLeaflet = () => {
    const win = getLeafletWindow();
    if (!win) return Promise.resolve(null);
    if (win.__fitdexLeafletPromise) return win.__fitdexLeafletPromise;

    win.__fitdexLeafletPromise = new Promise<void>((resolve) => {
      if (win.L) {
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

    return win.__fitdexLeafletPromise;
  };

  const updateMarkers = () => {
    const map = mapRef.current;
    const markers = markersRef.current;
    const win = getLeafletWindow();
    if (!map || !markers || !win?.L || !markerIconsRef.current) return;

    const currentZoom = map.getZoom?.() ?? zoom;
    const key = `${centerKey}|${gymsKey}|${currentZoom}`;
    if (key === lastMarkersKeyRef.current) return;
    lastMarkersKeyRef.current = key;

    markers.clearLayers();

    if (showUserMarker) {
      win.L.marker([latitude, longitude], {
        title: "You",
        icon: markerIconsRef.current.user,
      })
        .addTo(markers)
        .bindPopup("Your location");
    }

    const showLabels = currentZoom >= LABEL_MIN_ZOOM;
    for (const gym of gyms) {
      const marker = win.L.marker([gym.latitude, gym.longitude], {
        title: gym.name,
        icon: markerIconsRef.current.gym,
      }).addTo(markers);

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
    }
  };

  const initMap = () => {
    if (!containerRef.current || mapRef.current) return;

    const win = getLeafletWindow();
    if (!win?.L) return;

    const map = win.L.map(containerRef.current, {
      zoomControl: false,
      preferCanvas: true,
    }).setView([latitude, longitude], zoom);

    win.L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors © CARTO",
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = win.L.layerGroup().addTo(map);
    markerIconsRef.current = {
      user: win.L.divIcon({
        className: "fitdex-map-marker-host",
        html: '<span class="fitdex-map-marker fitdex-map-marker-user"><span class="fitdex-map-marker-core"></span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
      gym: win.L.divIcon({
        className: "fitdex-map-marker-host",
        html: '<span class="fitdex-map-marker fitdex-map-marker-gym"><span class="fitdex-map-marker-core"></span></span>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    };

    updateMarkers();
    map.on("zoomend", updateMarkers);
    setTimeout(() => map.invalidateSize(), 0);
  };

  useEffect(() => {
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
        markerIconsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView([latitude, longitude], zoom);
    updateMarkers();
  }, [centerKey, gymsKey]);

  return <div ref={containerRef} className={cn("rounded-2xl overflow-hidden min-h-[200px] bg-white/5 border border-white/10", className)} />;
}
