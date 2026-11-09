import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() {
  runApp(const JahezApp());
}

/// Jahez palette: blues + white. Language and theme switches come in Phase 2.
const _seedBlue = Color(0xFF1565C0);

class JahezApp extends StatelessWidget {
  const JahezApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Jahez',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _seedBlue),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: _seedBlue,
          brightness: Brightness.dark,
        ),
      ),
      home: const PlaceholderScreen(),
    );
  }
}

class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Jahez',
              style: TextStyle(
                fontSize: 40,
                fontWeight: FontWeight.bold,
                color: colors.primary,
              ),
            ),
            const SizedBox(height: 12),
            const Text('تطبيق التحضير — قيد الإنشاء'),
          ],
        ),
      ),
    );
  }
}
