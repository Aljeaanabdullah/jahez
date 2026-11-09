import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../enroll/enroll_service.dart';
import '../face/face_capture.dart';
import '../l10n.dart';
import 'enroll_capture_screen.dart';

/// HR: find an employee by file number, check log-in and consent, then take the photos.
class EnrollSearchScreen extends StatefulWidget {
  const EnrollSearchScreen({
    super.key,
    required this.strings,
    required this.isArabic,
    required this.service,
    required this.analyserFactory,
  });

  final Strings strings;
  final bool isArabic;
  final EnrollService service;
  final Future<FaceAnalyser> Function() analyserFactory;

  @override
  State<EnrollSearchScreen> createState() => _EnrollSearchScreenState();
}

class _EnrollSearchScreenState extends State<EnrollSearchScreen> {
  final _file = TextEditingController();
  EnrollTarget? _target;
  bool _searched = false;
  bool _busy = false;

  @override
  void dispose() {
    _file.dispose();
    super.dispose();
  }

  Future<void> _find() async {
    final n = int.tryParse(_file.text.trim());
    if (n == null) return;
    setState(() => _busy = true);
    final t = await widget.service.find(n);
    if (mounted) {
      setState(() {
        _target = t;
        _searched = true;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final t = _target;
    final colors = Theme.of(context).colorScheme;
    String? blocker;
    if (t != null) {
      if (!t.isActive) {
        blocker = s.enrollSuspended;
      } else if (!t.hasLogin) {
        blocker = s.enrollNoLogin;
      } else if (!t.hasConsent) {
        blocker = s.enrollNoConsent;
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(s.enrollTitle)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  key: const Key('enrollFile'),
                  controller: _file,
                  keyboardType: TextInputType.number,
                  textDirection: TextDirection.ltr,
                  maxLength: 6,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(labelText: s.fileNumber, border: const OutlineInputBorder()),
                  onSubmitted: (_) => _find(),
                ),
              ),
              const SizedBox(width: 12),
              FilledButton(key: const Key('enrollFind'), onPressed: _busy ? null : _find, child: Text(s.enrollFind)),
            ],
          ),
          if (_searched && t == null) Text(s.enrollNotFound, style: TextStyle(color: colors.error)),
          if (t != null) ...[
            const SizedBox(height: 16),
            Text(widget.isArabic ? t.nameAr : t.nameEn, style: Theme.of(context).textTheme.titleLarge),
            Text('${t.fileNumber}', textDirection: TextDirection.ltr, textAlign: TextAlign.start),
            const SizedBox(height: 8),
            Chip(label: Text(t.enrolled ? s.enrollEnrolled : s.enrollNotEnrolled)),
            const SizedBox(height: 16),
            if (blocker != null)
              Text(blocker, key: const Key('enrollBlocker'), style: TextStyle(color: colors.error))
            else ...[
              if (t.enrolled) Text(s.enrollReplaces),
              const SizedBox(height: 12),
              FilledButton.icon(
                key: const Key('enrollStart'),
                icon: const Icon(Icons.photo_camera),
                label: Text(s.enrollStart),
                onPressed: () async {
                  final done = await Navigator.of(context).push<bool>(MaterialPageRoute(
                    builder: (_) => EnrollCaptureScreen(
                      strings: s,
                      target: t,
                      service: widget.service,
                      analyserFactory: widget.analyserFactory,
                    ),
                  ));
                  if (done == true) await _find();
                },
              ),
            ],
          ],
        ],
      ),
    );
  }
}
