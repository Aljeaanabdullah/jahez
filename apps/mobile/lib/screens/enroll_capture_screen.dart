import 'dart:convert';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../enroll/enroll_service.dart';
import '../face/face_capture.dart';
import '../l10n.dart';

/// HR: front camera, 3 photos checked one by one, then saved through enroll-face.
class EnrollCaptureScreen extends StatefulWidget {
  const EnrollCaptureScreen({
    super.key,
    required this.strings,
    required this.target,
    required this.service,
    required this.analyserFactory,
  });

  final Strings strings;
  final EnrollTarget target;
  final EnrollService service;
  final Future<FaceAnalyser> Function() analyserFactory;

  @override
  State<EnrollCaptureScreen> createState() => _EnrollCaptureScreenState();
}

class _EnrollCaptureScreenState extends State<EnrollCaptureScreen> {
  CameraController? _camera;
  FaceAnalyser? _analyser;
  final List<CaptureResult> _shots = [];
  String? _message;
  bool _messageIsError = true;
  bool _busy = false;
  bool _cameraFailed = false;

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    try {
      _analyser = await widget.analyserFactory();
      final cams = await availableCameras();
      final front = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.front, orElse: () => cams.first);
      final controller = CameraController(front, ResolutionPreset.high, enableAudio: false);
      await controller.initialize();
      if (!mounted) return;
      setState(() => _camera = controller);
    } catch (_) {
      if (mounted) setState(() => _cameraFailed = true);
    }
  }

  @override
  void dispose() {
    _camera?.dispose();
    _analyser?.close();
    super.dispose();
  }

  Future<void> _capture() async {
    final camera = _camera;
    final analyser = _analyser;
    if (camera == null || analyser == null || _shots.length >= 3) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final file = await camera.takePicture();
      final result = await analyser.analyse(file.path);
      if (!mounted) return;
      setState(() {
        if (result.problem != null) {
          _message = widget.strings.quality(result.problem!);
          _messageIsError = true;
        } else {
          _shots.add(result);
        }
      });
    } catch (_) {
      // Never fail silently: tell HR the photo could not be analysed.
      if (mounted) {
        setState(() {
          _message = widget.strings.error('generic');
          _messageIsError = true;
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await widget.service.enroll(
        widget.target.id,
        _shots.map((r) => r.photoBase64!).toList(),
        _shots.map((r) => r.descriptor!).toList(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(widget.strings.enrollSaved)));
      Navigator.of(context).pop(true);
    } on EnrollFailure catch (e) {
      setState(() {
        _message = widget.strings.enrollError(e.code, fileNumber: e.fileNumber);
        _messageIsError = true;
        if (e.code == 'photos_not_same_person' || e.code == 'invalid_photos') _shots.clear();
      });
    } catch (_) {
      setState(() => _message = widget.strings.error('generic'));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final colors = Theme.of(context).colorScheme;
    final camera = _camera;
    return Scaffold(
      appBar: AppBar(title: Text('${s.enrollTitle} — ${widget.target.fileNumber}')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(s.enrollHint),
            const SizedBox(height: 12),
            if (_cameraFailed)
              Text(s.cameraError, style: TextStyle(color: colors.error))
            else if (camera == null)
              const SizedBox(height: 240, child: Center(child: CircularProgressIndicator()))
            else
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(aspectRatio: 1 / camera.value.aspectRatio, child: CameraPreview(camera)),
              ),
            if (_message != null) ...[
              const SizedBox(height: 12),
              Text(_message!, key: const Key('captureMessage'), style: TextStyle(color: _messageIsError ? colors.error : colors.primary)),
            ],
            const SizedBox(height: 12),
            Row(
              children: [
                for (final shot in _shots)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(end: 8),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.memory(base64Decode(shot.photoBase64!), width: 72, height: 72, fit: BoxFit.cover),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                FilledButton.icon(
                  key: const Key('captureButton'),
                  icon: const Icon(Icons.camera),
                  label: Text('${s.enrollCapture} (${_shots.length}/3)'),
                  onPressed: camera == null || _busy || _shots.length >= 3 ? null : _capture,
                ),
                if (_shots.isNotEmpty)
                  OutlinedButton(onPressed: _busy ? null : () => setState(_shots.clear), child: Text(s.enrollRetake)),
                FilledButton(
                  key: const Key('saveEnrollment'),
                  onPressed: _shots.length == 3 && !_busy ? _save : null,
                  child: Text(s.enrollSave),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
