"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Field, Input } from "../ui";
import { KUWAIT_CENTER, type MapCircle } from "./types";

// Swap this import to change map provider (see types.ts).
const MapCanvas = dynamic(() => import("./map-canvas-leaflet"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse rounded-xl bg-line" />,
});

/**
 * Picks a point and a radius. Writes `latitude`, `longitude` and `radius_m` form fields,
 * which can also be typed directly (useful for exact coordinates).
 */
export function MapPicker({
  defaultValue,
  defaultRadius,
  minRadius,
  maxRadius,
  context,
  labels,
}: {
  defaultValue?: { lat: number; lng: number; radius: number } | null;
  defaultRadius: number;
  minRadius: number;
  maxRadius: number;
  context?: MapCircle[];
  labels: { latitude: string; longitude: string; radius: string; hint: string };
}) {
  const [lat, setLat] = useState(defaultValue ? String(defaultValue.lat) : "");
  const [lng, setLng] = useState(defaultValue ? String(defaultValue.lng) : "");
  const [radius, setRadius] = useState(String(defaultValue?.radius ?? defaultRadius));

  const latN = Number(lat);
  const lngN = Number(lng);
  const radiusN = Number(radius);
  const hasPoint = lat !== "" && lng !== "" && Number.isFinite(latN) && Number.isFinite(lngN) && Math.abs(latN) <= 90 && Math.abs(lngN) <= 180;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted">{labels.hint}</p>
      <MapCanvas
        value={hasPoint ? { lat: latN, lng: lngN, radius: Number.isFinite(radiusN) && radiusN > 0 ? radiusN : defaultRadius } : null}
        context={context}
        fallbackCenter={KUWAIT_CENTER}
        onPick={(p) => {
          setLat(String(p.lat));
          setLng(String(p.lng));
        }}
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={labels.latitude}>
          <Input name="latitude" inputMode="decimal" dir="ltr" value={lat} onChange={(e) => setLat(e.target.value)} required />
        </Field>
        <Field label={labels.longitude}>
          <Input name="longitude" inputMode="decimal" dir="ltr" value={lng} onChange={(e) => setLng(e.target.value)} required />
        </Field>
        <Field label={labels.radius}>
          <Input
            name="radius_m"
            type="number"
            min={minRadius}
            max={maxRadius}
            step={1}
            dir="ltr"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            required
          />
        </Field>
      </div>
      <input
        type="range"
        aria-label={labels.radius}
        min={minRadius}
        max={Math.min(maxRadius, 1000)}
        step={5}
        value={Number.isFinite(radiusN) ? radiusN : defaultRadius}
        onChange={(e) => setRadius(e.target.value)}
        className="accent-primary"
      />
    </div>
  );
}
