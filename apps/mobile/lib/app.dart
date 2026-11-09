import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/auth_service.dart';
import 'l10n.dart';
import 'screens/change_password_screen.dart';
import 'screens/device_blocked_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/setup_screen.dart';
import 'settings.dart';

/// Jahez palette: blues + white.
const seedBlue = Color(0xFF1565C0);

class JahezApp extends StatelessWidget {
  const JahezApp({super.key, required this.settings, required this.auth});

  final AppSettings settings;
  final AuthService auth;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: settings,
      builder: (context, _) => MaterialApp(
        title: 'Jahez',
        debugShowCheckedModeBanner: false,
        locale: settings.locale,
        supportedLocales: const [Locale('ar'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        themeMode: settings.themeMode,
        theme: ThemeData(colorScheme: ColorScheme.fromSeed(seedColor: seedBlue)),
        darkTheme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: seedBlue, brightness: Brightness.dark),
        ),
        home: AppFlow(settings: settings, auth: auth),
      ),
    );
  }
}

enum _Step { loading, setup, login, changePassword, blocked, home }

/// Decides which screen to show:
/// first launch -> setup; signed out -> login; then bind the phone;
/// then a forced password change on first sign-in; then home.
class AppFlow extends StatefulWidget {
  const AppFlow({super.key, required this.settings, required this.auth});

  final AppSettings settings;
  final AuthService auth;

  @override
  State<AppFlow> createState() => _AppFlowState();
}

class _AppFlowState extends State<AppFlow> {
  _Step _step = _Step.loading;
  Profile? _profile;
  String _blockedCode = 'other_device';

  @override
  void initState() {
    super.initState();
    _start();
  }

  Future<void> _start() async {
    if (!widget.settings.setupDone) {
      setState(() => _step = _Step.setup);
      return;
    }
    Profile? profile;
    try {
      profile = await widget.auth.currentProfile();
    } catch (_) {
      profile = null;
    }
    if (profile == null) {
      if (mounted) setState(() => _step = _Step.login);
      return;
    }
    await _afterSignIn(profile);
  }

  Future<void> _afterSignIn(Profile profile) async {
    _profile = profile;
    final status = await widget.auth.bindThisDevice();
    if (!mounted) return;
    if (status == DeviceStatus.otherDevice || status == DeviceStatus.deviceTaken) {
      setState(() {
        _blockedCode = status == DeviceStatus.otherDevice ? 'other_device' : 'device_taken';
        _step = _Step.blocked;
      });
      return;
    }
    setState(() => _step = profile.mustChangePassword ? _Step.changePassword : _Step.home);
  }

  Future<void> _signOut() async {
    await widget.auth.signOut();
    if (mounted) setState(() => _step = _Step.login);
  }

  @override
  Widget build(BuildContext context) {
    final s = Strings.of(widget.settings.locale);
    return switch (_step) {
      _Step.loading => const Scaffold(body: Center(child: CircularProgressIndicator())),
      _Step.setup => SetupScreen(
          settings: widget.settings,
          onDone: () => setState(() => _step = _Step.login),
        ),
      _Step.login => LoginScreen(strings: s, auth: widget.auth, onSignedIn: _afterSignIn),
      _Step.changePassword => ChangePasswordScreen(
          strings: s,
          auth: widget.auth,
          fileNumber: _profile!.fileNumber,
          onChanged: () => setState(() {
            _profile = _profile!.copyWith(mustChangePassword: false);
            _step = _Step.home;
          }),
        ),
      _Step.blocked => DeviceBlockedScreen(strings: s, code: _blockedCode, onSignOut: _signOut),
      _Step.home => HomeScreen(
          strings: s,
          settings: widget.settings,
          profile: _profile!,
          onSignOut: _signOut,
        ),
    };
  }
}
