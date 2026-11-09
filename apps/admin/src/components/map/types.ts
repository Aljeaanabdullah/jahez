// The map contract used by the screens. Today it is drawn with Leaflet + OpenStreetMap
// (map-canvas-leaflet.tsx). To switch to Google Maps later, write another canvas with
// the same props and change the import in map-picker.tsx only.

export type LatLng = { lat: number; lng: number };

export type MapCircle = LatLng & {
  radius: number;
  label?: string;
  tone: "site" | "building" | "danger" | "safe";
};

export type MapCanvasProps = {
  /** The point being edited, if any. */
  value: (LatLng & { radius: number }) | null;
  /** Other circles to show for context (e.g. the site around a building). */
  context?: MapCircle[];
  /** Where to look when nothing is set yet. */
  fallbackCenter: LatLng;
  onPick?: (point: LatLng) => void;
  attributionLabel?: string;
};

/** Kuwait City. */
export const KUWAIT_CENTER: LatLng = { lat: 29.3759, lng: 47.9774 };
