import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../enroll/enroll_service.dart';
import '../face/face_capture.dart';
import '../l10n.dart';
import '../punch/phone_checks.dart';
import '../punch/punch_service.dart';
import '../settings.dart';
import 'enroll_search_screen.dart';
import 'punch_screen.dart';

/// Home: punch button, today's punches, HR tools, settings.
class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.strings,
    required this.settings,
    required this.profile,
    required this.onSignOut,
    required this.enroll,
    required this.analyserFactory,
    required this.punch,
    required this.checks,
  });

  final Strings strings;
  final AppSettings settings;
  final Profile profile;
  final VoidCallback onSignOut;
  final EnrollService enroll;
  final Future<FaceAnalyser> Function() analyserFactory;
  final PunchService punch;
  final PhoneChecks checks;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<PunchEntry>? _today;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await widget.punch.today();
      if (mounted) setState(() => _today = list);
    } catch (_) {
      if (mounted) setState(() => _today = const []);
    }
  }

  /// The server decides in/out; the button shows its best guess from today's accepted punches.
  bool get _nextIsOut {
    final accepted = (_today ?? const <PunchEntry>[]).where((p) => p.accepted);
    return accepted.isNotEmpty && accepted.first.type == 'check_in';
  }

  Future<void> _punch() async {
    final isEnglish = widget.settings.locale.languageCode == 'en';
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => PunchScreen(
        strings: widget.strings,
        isArabic: !isEnglish,
        checks: widget.checks,
        service: widget.punch,
        analyserFactory: widget.analyserFactory,
      ),
    ));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final isEnglish = widget.settings.locale.languageCode == 'en';
    final name = isEnglish ? widget.profile.nameEn : widget.profile.nameAr;
    final comma = isEnglish ? ',' : '،';
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: Text(s.appName)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text('${s.welcome}$comma $name', key: const Key('welcome'), style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 4),
            Text('${widget.profile.fileNumber}', textDirection: TextDirection.ltr, textAlign: TextAlign.start),
            const SizedBox(height: 24),
            SizedBox(
              height: 72,
              child: FilledButton.icon(
                key: const Key('punchButton'),
                icon: Icon(_nextIsOut ? Icons.logout : Icons.login, size: 28),
                label: Text(_nextIsOut ? s.punchOut : s.punchIn, style: const TextStyle(fontSize: 22)),
                onPressed: _today == null ? null : _punch,
              ),
            ),
            const SizedBox(height: 24),
            Text(s.punchToday, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            if (_today == null)
              const Center(child: CircularProgressIndicator())
            else if (_today!.isEmpty)
              Text(s.punchNone, style: TextStyle(color: colors.outline))
            else
              for (final p in _today!)
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(p.accepted ? Icons.check_circle : Icons.cancel, color: p.accepted ? Colors.green : colors.error),
                  title: Text(p.type == 'check_in' ? s.punchIn : s.punchOut),
                  subtitle: p.accepted ? null : Text(s.punchReason(p.reason ?? 'generic')),
                  trailing: Text(TimeOfDay.fromDateTime(p.at).format(context)),
                ),
            if (widget.profile.role == 'hr') ...[
              const SizedBox(height: 24),
              OutlinedButton.icon(
                key: const Key('openEnroll'),
                icon: const Icon(Icons.face_retouching_natural),
                label: Text(s.enrollTitle),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => EnrollSearchScreen(
                    strings: s,
                    isArabic: !isEnglish,
                    service: widget.enroll,
                    analyserFactory: widget.analyserFactory,
                  ),
                )),
              ),
            ],
            const Divider(height: 48),
            Text(s.settings, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'ar', label: Text('العربية')),
                ButtonSegment(value: 'en', label: Text('English')),
              ],
              selected: {widget.settings.locale.languageCode},
              onSelectionChanged: (v) => widget.settings.update(locale: Locale(v.first)),
            ),
            const SizedBox(height: 12),
            SegmentedButton<ThemeMode>(
              segments: [
                ButtonSegment(value: ThemeMode.light, label: Text(s.light), icon: const Icon(Icons.light_mode)),
                ButtonSegment(value: ThemeMode.dark, label: Text(s.dark), icon: const Icon(Icons.dark_mode)),
              ],
              selected: {widget.settings.themeMode},
              onSelectionChanged: (v) => widget.settings.update(themeMode: v.first),
            ),
            const SizedBox(height: 32),
            OutlinedButton.icon(
              onPressed: widget.onSignOut,
              icon: const Icon(Icons.logout),
              label: Text(s.signOut),
            ),
          ],
        ),
      ),
    );
  }
}
