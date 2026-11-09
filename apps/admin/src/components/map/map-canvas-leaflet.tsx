"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MapCanvasProps } from "./types";

const toneColor = {
  site: "#1565c0",
  building: "#5a6b85",
  danger: "#d32f2f",
  safe: "#2e7d32",
} as const;

function ClickToPick({ onPick }: { onPick?: MapCanvasProps["onPick"] }) {
  useMapEvents({
    click: (e) => onPick?.({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) }),
  });
  return null;
}

/** Keeps the edited point in view when it is typed in or picked. */
function FollowValue({ value }: { value: MapCanvasProps["value"] }) {
  const map = useMap();
  useEffect(() => {
    if (!value) return;
    const target: [number, number] = [value.lat, value.lng];
    if (!map.getBounds().pad(-0.2).contains(target)) {
      map.setView(target, Math.max(map.getZoom(), 16));
    }
  }, [map, value]);
  return null;
}

export default function LeafletMapCanvas({ value, context = [], fallbackCenter, onPick }: MapCanvasProps) {
  const center = value ?? context[0] ?? fallbackCenter;
  const zoom = value || context.length ? 17 : 12;

  // Leaflet expects left-to-right layout even on Arabic pages.
  return (
    <div dir="ltr">
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom
      className="h-80 w-full rounded-xl border border-line"
      style={{ cursor: onPick ? "crosshair" : undefined }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {context.map((c, i) => (
        <Circle
          key={i}
          center={[c.lat, c.lng]}
          radius={c.radius}
          pathOptions={{ color: toneColor[c.tone], weight: 1.5, fillOpacity: c.tone === "site" ? 0.06 : 0.18 }}
        >
          {c.label && <Tooltip>{c.label}</Tooltip>}
        </Circle>
      ))}
      {value && (
        <>
          <Circle
            center={[value.lat, value.lng]}
            radius={value.radius}
            pathOptions={{ color: toneColor.site, weight: 2, fillOpacity: 0.15 }}
          />
          <CircleMarker
            center={[value.lat, value.lng]}
            radius={6}
            pathOptions={{ color: "#ffffff", weight: 2, fillColor: toneColor.site, fillOpacity: 1 }}
          />
        </>
      )}
      <ClickToPick onPick={onPick} />
      <FollowValue value={value} />
    </MapContainer>
    </div>
  );
}
