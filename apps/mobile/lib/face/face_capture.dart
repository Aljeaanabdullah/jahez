import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:image/image.dart' as img;

import 'align.dart';
import 'face_model.dart';

/// Result of analysing one photo: either a quality problem, or a descriptor + review photo.
class CaptureResult {
  const CaptureResult.problem(this.problem)
      : descriptor = null,
        photoBase64 = null;
  const CaptureResult.ok(this.descriptor, this.photoBase64) : problem = null;

  /// Matches a `quality_<code>` text in l10n.dart.
  final String? problem;
  final List<double>? descriptor;
  final String? photoBase64;
}

/// Turns a captured photo into a descriptor, or a quality problem.
abstract class FaceAnalyser {
  Future<CaptureResult> analyse(String jpegPath);
  Future<void> close();
}

/// Detects the face with ML Kit, checks quality, aligns it (align-v1) and runs the model.
/// Same quality rules as the web panel (apps/admin/src/lib/face/engine.ts).
class FaceCapture implements FaceAnalyser {
  FaceCapture(this._model)
      : _detector = FaceDetector(
          options: FaceDetectorOptions(enableLandmarks: true, performanceMode: FaceDetectorMode.accurate),
        );

  final FaceModel _model;
  final FaceDetector _detector;

  @override
  Future<CaptureResult> analyse(String jpegPath) async {
    final faces = await _detector.processImage(InputImage.fromFilePath(jpegPath));
    if (faces.isEmpty) return const CaptureResult.problem('no_face');
    if (faces.length > 1) return const CaptureResult.problem('many_faces');
    final face = faces.first;

    final decoded = img.decodeImage(await File(jpegPath).readAsBytes());
    if (decoded == null) return const CaptureResult.problem('no_face');
    final image = img.bakeOrientation(decoded);

    Pt? at(FaceLandmarkType t) {
      final p = face.landmarks[t]?.position;
      return p == null ? null : Pt(p.x.toDouble(), p.y.toDouble());
    }

    final leftEye = at(FaceLandmarkType.leftEye), rightEye = at(FaceLandmarkType.rightEye);
    final leftMouth = at(FaceLandmarkType.leftMouth), rightMouth = at(FaceLandmarkType.rightMouth);
    if (leftEye == null || rightEye == null || leftMouth == null || rightMouth == null) {
      return const CaptureResult.problem('no_face');
    }

    final box = face.boundingBox;
    if (box.width < math.max(100, image.width * 0.18)) return const CaptureResult.problem('too_far');
    // Same as the web: eyes ordered left-to-right in the image, then the angle of the eye line.
    final e1 = leftEye.x <= rightEye.x ? leftEye : rightEye;
    final e2 = leftEye.x <= rightEye.x ? rightEye : leftEye;
    final roll = math.atan2(e2.y - e1.y, e2.x - e1.x) * 180 / math.pi;
    if (roll.abs() > 15) return const CaptureResult.problem('tilted');
    if ((face.headEulerAngleY ?? 0).abs() > 15) return const CaptureResult.problem('not_frontal');

    final rgba = image.getBytes(order: img.ChannelOrder.rgba);
    final chip = sampleChip(
      rgba,
      image.width,
      image.height,
      alignment(FaceKeyPoints(eyes: [leftEye, rightEye], mouth: [leftMouth, rightMouth])),
    );
    var light = 0.0;
    for (var i = 0; i < chip.length; i += 3) {
      light += 0.299 * chip[i] + 0.587 * chip[i + 1] + 0.114 * chip[i + 2];
    }
    light /= chip.length / 3;
    if (light < 55) return const CaptureResult.problem('too_dark');
    if (light > 215) return const CaptureResult.problem('too_bright');

    // A square photo around the face for the admin's review (not used for matching).
    final side = (box.width * 1.8).round();
    final crop = img.copyCrop(
      image,
      x: (box.center.dx - side / 2).round().clamp(0, image.width - 1),
      y: (box.center.dy - side / 2).round().clamp(0, image.height - 1),
      width: side,
      height: side,
    );
    final photo = img.encodeJpg(img.copyResize(crop, width: 320, height: 320), quality: 85);

    return CaptureResult.ok(_model.descriptor(chip), base64Encode(photo));
  }

  @override
  Future<void> close() async {
    await _detector.close();
    _model.close();
  }

  static Future<FaceCapture> create() async => FaceCapture(await FaceModel.load());
}
