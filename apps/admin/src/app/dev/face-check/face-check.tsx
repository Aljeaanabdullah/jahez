"use client";

import { useEffect, useState } from "react";
import { FaceEngine } from "@/lib/face/engine";

declare global {
  interface Window {
    jahezFaceCheck?: (chips: number[][]) => Promise<number[][]>;
  }
}

export function FaceCheck() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    FaceEngine.load().then((engine) => {
      window.jahezFaceCheck = async (chips) => {
        const out: number[][] = [];
        for (const chip of chips) out.push(Array.from(await engine.descriptorFromChip(Float32Array.from(chip))));
        return out;
      };
      setReady(true);
    });
  }, []);
  return <p data-testid="face-check">{ready ? "ready" : "loading"}</p>;
}
