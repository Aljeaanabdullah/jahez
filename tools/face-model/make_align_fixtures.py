"""
Independent reference for the "align-v1" face alignment (see apps/admin/src/lib/face/align.ts).
Writes tools/face-model/align-fixtures.json, which the TypeScript and Dart tests both check.

    python tools/face-model/make_align_fixtures.py
"""
import json
import math
import pathlib

import numpy as np

CHIP, EYES, EYE_MOUTH = 150, (75.0, 45.0), 55.0
OUT = pathlib.Path(__file__).resolve().parent / "align-fixtures.json"


def alignment(eyes, mouth):
    e1, e2 = sorted(eyes, key=lambda p: p[0])
    m1, m2 = sorted(mouth, key=lambda p: p[0])
    ex, ey = (e1[0] + e2[0]) / 2, (e1[1] + e2[1]) / 2
    mx, my = (m1[0] + m2[0]) / 2, (m1[1] + m2[1]) / 2
    theta = math.atan2(e2[1] - e1[1], e2[0] - e1[0])
    k = math.hypot(mx - ex, my - ey) / EYE_MOUTH
    a, b = k * math.cos(theta), -k * math.sin(theta)
    d, e = k * math.sin(theta), k * math.cos(theta)
    return {"a": a, "b": b, "c": ex - a * EYES[0] - b * EYES[1], "d": d, "e": e, "f": ey - d * EYES[0] - e * EYES[1]}


def sample(img, m, size):
    """Bilinear, pixel centres at +0.5, clamped edges. img: H x W x 3 uint8."""
    h, w, _ = img.shape
    out = np.zeros((size, size, 3), dtype=np.float64)
    for v in range(size):
        for u in range(size):
            sx = m["a"] * (u + 0.5) + m["b"] * (v + 0.5) + m["c"] - 0.5
            sy = m["d"] * (u + 0.5) + m["e"] * (v + 0.5) + m["f"] - 0.5
            x0, y0 = math.floor(sx), math.floor(sy)
            fx, fy = sx - x0, sy - y0

            def px(x, y):
                return img[min(max(y, 0), h - 1), min(max(x, 0), w - 1)].astype(np.float64)

            top = px(x0, y0) * (1 - fx) + px(x0 + 1, y0) * fx
            bottom = px(x0, y0 + 1) * (1 - fx) + px(x0 + 1, y0 + 1) * fx
            out[v, u] = top * (1 - fy) + bottom * fy
    return out


cases = [
    {"name": "level face", "eyes": [[100, 120], [160, 120]], "mouth": [[110, 190], [150, 190]]},
    {"name": "tilted face, points given right-to-left", "eyes": [[262, 140], [200, 110]], "mouth": [[250, 215], [212, 196]]},
    {"name": "small far face", "eyes": [[31.5, 40.25], [47.75, 41.0]], "mouth": [[34.0, 58.5], [45.5, 59.0]]},
]
fixtures = []
for c in cases:
    fixtures.append({**c, "affine": alignment(c["eyes"], c["mouth"])})

# Sampling check on a small synthetic image (no faces needed): a 40x30 colour gradient,
# sampled into a full 150x150 chip; a few pixels are stored.
gy, gx = np.mgrid[0:30, 0:40]
image = np.stack([gx * 6, gy * 8, (gx + gy) * 3], axis=-1).clip(0, 255).astype(np.uint8)
m = alignment([[12, 10], [26, 12]], [[14, 22], [24, 23]])
chip = sample(image, m, CHIP)
probes = [[0, 0], [75, 45], [10, 140], [149, 149], [33, 77]]
sampling = {
    "width": 40,
    "height": 30,
    "rgb": image.reshape(-1).tolist(),
    "eyes": [[12, 10], [26, 12]],
    "mouth": [[14, 22], [24, 23]],
    "probes": [{"u": u, "v": v, "rgb": chip[v, u].round(6).tolist()} for u, v in probes],
}

OUT.write_text(json.dumps({"version": "align-v1", "cases": fixtures, "sampling": sampling}, indent=1))
print(f"wrote {OUT.name}: {len(fixtures)} alignment cases, {len(probes)} sampling probes")
