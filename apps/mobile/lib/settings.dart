import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Language and theme, saved on the phone. Arabic + light by default.
class AppSettings extends ChangeNotifier {
  AppSettings({this.locale = const Locale('ar'), this.themeMode = ThemeMode.light, this.setupDone = false});

  Locale locale;
  ThemeMode themeMode;

  /// False until the user picks language and theme on first launch.
  bool setupDone;

  static const _langKey = 'lang';
  static const _themeKey = 'theme';
  static const _setupKey = 'setup_done';

  static Future<AppSettings> load() async {
    final prefs = await SharedPreferences.getInstance();
    return AppSettings(
      locale: Locale(prefs.getString(_langKey) == 'en' ? 'en' : 'ar'),
      themeMode: prefs.getString(_themeKey) == 'dark' ? ThemeMode.dark : ThemeMode.light,
      setupDone: prefs.getBool(_setupKey) ?? false,
    );
  }

  Future<void> update({Locale? locale, ThemeMode? themeMode, bool? setupDone}) async {
    this.locale = locale ?? this.locale;
    this.themeMode = themeMode ?? this.themeMode;
    this.setupDone = setupDone ?? this.setupDone;
    notifyListeners();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_langKey, this.locale.languageCode);
    await prefs.setString(_themeKey, this.themeMode == ThemeMode.dark ? 'dark' : 'light');
    await prefs.setBool(_setupKey, this.setupDone);
  }
}
