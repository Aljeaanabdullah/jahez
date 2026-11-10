import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/punch/liveness.dart';

FaceSignals frame({int id = 1, int faces = 1, double eyes = 0.9, double smile = 0.1, double yaw = 0}) =>
    FaceSignals(trackingId: id, faces: faces, leftEyeOpen: eyes, rightEyeOpen: eyes, smiling: smile, yaw: yaw);

void main() {
  test('blink: open, closed, open, then looking straight passes', () {
    final j = LivenessJudge(challenge: Challenge.blink);
    expect(j.onFrame(frame()), LivenessState.doChallenge);
    j.onFrame(frame(eyes: 0.1));
    expect(j.onFrame(frame()), LivenessState.faceCamera);
    expect(j.onFrame(frame()), LivenessState.passed);
  });

  test('a still photo (eyes never close) never passes the blink challenge', () {
    final j = LivenessJudge(challenge: Challenge.blink);
    for (var i = 0; i < 100; i++) {
      j.onFrame(frame());
    }
    expect(j.state, LivenessState.doChallenge);
  });

  test('turning the head, then facing the camera, passes', () {
    final j = LivenessJudge(challenge: Challenge.turnHead);
    j.onFrame(frame());
    expect(j.onFrame(frame(yaw: 30)), LivenessState.faceCamera);
    expect(j.onFrame(frame(yaw: 20)), LivenessState.faceCamera); // still turned
    expect(j.onFrame(frame(yaw: 3)), LivenessState.passed);
  });

  test('smiling then facing the camera passes', () {
    final j = LivenessJudge(challenge: Challenge.smile);
    j.onFrame(frame());
    expect(j.onFrame(frame(smile: 0.95)), LivenessState.faceCamera);
    expect(j.onFrame(frame()), LivenessState.passed);
  });

  test('a different face appearing mid-way fails', () {
    final j = LivenessJudge(challenge: Challenge.turnHead);
    j.onFrame(frame(id: 1));
    expect(j.onFrame(frame(id: 2, yaw: 30)), LivenessState.failed);
    expect(j.failure, 'face_changed');
  });

  test('losing the face after it was tracked fails (possible swap)', () {
    final j = LivenessJudge(challenge: Challenge.smile);
    j.onFrame(frame());
    expect(j.onFrame(frame(faces: 0)), LivenessState.failed);
    expect(j.failure, 'face_changed');
  });

  test('two faces in view fail', () {
    final j = LivenessJudge(challenge: Challenge.blink);
    expect(j.onFrame(frame(faces: 2)), LivenessState.failed);
    expect(j.failure, 'many_faces');
  });

  test('waiting with no face is not a failure', () {
    final j = LivenessJudge(challenge: Challenge.blink);
    expect(j.onFrame(frame(faces: 0)), LivenessState.waitingForFace);
  });

  test('the challenge is random', () {
    final seen = {for (var i = 0; i < 60; i++) LivenessJudge().challenge};
    expect(seen.length, Challenge.values.length);
  });
}
