import 'dart:math';

/// Random action the employee must do in front of the camera, so a photo or a
/// replayed video cannot punch (PRD 4.2).
enum Challenge { blink, turnHead, smile }

/// One camera frame as seen by ML Kit.
class FaceSignals {
  const FaceSignals({
    required this.trackingId,
    required this.faces,
    this.leftEyeOpen,
    this.rightEyeOpen,
    this.smiling,
    this.yaw,
  });

  final int? trackingId;
  final int faces;
  final double? leftEyeOpen;
  final double? rightEyeOpen;
  final double? smiling;
  final double? yaw; // degrees, head turned left/right
}

enum LivenessState { waitingForFace, doChallenge, faceCamera, passed, failed }

/// Decides liveness from a stream of frames:
/// 1. one face appears and is tracked;
/// 2. it performs the random challenge;
/// 3. it looks straight at the camera again.
/// The same tracked face must stay in view the whole time.
class LivenessJudge {
  LivenessJudge({Challenge? challenge, Random? random})
      : challenge = challenge ?? Challenge.values[(random ?? Random.secure()).nextInt(Challenge.values.length)];

  final Challenge challenge;
  LivenessState state = LivenessState.waitingForFace;

  /// Why it failed (`many_faces`, `face_changed`), when [state] is failed.
  String? failure;

  int? _trackingId;
  bool _sawOpenEyes = false;
  bool _sawClosedEyes = false;

  static const _open = 0.7, _closed = 0.3, _turned = 20.0, _straight = 10.0, _smile = 0.8;

  LivenessState onFrame(FaceSignals f) {
    if (state == LivenessState.passed || state == LivenessState.failed) return state;
    if (f.faces > 1) return _fail('many_faces');
    if (f.faces == 0) {
      // Losing the face after it was tracked could be a swap: start over is not allowed.
      return _trackingId == null ? state : _fail('face_changed');
    }
    if (_trackingId == null) {
      _trackingId = f.trackingId;
      state = LivenessState.doChallenge;
    } else if (f.trackingId != _trackingId) {
      return _fail('face_changed');
    }

    final yaw = f.yaw ?? 0;
    if (state == LivenessState.doChallenge && _challengeDone(f, yaw)) {
      state = LivenessState.faceCamera;
    } else if (state == LivenessState.faceCamera && yaw.abs() < _straight && _eyesOpen(f)) {
      state = LivenessState.passed;
    }
    return state;
  }

  bool _eyesOpen(FaceSignals f) => (f.leftEyeOpen ?? 1) > _open && (f.rightEyeOpen ?? 1) > _open;

  bool _challengeDone(FaceSignals f, double yaw) {
    switch (challenge) {
      case Challenge.blink:
        final l = f.leftEyeOpen, r = f.rightEyeOpen;
        if (l == null || r == null) return false;
        if (l > _open && r > _open) {
          if (_sawClosedEyes) return true; // open → closed → open
          _sawOpenEyes = true;
        } else if (_sawOpenEyes && l < _closed && r < _closed) {
          _sawClosedEyes = true;
        }
        return false;
      case Challenge.turnHead:
        return yaw.abs() > _turned;
      case Challenge.smile:
        return (f.smiling ?? 0) > _smile;
    }
  }

  LivenessState _fail(String why) {
    failure = why;
    return state = LivenessState.failed;
  }
}
