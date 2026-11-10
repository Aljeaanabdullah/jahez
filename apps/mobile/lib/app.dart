import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'auth/auth_service.dart';
import 'enroll/enroll_service.dart';
import 'face/face_capture.dart';
import 'l10n.dart';
import 'punch/phone_checks.dart';
import 'punch/punch_service.dart';
import 'requests/requests_service.dart';
import 'screens/change_password_screen.dart';
import 'screens/consent_screen.dart';
import 'screens/device_blocked_screen.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/setup_screen.dart';
import 'settings.dart';

/// Jahez palette: blues + white.
const seedBlue = Color(0xFF1565C0);

class JahezApp extends StatelessWidget {
  const JahezApp({
    super.key,
    required this.settings,
    required this.auth,
    required this.enroll,
    required this.analyserFactory,
    required this.punch,
    required this.checks,
    required this.requests,
  });

  final AppSettings settings;
  final AuthService auth;
  final EnrollService enroll;
  final Future<FaceAnalyser> Function() analyserFactory;
  final PunchService punch;
  final PhoneChecks checks;
  final RequestsService requests;

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
        home: AppFlow(
          settings: settings,
          auth: auth,
          enroll: enroll,
          analyserFactory: analyserFactory,
          punch: punch,
          checks: checks,
          requests: requests,
        ),
      ),
    );
  }
}

enum _Step { loading, setup, login, changePassword, blocked, consent, home }

/// Decides which screen to show:
/// first launch -> setup; signed out -> login; then bind the phone;
/// then a forced password change on first sign-in; then consent (once); then home.
class AppFlow extends StatefulWidget {
  const AppFlow({
    super.key,
    required this.settings,
    required this.auth,
    required this.enroll,
    required this.analyserFactory,
    required this.punch,
    required this.checks,
    required this.requests,
  });

  final AppSettings settings;
  final AuthService auth;
  final EnrollService enroll;
  final Future<FaceAnalyser> Function() analyserFactory;
  final PunchService punch;
  final PhoneChecks checks;
  final RequestsService requests;

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
    if (profile.mustChangePassword) {
      setState(() => _step = _Step.changePassword);
      return;
    }
    await _afterPassword();
  }

  Future<void> _afterPassword() async {
    final consented = await widget.auth.hasConsent();
    if (mounted) setState(() => _step = consented ? _Step.home : _Step.consent);
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
          onChanged: () {
            _profile = _profile!.copyWith(mustChangePassword: false);
            _afterPassword();
          },
        ),
      _Step.blocked => DeviceBlockedScreen(strings: s, code: _blockedCode, onSignOut: _signOut),
      _Step.consent => ConsentScreen(
          strings: s,
          onSignOut: _signOut,
          onAccept: () async {
            await widget.auth.giveConsent();
            if (mounted) setState(() => _step = _Step.home);
          },
        ),
      _Step.home => HomeScreen(
          strings: s,
          settings: widget.settings,
          profile: _profile!,
          onSignOut: _signOut,
          enroll: widget.enroll,
          analyserFactory: widget.analyserFactory,
          punch: widget.punch,
          checks: widget.checks,
          requests: widget.requests,
        ),
    };
  }
}
