import 'dart:typed_data';

import 'package:tflite_flutter/tflite_flutter.dart';

import 'align.dart';

/// Same version string as the web panel; the server refuses descriptors from other models.
const String faceModelVersion = 'dlib-resnet-v1/$alignVersion';

/// The dlib ResNet face model (TFLite, built from the web panel's weights by
/// tools/face-model/build_tflite.py). Input: aligned 150x150 RGB chip, values 0..255.
class FaceModel {
  FaceModel._(this._interpreter);

  final Interpreter _interpreter;

  static Future<FaceModel> load() async =>
      FaceModel._(await Interpreter.fromAsset('assets/models/face_recognition.tflite'));

  /// 128-number face descriptor.
  List<double> descriptor(Float32List chip) {
    final input = chip.reshape([1, chipSize, chipSize, 3]);
    final output = List.filled(128, 0.0).reshape([1, 128]);
    _interpreter.run(input, output);
    return (output[0] as List).cast<double>();
  }

  void close() => _interpreter.close();
}
