"use client";

// Browser face engine: face-api.js (MIT) with the dlib ResNet weights in /public/models.
// Loaded only on the enrollment page. The mobile app runs the same weights (TFLite)
// with the same alignment (align.ts), so descriptors from web and phone are comparable.
import { alignment, sampleChip, CHIP, type FaceKeyPoints, type Point } from "./align";

type FaceApi = typeof import("@vladmandic/face-api");

export { MODEL_VERSION } from "./engine-constants";

export type Detection = {
  box: { x: number; y: number; width: number; height: number };
  score: number;
  keyPoints: FaceKeyPoints;
  nose: Point;
};

export type Frame = { rgba: Uint8ClampedArray; width: number; height: number };

const mean = (pts: Point[]): Point => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});

export class FaceEngine {
  private constructor(private api: FaceApi) {}

  static async load(modelsUrl = "/models"): Promise<FaceEngine> {
    const api = (await import("@vladmandic/face-api/dist/face-api.esm.js")) as unknown as FaceApi;
    // face-api's type file omits these two tfjs functions; they exist at runtime.
    const tf = api.tf as unknown as { setBackend(name: string): Promise<boolean>; ready(): Promise<void> };
    const webgl = await tf.setBackend("webgl").catch(() => false);
    if (!webgl) await tf.setBackend("cpu");
    await tf.ready();
    await Promise.all([
      api.nets.tinyFaceDetector.loadFromUri(modelsUrl),
      api.nets.faceLandmark68Net.loadFromUri(modelsUrl),
      api.nets.faceRecognitionNet.loadFromUri(modelsUrl),
    ]);
    return new FaceEngine(api);
  }

  /** All faces in a frame, best first. */
  async detect(input: HTMLCanvasElement | HTMLVideoElement): Promise<Detection[]> {
    const options = new this.api.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
    const results = await this.api.detectAllFaces(input, options).withFaceLandmarks();
    return results
      .map((r) => {
        const p = r.landmarks.positions.map((q) => ({ x: q.x, y: q.y }));
        return {
          box: { x: r.detection.box.x, y: r.detection.box.y, width: r.detection.box.width, height: r.detection.box.height },
          score: r.detection.score,
          keyPoints: {
            eyes: [mean(p.slice(36, 42)), mean(p.slice(42, 48))],
            mouth: [p[48], p[54]],
          },
          nose: p[30],
        } satisfies Detection;
      })
      .sort((a, b) => b.box.width - a.box.width);
  }

  /** 128-number descriptor of an aligned 150x150 RGB chip (values 0..255). */
  async descriptorFromChip(chip: Float32Array): Promise<Float32Array> {
    const t = this.api.tf.tensor4d(chip, [1, CHIP, CHIP, 3]);
    try {
      return (await this.api.nets.faceRecognitionNet.computeFaceDescriptor(t)) as Float32Array;
    } finally {
      t.dispose();
    }
  }

  async descriptor(frame: Frame, det: Detection): Promise<Float32Array> {
    return this.descriptorFromChip(sampleChip(frame.rgba, frame.width, frame.height, alignment(det.keyPoints)));
  }
}

/** Why a frame is not good enough for enrollment, or null when it is. */
export function qualityProblem(faces: Detection[], frame: Frame): string | null {
  if (faces.length === 0) return "no_face";
  if (faces.length > 1) return "many_faces";
  const f = faces[0];
  if (f.score < 0.6) return "no_face";
  if (f.box.width < Math.max(100, frame.width * 0.18)) return "too_far";

  const [e1, e2] = f.keyPoints.eyes[0].x <= f.keyPoints.eyes[1].x ? f.keyPoints.eyes : [f.keyPoints.eyes[1], f.keyPoints.eyes[0]];
  const roll = (Math.atan2(e2.y - e1.y, e2.x - e1.x) * 180) / Math.PI;
  if (Math.abs(roll) > 15) return "tilted";
  const eyeGap = Math.hypot(e2.x - e1.x, e2.y - e1.y);
  const yaw = (f.nose.x - (e1.x + e2.x) / 2) / eyeGap;
  if (Math.abs(yaw) > 0.25) return "not_frontal";

  const chip = sampleChip(frame.rgba, frame.width, frame.height, alignment(f.keyPoints));
  let light = 0;
  for (let i = 0; i < chip.length; i += 3) light += 0.299 * chip[i] + 0.587 * chip[i + 1] + 0.114 * chip[i + 2];
  light /= chip.length / 3;
  if (light < 55) return "too_dark";
  if (light > 215) return "too_bright";
  return null;
}

/** A square JPEG around the face for the admin's review (not used for matching). */
export function facePhoto(source: HTMLCanvasElement, det: Detection, size = 320): string {
  const side = det.box.width * 1.8;
  const cx = det.box.x + det.box.width / 2;
  const cy = det.box.y + det.box.height / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(source, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

export function frameOf(canvas: HTMLCanvasElement): Frame {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return { rgba: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
}
