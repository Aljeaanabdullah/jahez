import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/face/align.dart';

// Fixtures computed independently in Python (tools/face-model/make_align_fixtures.py);
// the web version is checked against the same file.
void main() {
  final fixtures = jsonDecode(File('../../tools/face-model/align-fixtures.json').readAsStringSync())
      as Map<String, dynamic>;
  Pt pt(List<dynamic> p) => Pt((p[0] as num).toDouble(), (p[1] as num).toDouble());

  for (final c in fixtures['cases'] as List<dynamic>) {
    test('alignment matches the Python reference: ${c['name']}', () {
      final m = alignment(FaceKeyPoints(
        eyes: [pt(c['eyes'][0]), pt(c['eyes'][1])],
        mouth: [pt(c['mouth'][0]), pt(c['mouth'][1])],
      ));
      final expected = c['affine'] as Map<String, dynamic>;
      expect(m.a, closeTo(expected['a'], 1e-9));
      expect(m.b, closeTo(expected['b'], 1e-9));
      expect(m.c, closeTo(expected['c'], 1e-9));
      expect(m.d, closeTo(expected['d'], 1e-9));
      expect(m.e, closeTo(expected['e'], 1e-9));
      expect(m.f, closeTo(expected['f'], 1e-9));
    });
  }

  test('chip sampling matches the Python reference', () {
    final s = fixtures['sampling'] as Map<String, dynamic>;
    final w = s['width'] as int, h = s['height'] as int;
    final rgb = (s['rgb'] as List<dynamic>).cast<int>();
    final rgba = Uint8List(w * h * 4);
    for (var i = 0; i < w * h; i++) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
    final m = alignment(FaceKeyPoints(
      eyes: [pt(s['eyes'][0]), pt(s['eyes'][1])],
      mouth: [pt(s['mouth'][0]), pt(s['mouth'][1])],
    ));
    final chip = sampleChip(rgba, w, h, m);
    expect(chip.length, chipSize * chipSize * 3);
    for (final p in s['probes'] as List<dynamic>) {
      final i = ((p['v'] as int) * chipSize + (p['u'] as int)) * 3;
      for (var ch = 0; ch < 3; ch++) {
        expect(chip[i + ch], closeTo((p['rgb'][ch] as num).toDouble(), 1e-3));
      }
    }
  });

  test('descriptor distance', () {
    expect(descriptorDistance([0, 3], [4, 0]), 5);
  });
}
