import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/app.dart';
import 'package:jahez/auth/auth_service.dart';
import 'package:jahez/enroll/enroll_service.dart';
import 'package:jahez/face/face_capture.dart';
import 'package:jahez/punch/phone_checks.dart';
import 'package:jahez/punch/punch_service.dart';
import 'package:jahez/settings.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_requests.dart';

/// In-memory stand-in for the Supabase backend.
class FakeAuth implements AuthService {
  FakeAuth({
    this.password = 'Start1234',
    this.mustChange = true,
    this.device = DeviceStatus.bound,
    this.consented = true,
    this.role = 'employee',
  });

  String password;
  bool mustChange;
  DeviceStatus device;
  bool consented;
  String role;
  bool signedIn = false;
  String? lastNewPassword;
  String? serverPasswordError;

  Profile get _profile => Profile(
        id: '00000000-0000-0000-0000-000000000013',
        fileNumber: 710013,
        nameAr: 'محمد سالم الغانم',
        nameEn: 'Mohammed Salem Al-Ghanim',
        role: role,
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
  Future<bool> hasConsent() async => consented;

  @override
  Future<void> giveConsent() async => consented = true;

  @override
  Future<void> signOut() async => signedIn = false;
}

class FakeEnroll implements EnrollService {
  final targets = <int, EnrollTarget>{};

  @override
  Future<EnrollTarget?> find(int fileNumber) async => targets[fileNumber];

  @override
  Future<void> enroll(String employeeId, List<String> photos, List<List<double>> descriptors) async {}
}

Future<FaceAnalyser> noAnalyser() => throw UnimplementedError('camera not used in these tests');

class FakePunch implements PunchService {
  List<PunchEntry> entries = [];
  ShiftInfo? shift;

  @override
  Future<List<PunchEntry>> today() async => entries;

  @override
  Future<ShiftInfo?> currentShift() async => shift;

  @override
  Future<PunchResult> punch({
    required double lat,
    required double lng,
    required double accuracy,
    required Map<String, dynamic> report,
    required List<double> descriptor,
    required String photoBase64,
  }) async =>
      throw UnimplementedError('the camera step is not reached in these tests');
}

class FakeChecks implements PhoneChecks {
  FakeChecks(this.report);
  final PhoneReport report;

