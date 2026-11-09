// Face alignment shared by web and mobile ("align-v1").
// Same rule as apps/admin/src/lib/face/align.ts; both are checked against
// tools/face-model/align-fixtures.json (computed independently in Python).
//
// Only eye centres and mouth corners are used, because both face detectors provide them.
// The face is rotated so the eyes are level and scaled so that the eye-to-mouth distance is
// 55 px, with the point between the eyes at (75, 45).
import 'dart:math' as math;
import 'dart:typed_data';

const int chipSize = 150;
const double eyesTargetX = 75;
const double eyesTargetY = 45;
const double eyeMouthTarget = 55;
const String alignVersion = 'align-v1';

class Pt {
  const Pt(this.x, this.y);
  final double x;
  final double y;
}

class FaceKeyPoints {
  const FaceKeyPoints({required this.eyes, required this.mouth});
  final List<Pt> eyes; // two points, any order
  final List<Pt> mouth; // two mouth corners, any order
}

/// Affine map from chip pixel (u, v) to source pixel (x, y): x = a·u + b·v + c, y = d·u + e·v + f.
class Affine {
  const Affine(this.a, this.b, this.c, this.d, this.e, this.f);
  final double a, b, c, d, e, f;
}

List<Pt> _byX(List<Pt> p) => p[0].x <= p[1].x ? [p[0], p[1]] : [p[1], p[0]];

Affine alignment(FaceKeyPoints points) {
  final eyes = _byX(points.eyes);
  final mouth = _byX(points.mouth);
  final ex = (eyes[0].x + eyes[1].x) / 2, ey = (eyes[0].y + eyes[1].y) / 2;
  final mx = (mouth[0].x + mouth[1].x) / 2, my = (mouth[0].y + mouth[1].y) / 2;
  final theta = math.atan2(eyes[1].y - eyes[0].y, eyes[1].x - eyes[0].x);
  final dist = math.sqrt((mx - ex) * (mx - ex) + (my - ey) * (my - ey));
  if (!(dist > 0)) throw ArgumentError('degenerate face points');
  final k = dist / eyeMouthTarget;
  final a = k * math.cos(theta), b = -k * math.sin(theta);
  final d = k * math.sin(theta), e = k * math.cos(theta);
  return Affine(a, b, ex - a * eyesTargetX - b * eyesTargetY, d, e, ey - d * eyesTargetX - e * eyesTargetY);
}

/// Samples a 150x150 RGB chip (values 0..255, row-major, 3 per pixel) from an RGBA image,
/// bilinear, pixel centres at +0.5, edges clamped.
Float32List sampleChip(Uint8List rgba, int width, int height, Affine m) {
  final out = Float32List(chipSize * chipSize * 3);
  int px(int x, int y, int ch) {
    final cx = x < 0 ? 0 : (x >= width ? width - 1 : x);
    final cy = y < 0 ? 0 : (y >= height ? height - 1 : y);
    return rgba[(cy * width + cx) * 4 + ch];
  }

  var o = 0;
  for (var v = 0; v < chipSize; v++) {
    for (var u = 0; u < chipSize; u++) {
      final sx = m.a * (u + 0.5) + m.b * (v + 0.5) + m.c - 0.5;
      final sy = m.d * (u + 0.5) + m.e * (v + 0.5) + m.f - 0.5;
      final x0 = sx.floor(), y0 = sy.floor();
      final fx = sx - x0, fy = sy - y0;
      for (var ch = 0; ch < 3; ch++) {
        final top = px(x0, y0, ch) * (1 - fx) + px(x0 + 1, y0, ch) * fx;
        final bottom = px(x0, y0 + 1, ch) * (1 - fx) + px(x0 + 1, y0 + 1, ch) * fx;
        out[o++] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return out;
}

double descriptorDistance(List<double> p, List<double> q) {
  var s = 0.0;
  for (var i = 0; i < p.length; i++) {
    s += (p[i] - q[i]) * (p[i] - q[i]);
  }
  return math.sqrt(s);
}
