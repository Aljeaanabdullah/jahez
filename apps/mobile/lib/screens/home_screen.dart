import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../enroll/enroll_service.dart';
import '../face/face_capture.dart';
import '../l10n.dart';
import '../settings.dart';
import 'enroll_search_screen.dart';

/// Temporary home: greeting + settings. The real punch screen comes in Phase 6.
class HomeScreen extends StatelessWidget {
  const HomeScreen({
    super.key,
    required this.strings,
    required this.settings,
    required this.profile,
    required this.onSignOut,
    required this.enroll,
    required this.analyserFactory,
  });

  final Strings strings;
  final AppSettings settings;
  final Profile profile;
  final VoidCallback onSignOut;
  final EnrollService enroll;
  final Future<FaceAnalyser> Function() analyserFactory;

  @override
  Widget build(BuildContext context) {
    final s = strings;
    final isEnglish = settings.locale.languageCode == 'en';
    final name = isEnglish ? profile.nameEn : profile.nameAr;
    final comma = isEnglish ? ',' : '،';
    return Scaffold(
      appBar: AppBar(title: Text(s.appName)),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text('${s.welcome}$comma $name', key: const Key('welcome'), style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text('${profile.fileNumber}', textDirection: TextDirection.ltr, textAlign: TextAlign.start),
          const SizedBox(height: 24),
          Text(s.homeComingSoon),
          if (profile.role == 'hr') ...[
            const SizedBox(height: 24),
            FilledButton.icon(
              key: const Key('openEnroll'),
              icon: const Icon(Icons.face_retouching_natural),
              label: Text(s.enrollTitle),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => EnrollSearchScreen(
                  strings: s,
                  isArabic: !isEnglish,
                  service: enroll,
                  analyserFactory: analyserFactory,
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
            selected: {settings.locale.languageCode},
            onSelectionChanged: (v) => settings.update(locale: Locale(v.first)),
          ),
          const SizedBox(height: 12),
          SegmentedButton<ThemeMode>(
            segments: [
              ButtonSegment(value: ThemeMode.light, label: Text(s.light), icon: const Icon(Icons.light_mode)),
              ButtonSegment(value: ThemeMode.dark, label: Text(s.dark), icon: const Icon(Icons.dark_mode)),
            ],
            selected: {settings.themeMode},
            onSelectionChanged: (v) => settings.update(themeMode: v.first),
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: onSignOut,
            icon: const Icon(Icons.logout),
            label: Text(s.signOut),
          ),
        ],
      ),
    );
  }
}
