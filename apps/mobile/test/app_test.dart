import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/app.dart';
import 'package:jahez/auth/auth_service.dart';
import 'package:jahez/settings.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// In-memory stand-in for the Supabase backend.
class FakeAuth implements AuthService {
  FakeAuth({this.password = 'Start1234', this.mustChange = true, this.device = DeviceStatus.bound});

  String password;
  bool mustChange;
  DeviceStatus device;
  bool signedIn = false;
  String? lastNewPassword;
  String? serverPasswordError;

  Profile get _profile => Profile(
        fileNumber: 710013,
        nameAr: 'محمد سالم الغانم',
        nameEn: 'Mohammed Salem Al-Ghanim',
        role: 'employee',
        mustChangePassword: mustChange,
      );

  @override
  Future<Profile?> currentProfile() async => signedIn ? _profile : null;

  @override
  Future<Profile> signIn(String fileNumber, String password) async {
    if (!RegExp(r'^\d{6}$').hasMatch(fileNumber)) throw const AuthFailure('invalid_file_number');
    if (fileNumber != '710013' || password != this.password) throw const AuthFailure('invalid_credentials');
    signedIn = true;
    return _profile;
  }

  @override
  Future<void> changePassword(String newPassword) async {
    if (serverPasswordError != null) throw AuthFailure(serverPasswordError!);
    lastNewPassword = newPassword;
    password = newPassword;
    mustChange = false;
  }

  @override
  Future<DeviceStatus> bindThisDevice() async => device;

  @override
  Future<void> signOut() async => signedIn = false;
}

Future<void> pumpApp(WidgetTester tester, FakeAuth auth, {bool setupDone = true, String lang = 'ar'}) async {
  final settings = AppSettings(locale: Locale(lang), setupDone: setupDone);
  await tester.pumpWidget(JahezApp(settings: settings, auth: auth));
  await tester.pumpAndSettle();
}

Future<void> signIn(WidgetTester tester, String fileNumber, String password) async {
  await tester.enterText(find.byKey(const Key('fileNumber')), fileNumber);
  await tester.enterText(find.byKey(const Key('password')), password);
  await tester.tap(find.byKey(const Key('signIn')));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('first launch asks for language and theme, then shows sign-in', (tester) async {
    await pumpApp(tester, FakeAuth(), setupDone: false);
    expect(find.text('اختر اللغة'), findsOneWidget);

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(find.text('Choose your language'), findsOneWidget);

    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    expect(Theme.of(tester.element(find.text('Continue'))).brightness, Brightness.dark);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('signIn')), findsOneWidget);
    expect(Directionality.of(tester.element(find.byKey(const Key('signIn')))), TextDirection.ltr);
  });

  testWidgets('Arabic is right-to-left by default', (tester) async {
    await pumpApp(tester, FakeAuth());
    expect(find.text('تسجيل الدخول'), findsOneWidget);
    expect(Directionality.of(tester.element(find.byKey(const Key('signIn')))), TextDirection.rtl);
  });

  testWidgets('wrong password shows a clear error', (tester) async {
    await pumpApp(tester, FakeAuth());
    await signIn(tester, '710013', 'wrong-pass1');
    expect(find.text('رقم الملف أو كلمة المرور غير صحيحة.'), findsOneWidget);
  });

  testWidgets('first sign-in forces a password change, then shows home', (tester) async {
    final auth = FakeAuth();
    await pumpApp(tester, auth);
    await signIn(tester, '710013', 'Start1234');
    expect(find.text('تغيير كلمة المرور'), findsOneWidget);

    // Rules are checked before calling the server.
    await tester.enterText(find.byKey(const Key('newPassword')), 'short1');
    await tester.enterText(find.byKey(const Key('confirmPassword')), 'short1');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(find.text('كلمة المرور قصيرة. 8 أحرف على الأقل.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('newPassword')), 'abc710013x9');
    await tester.enterText(find.byKey(const Key('confirmPassword')), 'abc710013x9');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(find.text('لا تستخدم رقم ملفك داخل كلمة المرور.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('newPassword')), 'Kuwait2026a');
    await tester.enterText(find.byKey(const Key('confirmPassword')), 'Kuwait2026b');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(find.text('كلمتا المرور غير متطابقتين.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('confirmPassword')), 'Kuwait2026a');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(auth.lastNewPassword, 'Kuwait2026a');
    expect(find.byKey(const Key('welcome')), findsOneWidget);
    expect(find.textContaining('محمد سالم الغانم'), findsOneWidget);
  });

  testWidgets('a server refusal (leaked password) is shown', (tester) async {
    final auth = FakeAuth()..serverPasswordError = 'password_rejected';
    await pumpApp(tester, auth);
    await signIn(tester, '710013', 'Start1234');
    await tester.enterText(find.byKey(const Key('newPassword')), 'Password123');
    await tester.enterText(find.byKey(const Key('confirmPassword')), 'Password123');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(find.text('كلمة المرور هذه ضعيفة أو مسرّبة. اختر غيرها.'), findsOneWidget);
  });

  testWidgets('account bound to another phone is blocked', (tester) async {
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.otherDevice));
    await signIn(tester, '710013', 'Start1234');
    expect(find.text('جهاز غير مسموح'), findsOneWidget);
    expect(find.textContaining('مرتبط بجوال آخر'), findsOneWidget);
    expect(find.byKey(const Key('welcome')), findsNothing);
  });

  testWidgets('a phone that belongs to someone else is blocked', (tester) async {
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.deviceTaken));
    await signIn(tester, '710013', 'Start1234');
    expect(find.textContaining('مرتبط بحساب موظف آخر'), findsOneWidget);
  });

  testWidgets('returning user on the bound phone goes straight home, and can sign out', (tester) async {
    final auth = FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true;
    await pumpApp(tester, auth);
    expect(find.byKey(const Key('welcome')), findsOneWidget);

    await tester.tap(find.text('تسجيل الخروج'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('signIn')), findsOneWidget);
    expect(auth.signedIn, false);
  });
}
