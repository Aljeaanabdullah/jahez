// Runs ON THE PHONE / EMULATOR: the TFLite face model, through the real Android runtime,
// must give the same 128 numbers as the reference (which the browser test also matches).
//   node tools/face-model/make_mobile_parity.mjs
//   flutter test integration_test/face_model_test.dart -d <device>
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:jahez/face/face_model.dart';

import 'parity_data.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('phone face model matches the web model', (tester) async {
    final model = await FaceModel.load();
    var maxDiff = 0.0;
    for (var i = 0; i < parityInputs.length; i++) {
      final chip = Float32List.fromList(parityInputs[i].map((v) => v.toDouble()).toList());
      final d = model.descriptor(chip);
      expect(d.length, 128);
      for (var j = 0; j < 128; j++) {
        final diff = (d[j] - parityDescriptors[i][j]).abs();
        if (diff > maxDiff) maxDiff = diff;
      }
    }
    model.close();
    // ignore: avoid_print
    print('phone vs reference: max difference $maxDiff');
    expect(maxDiff, lessThan(1e-3));
  });
}
