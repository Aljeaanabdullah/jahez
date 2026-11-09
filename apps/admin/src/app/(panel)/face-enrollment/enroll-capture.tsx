"use client";

import { useEffect, useRef, useState } from "react";
import { FaceEngine, facePhoto, frameOf, qualityProblem, type Detection } from "@/lib/face/engine";
import { faceT } from "@/lib/i18n-face";
import type { Lang } from "@/lib/i18n";
import { Alert, buttonClass } from "@/components/ui";
import { enrollFace } from "./actions";

type Shot = { photo: string; descriptor: number[] };

/** Camera + live quality check; 3 good photos are sent to the server. */
export function EnrollCapture({ employeeId, lang }: { employeeId: string; lang: Lang }) {
  const t = faceT(lang);
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<FaceEngine | null>(null);
  const [stage, setStage] = useState<"idle" | "loading" | "live" | "error">("idle");
  const [quality, setQuality] = useState<string>("no_face");
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; fileNumber?: number } | null>(null);
  const last = useRef<Detection[]>([]);

  // Stop the camera when leaving the page.
  useEffect(() => {
    const v = video.current;
    return () => {
      (v?.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Live check a few times per second while the camera is on.
  useEffect(() => {
    if (stage !== "live") return;
    let stop = false;
    const tick = async () => {
      if (stop || !engine.current || !video.current || !canvas.current) return;
      const v = video.current;
      if (v.videoWidth) {
        canvas.current.width = v.videoWidth;
        canvas.current.height = v.videoHeight;
        canvas.current.getContext("2d")!.drawImage(v, 0, 0);
        const faces = await engine.current.detect(canvas.current);
        last.current = faces;
        setQuality(qualityProblem(faces, frameOf(canvas.current)) ?? "ok");
      }
      if (!stop) setTimeout(tick, 300);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [stage]);

  async function start() {
    setStage("loading");
    setResult(null);
    try {
      engine.current ??= await FaceEngine.load();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
      video.current!.srcObject = stream;
      await video.current!.play();
      setStage("live");
    } catch {
      setStage("error");
    }
  }

  async function capture() {
    if (!engine.current || !canvas.current || quality !== "ok") return;
    const det = last.current[0];
    const descriptor = await engine.current.descriptor(frameOf(canvas.current), det);
    setShots((s) => [...s, { photo: facePhoto(canvas.current!, det), descriptor: Array.from(descriptor) }].slice(0, 3));
  }

  async function save() {
    setBusy(true);
    const res = await enrollFace(employeeId, shots.map((s) => s.photo), shots.map((s) => s.descriptor));
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setShots([]);
      (video.current?.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
      setStage("idle");
    }
  }

  const errorText = (r: { error?: string; fileNumber?: number }) => {
    if (r.error === "face_already_enrolled") return t.errors.face_already_enrolled(r.fileNumber ?? "?");
    const e = t.errors[r.error as keyof typeof t.errors];
    return typeof e === "string" ? e : t.errors.generic;
  };

  return (
    <div className="flex flex-col gap-4">
      {result?.ok && <Alert kind="success">{t.saved}</Alert>}
      {result?.error && <Alert kind="error">{errorText(result)}</Alert>}

      {stage === "idle" && (
        <button type="button" onClick={start} className={`${buttonClass.primary} self-start`}>
          {t.startCamera}
        </button>
      )}
      {stage === "loading" && <p className="text-muted">{t.loading}</p>}
      {stage === "error" && <Alert kind="error">{t.cameraError}</Alert>}

      <div className={stage === "live" ? "flex flex-col gap-3" : "hidden"}>
        <p className="text-sm text-muted">{t.hint}</p>
        <div className="relative overflow-hidden rounded-xl border border-line bg-black">
          <video ref={video} muted playsInline className="block w-full -scale-x-100" aria-label={t.title} />
        </div>
        <canvas ref={canvas} className="hidden" />
        <p
          role="status"
          data-testid="quality"
          className={`rounded-lg px-3 py-2 text-sm ${quality === "ok" ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger"}`}
        >
          {t.quality[quality as keyof typeof t.quality] ?? t.quality.no_face}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={capture}
            disabled={quality !== "ok" || shots.length >= 3}
            className={buttonClass.primary}
          >
            {t.capture} ({shots.length}/3)
          </button>
          {shots.length > 0 && (
            <button type="button" onClick={() => setShots([])} className={buttonClass.secondary}>
              {t.retake}
            </button>
          )}
          <button type="button" onClick={save} disabled={shots.length < 3 || busy} className={buttonClass.primary}>
            {busy ? t.saving : t.save}
          </button>
        </div>
        {shots.length > 0 && (
          <div className="flex gap-3">
            {shots.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:image/jpeg;base64,${s.photo}`}
                alt={t.photo(i + 1)}
                className="size-24 rounded-lg border border-line object-cover"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
