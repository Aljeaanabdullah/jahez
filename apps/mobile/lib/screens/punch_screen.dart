import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';

import '../face/face_capture.dart';
import '../l10n.dart';
import '../punch/liveness.dart';
import '../punch/phone_checks.dart';
import '../punch/punch_service.dart';

enum _Stage { checking, camera, sending, result }

/// Punch flow: phone checks → live face challenge → photo → server decision.
class PunchScreen extends StatefulWidget {
  const PunchScreen({
    super.key,
    required this.strings,
    required this.isArabic,
    required this.checks,
    required this.service,
    required this.analyserFactory,
  });

  final Strings strings;
  final bool isArabic;
  final PhoneChecks checks;
  final PunchService service;
  final Future<FaceAnalyser> Function() analyserFactory;

  @override
  State<PunchScreen> createState() => _PunchScreenState();
}

class _PunchScreenState extends State<PunchScreen> {
  static const _timeLimit = Duration(seconds: 15);

  _Stage _stage = _Stage.checking;
  PhoneReport? _report;
  CameraController? _camera;
  FaceDetector? _detector;
  FaceAnalyser? _analyser;
  LivenessJudge? _judge;
  Timer? _timer;
  bool _processingFrame = false;
  bool _finishing = false;
  PunchResult? _result;
  String? _localProblem;

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _stopCamera();
    _detector?.close();
    _analyser?.close();
    super.dispose();
  }

  Future<void> _stopCamera() async {
    final c = _camera;
    _camera = null;
    if (c == null) return;
    try {
      if (c.value.isStreamingImages) await c.stopImageStream();
    } catch (_) {}
    await c.dispose();
  }

  void _fail(String code) {
    _timer?.cancel();
    _stopCamera();
    if (mounted) {
      setState(() {
        _localProblem = code;
        _stage = _Stage.result;
      });
    }
  }

  Future<void> _run() async {
    setState(() {
      _stage = _Stage.checking;
      _result = null;
      _localProblem = null;
      _finishing = false;
    });
    final report = await widget.checks.run();
    _report = report;
    if (report.problem != null) return _fail(report.problem!);

    try {
      _analyser ??= await widget.analyserFactory();
      _detector ??= FaceDetector(
        options: FaceDetectorOptions(
          enableClassification: true,
          enableTracking: true,
          performanceMode: FaceDetectorMode.fast,
        ),
      );
      final cams = await availableCameras();
      final front = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.front, orElse: () => cams.first);
      final camera = CameraController(front, ResolutionPreset.high,
          enableAudio: false, imageFormatGroup: ImageFormatGroup.nv21);
      await camera.initialize();
      if (!mounted) return;
      _judge = LivenessJudge();
      setState(() {
        _camera = camera;
        _stage = _Stage.camera;
      });
      _timer = Timer(_timeLimit, () => _fail('timeout'));
      await camera.startImageStream((image) => _onFrame(image, front));
    } catch (_) {
      _fail('liveness_failed');
    }
  }

  Future<void> _onFrame(CameraImage image, CameraDescription cam) async {
    if (_processingFrame || _finishing || _judge == null || _detector == null) return;
    _processingFrame = true;
    try {
      final input = _toInputImage(image, cam);
      if (input == null) return;
      final faces = await _detector!.processImage(input);
      final f = faces.isEmpty ? null : faces.first;
      final state = _judge!.onFrame(FaceSignals(
        trackingId: f?.trackingId,
        faces: faces.length,
        leftEyeOpen: f?.leftEyeOpenProbability,
        rightEyeOpen: f?.rightEyeOpenProbability,
        smiling: f?.smilingProbability,
        yaw: f?.headEulerAngleY,
      ));
      if (!mounted) return;
      setState(() {});
      if (state == LivenessState.failed) _fail(_judge!.failure ?? 'liveness_failed');
      if (state == LivenessState.passed) await _finish();
    } finally {
      _processingFrame = false;
    }
  }

  InputImage? _toInputImage(CameraImage image, CameraDescription cam) {
    final rotation = InputImageRotationValue.fromRawValue(cam.sensorOrientation);
    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (rotation == null || format == null || image.planes.length != 1) return null;
    final plane = image.planes.first;
    return InputImage.fromBytes(
      bytes: plane.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: plane.bytesPerRow,
      ),
    );
  }

  /// Liveness passed: take the still photo, compute the descriptor, ask the server.
  Future<void> _finish() async {
    if (_finishing) return;
    _finishing = true;
    _timer?.cancel();
    final camera = _camera;
    if (camera == null) return;
    try {
      await camera.stopImageStream();
      final file = await camera.takePicture();
      await _stopCamera();
      if (!mounted) return;
      setState(() => _stage = _Stage.sending);

      final analysis = await _analyser!.analyse(file.path);
      if (analysis.problem != null) return _fail(analysis.problem!);

      final p = _report!.position!;
      final result = await widget.service.punch(
        lat: p.latitude,
        lng: p.longitude,
        accuracy: p.accuracy,
        report: {
          'vpn': _report!.vpn,
          'mock_location': _report!.mockLocation,
          'rooted': _report!.rooted,
          'liveness': {'challenge': _judge!.challenge.name, 'passed': true},
        },
        descriptor: analysis.descriptor!,
        photoBase64: analysis.photoBase64!,
      );
      if (!mounted) return;
      setState(() {
        _result = result;
        _stage = _Stage.result;
      });
    } catch (_) {
      _fail('generic');
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(s.appName)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: switch (_stage) {
            _Stage.checking => _Waiting(text: s.punchChecking),
            _Stage.sending => _Waiting(text: s.punchSending),
            _Stage.camera => _cameraView(s, colors),
            _Stage.result => _resultView(s, colors),
          },
        ),
      ),
    );
  }

  Widget _cameraView(Strings s, ColorScheme colors) {
    final camera = _camera;
    final judge = _judge;
    final instruction = switch (judge?.state) {
      LivenessState.doChallenge => s.challenge(judge!.challenge.name),
      LivenessState.faceCamera || LivenessState.passed => s.punchFaceCamera,
      _ => s.punchLookAtCamera,
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(instruction,
            key: const Key('instruction'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(color: colors.primary)),
        const SizedBox(height: 16),
        if (camera != null)
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Center(child: AspectRatio(aspectRatio: 1 / camera.value.aspectRatio, child: CameraPreview(camera))),
            ),
          ),
      ],
    );
  }

  Widget _resultView(Strings s, ColorScheme colors) {
    final r = _result;
    final ok = r?.accepted == true;
    final code = r?.reason ?? _localProblem ?? 'generic';
    final time = r == null ? '' : TimeOfDay.fromDateTime(r.punchedAt.toLocal()).format(context);
    final site = r == null ? null : (widget.isArabic ? r.siteAr : r.siteEn);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(ok ? Icons.check_circle : Icons.cancel, size: 96, color: ok ? Colors.green : colors.error),
        const SizedBox(height: 16),
        Text(ok ? s.punchAccepted : s.punchRejected,
            key: const Key('punchResult'), textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        if (ok) ...[
          Text('${r!.punchType == 'check_in' ? s.punchIn : s.punchOut} · $time',
              textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
          if (site != null) Text(site, textAlign: TextAlign.center),
        ] else ...[
          Text(s.punchReason(code), key: const Key('punchReason'), textAlign: TextAlign.center),
          if (code == 'outside_site' && r?.distanceM != null)
            Text('${r!.distanceM} m', textAlign: TextAlign.center, textDirection: TextDirection.ltr),
        ],
        const SizedBox(height: 32),
        if (!ok && code != 'locked')
          OutlinedButton(onPressed: _run, child: Text(s.punchTryAgain)),
        const SizedBox(height: 12),
        FilledButton(onPressed: () => Navigator.of(context).pop(ok), child: Text(s.punchDone)),
      ],
    );
  }
}

class _Waiting extends StatelessWidget {
  const _Waiting({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 16),
          Text(text, textAlign: TextAlign.center),
        ]),
      );
}
