import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { alignment, sampleChip, CHIP, descriptorDistance } from "./align";

// Fixtures computed independently in Python (tools/face-model/make_align_fixtures.py);
// the Dart version in the mobile app is checked against the same file.
const fixtures = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../../../tools/face-model/align-fixtures.json"), "utf8"),
);
const pt = ([x, y]: number[]) => ({ x, y });

describe("face alignment (align-v1)", () => {
  for (const c of fixtures.cases) {
    it(`matches the Python reference: ${c.name}`, () => {
      const m = alignment({ eyes: [pt(c.eyes[0]), pt(c.eyes[1])], mouth: [pt(c.mouth[0]), pt(c.mouth[1])] });
      for (const k of ["a", "b", "c", "d", "e", "f"] as const) expect(m[k]).toBeCloseTo(c.affine[k], 9);
    });
  }

  it("samples the chip exactly like the Python reference", () => {
    const s = fixtures.sampling;
    const rgba = new Uint8ClampedArray(s.width * s.height * 4);
    for (let i = 0; i < s.width * s.height; i++) {
      rgba.set([s.rgb[i * 3], s.rgb[i * 3 + 1], s.rgb[i * 3 + 2], 255], i * 4);
    }
    const m = alignment({ eyes: [pt(s.eyes[0]), pt(s.eyes[1])], mouth: [pt(s.mouth[0]), pt(s.mouth[1])] });
    const chip = sampleChip(rgba, s.width, s.height, m);
    expect(chip.length).toBe(CHIP * CHIP * 3);
    for (const p of s.probes) {
      const i = (p.v * CHIP + p.u) * 3;
      for (let ch = 0; ch < 3; ch++) expect(chip[i + ch]).toBeCloseTo(p.rgb[ch], 3);
    }
  });

  it("measures descriptor distance", () => {
    expect(descriptorDistance([0, 3], [4, 0])).toBe(5);
  });
});
