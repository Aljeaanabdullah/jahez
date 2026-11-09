import 'package:flutter/material.dart';

import '../l10n.dart';
import '../settings.dart';

/// First launch only: pick language and light/dark.
class SetupScreen extends StatelessWidget {
  const SetupScreen({super.key, required this.settings, required this.onDone});

  final AppSettings settings;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    final s = Strings.of(settings.locale);
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 32),
            Text(
              s.appName,
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: colors.primary),
            ),
            const SizedBox(height: 40),
            Text(s.chooseLanguage, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'ar', label: Text('العربية')),
                ButtonSegment(value: 'en', label: Text('English')),
              ],
              selected: {settings.locale.languageCode},
              onSelectionChanged: (v) => settings.update(locale: Locale(v.first)),
            ),
            const SizedBox(height: 32),
            Text(s.chooseTheme, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            SegmentedButton<ThemeMode>(
              segments: [
                ButtonSegment(value: ThemeMode.light, label: Text(s.light), icon: const Icon(Icons.light_mode)),
                ButtonSegment(value: ThemeMode.dark, label: Text(s.dark), icon: const Icon(Icons.dark_mode)),
              ],
              selected: {settings.themeMode},
              onSelectionChanged: (v) => settings.update(themeMode: v.first),
            ),
            const SizedBox(height: 48),
            FilledButton(
              onPressed: () async {
                await settings.update(setupDone: true);
                onDone();
              },
              child: Padding(padding: const EdgeInsets.all(12), child: Text(s.continueLabel)),
            ),
          ],
        ),
      ),
    );
  }
}
