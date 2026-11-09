// Face alignment shared by web and mobile ("align-v1").
// Same rule in apps/mobile/lib/face/align.dart; both are checked against
// tools/face-model/align-fixtures.json (computed independently in Python).
//
// Only eye centres and mouth corners are used, because both face detectors provide them.
// The face is rotated so the eyes are level and scaled so that the eye-to-mouth distance is
// 55 px, with the point between the eyes at (75, 45): close to dlib's own 150x150 face chip,
// which the model was trained on.

export const CHIP = 150;
export const EYES_TARGET = { x: 75, y: 45 };
export const EYE_MOUTH_TARGET = 55;
export const ALIGN_VERSION = "align-v1";

export type Point = { x: number; y: number };
export type FaceKeyPoints = { eyes: [Point, Point]; mouth: [Point, Point] };

/** Affine map from chip pixel (u, v) to source pixel (x, y): x = a·u + b·v + c, y = d·u + e·v + f. */
export type Affine = { a: number; b: number; c: number; d: number; e: number; f: number };

const byX = (p: [Point, Point]): [Point, Point] => (p[0].x <= p[1].x ? p : [p[1], p[0]]);
const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });

export function alignment(points: FaceKeyPoints): Affine {
  const [e1, e2] = byX(points.eyes);
  const [m1, m2] = byX(points.mouth);
  const eyes = mid(e1, e2);
  const mouth = mid(m1, m2);
  const theta = Math.atan2(e2.y - e1.y, e2.x - e1.x);
  const dist = Math.hypot(mouth.x - eyes.x, mouth.y - eyes.y);
  if (!(dist > 0)) throw new Error("degenerate face points");
  const k = dist / EYE_MOUTH_TARGET; // source pixels per chip pixel
  const a = k * Math.cos(theta);
  const b = -k * Math.sin(theta);
  const d = k * Math.sin(theta);
  const e = k * Math.cos(theta);
  return {
    a,
    b,
    c: eyes.x - a * EYES_TARGET.x - b * EYES_TARGET.y,
    d,
    e,
    f: eyes.y - d * EYES_TARGET.x - e * EYES_TARGET.y,
  };
}

/**
 * Samples a 150x150 RGB chip (values 0..255, row-major, 3 per pixel) from an RGBA image,
 * bilinear, pixel centres at +0.5, edges clamped.
 */
export function sampleChip(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, m: Affine): Float32Array {
  const out = new Float32Array(CHIP * CHIP * 3);
  const px = (x: number, y: number, ch: number) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return rgba[(cy * width + cx) * 4 + ch];
  };
  let o = 0;
  for (let v = 0; v < CHIP; v++) {
    for (let u = 0; u < CHIP; u++) {
      const sx = m.a * (u + 0.5) + m.b * (v + 0.5) + m.c - 0.5;
      const sy = m.d * (u + 0.5) + m.e * (v + 0.5) + m.f - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let ch = 0; ch < 3; ch++) {
        const top = px(x0, y0, ch) * (1 - fx) + px(x0 + 1, y0, ch) * fx;
        const bottom = px(x0, y0 + 1, ch) * (1 - fx) + px(x0 + 1, y0 + 1, ch) * fx;
        out[o++] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return out;
}

/** Euclidean distance between two face descriptors. Same person: usually below 0.6. */
export function descriptorDistance(p: ArrayLike<number>, q: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += (p[i] - q[i]) ** 2;
  return Math.sqrt(s);
}
