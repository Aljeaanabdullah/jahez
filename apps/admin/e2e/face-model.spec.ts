import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// The web model (face-api in the browser) must give the same 128 numbers as the mobile
// TFLite model on identical inputs. parity.json is written by tools/face-model/build_tflite.py.
const parityFile = path.resolve(__dirname, "../../../tools/face-model/out/parity.json");

test("web face model matches the mobile TFLite model", async ({ page }) => {
  test.skip(!existsSync(parityFile), "run tools/face-model/build_tflite.py first");
  test.setTimeout(120_000);
  const parity = JSON.parse(readFileSync(parityFile, "utf8")) as { inputs: number[][]; descriptors: number[][] };

  await page.goto("/dev/face-check");
  await expect(page.getByTestId("face-check")).toHaveText("ready", { timeout: 60_000 });
  const web = await page.evaluate((chips) => window.jahezFaceCheck!(chips), parity.inputs);

  expect(web).toHaveLength(parity.descriptors.length);
  let maxDiff = 0;
  web.forEach((d, i) => d.forEach((v, j) => (maxDiff = Math.max(maxDiff, Math.abs(v - parity.descriptors[i][j])))));
  console.log(`web vs mobile model: max difference ${maxDiff.toExponential(2)}`);
  // Same person is decided at distance ~0.4-0.6; differences here must be far below that.
  expect(maxDiff).toBeLessThan(1e-3);
});