  @override
  Future<PhoneReport> run() async => report;
}

const okChecks = PhoneReport(vpn: false, rooted: false, mockLocation: false, position: null);

Future<void> pumpApp(WidgetTester tester, FakeAuth auth,
    {bool setupDone = true, String lang = 'ar', FakeEnroll? enroll, FakePunch? punch, PhoneReport checks = okChecks, FakeRequests? requests}) async {
  final settings = AppSettings(locale: Locale(lang), setupDone: setupDone);
  await tester.pumpWidget(JahezApp(settings: settings, auth: auth, enroll: enroll ?? FakeEnroll(), analyserFactory: noAnalyser,
      punch: punch ?? FakePunch(),
      checks: FakeChecks(checks),
      requests: requests ?? FakeRequests()));
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

    await tester.scrollUntilVisible(find.text('تسجيل الخروج'), 200);
    await tester.tap(find.text('تسجيل الخروج'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('signIn')), findsOneWidget);
    expect(auth.signedIn, false);
  });

  testWidgets('without consent the employee sees the consent screen; accepting it opens home', (tester) async {
    final auth = FakeAuth(mustChange: false, device: DeviceStatus.ok, consented: false)..signedIn = true;
    await pumpApp(tester, auth);
    expect(find.text('الموافقة على جمع البيانات'), findsOneWidget);
    expect(find.byKey(const Key('welcome')), findsNothing);
    await tester.tap(find.byKey(const Key('acceptConsent')));
    await tester.pumpAndSettle();
    expect(auth.consented, true);
    expect(find.byKey(const Key('welcome')), findsOneWidget);
  });

  testWidgets('after the first password change the consent screen comes next', (tester) async {
    final auth = FakeAuth(consented: false);
    await pumpApp(tester, auth);
    await signIn(tester, '710013', 'Start1234');
    await tester.enterText(find.byKey(const Key('newPassword')), 'Kuwait2026a');
    await tester.enterText(find.byKey(const Key('confirmPassword')), 'Kuwait2026a');
    await tester.tap(find.byKey(const Key('save')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('acceptConsent')), findsOneWidget);
  });

  testWidgets('only HR sees the face enrollment button', (tester) async {
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true);
    expect(find.byKey(const Key('openEnroll')), findsNothing);
  });

  testWidgets('HR: enrollment explains why an employee cannot be enrolled yet', (tester) async {
    final enroll = FakeEnroll();
    enroll.targets[710100] = const EnrollTarget(id: 'a', fileNumber: 710100, nameAr: 'بلا موافقة', nameEn: 'No consent', isActive: true, hasLogin: true, hasConsent: false, enrolled: false);
    enroll.targets[710101] = const EnrollTarget(id: 'b', fileNumber: 710101, nameAr: 'جاهز', nameEn: 'Ready', isActive: true, hasLogin: true, hasConsent: true, enrolled: true);
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.ok, role: 'hr')..signedIn = true, enroll: enroll);

    await tester.tap(find.byKey(const Key('openEnroll')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('enrollFile')), '710100');
    await tester.tap(find.byKey(const Key('enrollFind')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('enrollBlocker')), findsOneWidget);
    expect(find.byKey(const Key('enrollStart')), findsNothing);

    await tester.enterText(find.byKey(const Key('enrollFile')), '710101');
    await tester.tap(find.byKey(const Key('enrollFind')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('enrollStart')), findsOneWidget);
    expect(find.text('إعادة التسجيل تستبدل البصمة والصور القديمة.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('enrollFile')), '799999');
    await tester.tap(find.byKey(const Key('enrollFind')));
    await tester.pumpAndSettle();
    expect(find.text('لا يوجد موظف بهذا الرقم.'), findsOneWidget);
  });

  testWidgets("home shows the punch button and today's punches", (tester) async {
    final punch = FakePunch()
      ..entries = [
        PunchEntry(type: 'check_in', at: DateTime(2026, 11, 10, 7, 5), accepted: true),
        PunchEntry(type: 'check_in', at: DateTime(2026, 11, 10, 7, 1), accepted: false, reason: 'outside_site'),
      ]
      ..shift = ShiftInfo(
        start: DateTime(2026, 11, 10, 7),
        end: DateTime(2026, 11, 10, 15),
        checkinOpens: DateTime(2026, 11, 10, 6),
        arrival: 'late',
        departure: 'pending',
        lateMinutes: 5,
      );
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true, punch: punch);
    // Checked in to the current shift, so the button offers out.
    expect(find.text('تسجيل خروج'), findsWidgets);
    expect(find.text('أنت خارج نطاق موقع العمل.'), findsOneWidget);
    expect(find.textContaining('ورديتك'), findsOneWidget);
    expect(find.text('متأخر 5 دقيقة'), findsOneWidget);
  });

  testWidgets('home says when there is no upcoming shift', (tester) async {
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true);
    expect(find.text('لا توجد وردية قريبة.'), findsOneWidget);
    expect(find.text('تسجيل دخول'), findsWidgets);
  });

  testWidgets('with a VPN on, the punch stops before the camera with a clear reason', (tester) async {
    await pumpApp(
      tester,
      FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true,
      checks: const PhoneReport(vpn: true, rooted: false, mockLocation: false, position: null),
    );
    await tester.tap(find.byKey(const Key('punchButton')));
    await tester.pumpAndSettle();
    expect(find.text('لم يتم التبصيم'), findsOneWidget);
    expect(find.text('أوقف تشغيل VPN ثم حاول مرة أخرى.'), findsOneWidget);
  });

  testWidgets('without location, the punch stops with a clear reason', (tester) async {
    await pumpApp(tester, FakeAuth(mustChange: false, device: DeviceStatus.ok)..signedIn = true);
    await tester.tap(find.byKey(const Key('punchButton')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('punchReason')), findsOneWidget);
    expect(find.textContaining('فعّل الموقع'), findsOneWidget);
  });
}
