import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/l10n.dart';
import 'package:jahez/requests/requests_service.dart';
import 'package:jahez/screens/approvals_screen.dart';
import 'package:jahez/screens/month_record_screen.dart';
import 'package:jahez/screens/requests_screens.dart';

import 'fake_requests.dart';

Future<void> pump(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 2.5;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    locale: const Locale('ar'),
    supportedLocales: const [Locale('ar'), Locale('en')],
    localizationsDelegates: GlobalMaterialLocalizations.delegates,
    home: screen,
  ));
  await tester.pumpAndSettle();
}

const s = Strings.ar;
final yesterday = DateUtils.dateOnly(DateTime.now()).subtract(const Duration(days: 1));

RequestItem correction({String status = 'pending_supervisor', String id = 'r1'}) => RequestItem(
      id: id,
      type: 'punch_correction',
      status: status,
      shiftDate: yesterday,
      reason: 'نسيت البصمة',
      createdAt: DateTime.now(),
      punchType: 'check_in',
      time: DateTime(yesterday.year, yesterday.month, yesterday.day, 7, 30),
      employeeNameAr: 'محمد سالم',
      employeeNameEn: 'Mohammed Salem',
      fileNumber: 710013,
      departmentAr: 'العمليات',
    );

void main() {
  testWidgets('monthly record: totals, absences, corrected times and days off', (tester) async {
    final fake = FakeRequests()
      ..days = [
        DayRecord(day: yesterday.subtract(const Duration(days: 2)), kind: 'off'),
        DayRecord(day: yesterday.subtract(const Duration(days: 1)), kind: 'work', arrival: 'absent', departure: 'not_applicable'),
        DayRecord(
          day: yesterday,
          kind: 'work',
          arrival: 'late',
          departure: 'missing',
          lateMinutes: 12,
          checkIn: DateTime(yesterday.year, yesterday.month, yesterday.day, 8, 12),
          checkInCorrected: true,
        ),
      ];
    await pump(tester, MonthRecordScreen(strings: s, isArabic: true, service: fake, employeeId: 'me', title: s.get('my_record')));
    expect(find.text('تأخير: 1 · غياب: 1 · بدون انصراف: 1'), findsOneWidget);
    expect(find.text('متأخر 12 دقيقة'), findsOneWidget);
    expect(find.text('غائب'), findsOneWidget);
    expect(find.text('راحة'), findsOneWidget);
    expect(find.text('لم يسجّل الانصراف'), findsOneWidget);
    expect(find.textContaining('مصححة بطلب'), findsOneWidget);
    // The current month has no "next month".
    expect(tester.widget<IconButton>(find.byKey(const Key('nextMonth'))).onPressed, isNull);
  });

  testWidgets('new correction: needs a reason; server refusals are shown in Arabic', (tester) async {
    final fake = FakeRequests()..submitError = 'correction_too_old';
    await pump(tester, NewRequestScreen(strings: s, isArabic: true, service: fake));

    await tester.tap(find.byKey(const Key('pickDate')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('حسنًا').last); // the picker opens on yesterday
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('pickTime')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('حسنًا').last); // 07:00
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('reason')), 'x');
    await tester.tap(find.byKey(const Key('sendRequest')));
    await tester.pumpAndSettle();
    expect(find.text('اكتب السبب (3 أحرف على الأقل).'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('reason')), 'نسيت البصمة');
    await tester.tap(find.byKey(const Key('sendRequest')));
    await tester.pumpAndSettle();
    expect(find.text('التصحيح مسموح لوردية في آخر 7 أيام فقط.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('sendRequest')));
    await tester.pumpAndSettle();
    expect(fake.submitted, hasLength(1));
    final sent = fake.submitted.single;
    expect(sent['punch'], 'check_in');
    expect(sent['date'], yesterday);
    // 07:00 Kuwait time is 04:00 UTC.
    expect((sent['time'] as DateTime).toUtc(), DateTime.utc(yesterday.year, yesterday.month, yesterday.day, 4));
  });

  testWidgets('new mission: pick a site that is not enabled', (tester) async {
    final fake = FakeRequests();
    await pump(tester, NewRequestScreen(strings: s, isArabic: true, service: fake));
    await tester.tap(find.text('مهمة عمل خارجية'));
    await tester.pumpAndSettle();
    expect(find.textContaining('لموقع غير مفعّل لك'), findsOneWidget);
    await tester.tap(find.byKey(const Key('pickDate')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('حسنًا').last); // today
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('pickSite')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('موقع الشويخ').last);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('reason')), 'صيانة في الموقع');
    await tester.tap(find.byKey(const Key('sendRequest')));
    await tester.pumpAndSettle();
    expect(fake.submitted.single['site'], 'site-2');
  });

  testWidgets('request details: approval steps, and cancel while pending', (tester) async {
    final fake = FakeRequests()
      ..timelineEntries = [
        TimelineEntry(stage: 'supervisor', decision: 'approved', at: DateTime.now(), note: 'تمام', nameAr: 'المشرف خالد'),
      ];
    await pump(tester, RequestDetailsScreen(strings: s, isArabic: true, service: fake, request: correction(status: 'pending_hr')));
    expect(find.text('المشرف: المشرف خالد وافق'), findsOneWidget);
    expect(find.textContaining('تمام'), findsOneWidget);
    expect(find.text('بانتظار الموارد البشرية'), findsWidgets);
    await tester.tap(find.byKey(const Key('cancelRequest')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('نعم'));
    await tester.pumpAndSettle();
    expect(fake.cancelled, ['r1']);
    expect(find.text('ملغى'), findsOneWidget);
    expect(find.byKey(const Key('cancelRequest')), findsNothing);
  });

  testWidgets('a decided request has no cancel button', (tester) async {
    await pump(tester, RequestDetailsScreen(strings: s, isArabic: true, service: FakeRequests(), request: correction(status: 'approved')));
    expect(find.text('مقبول'), findsOneWidget);
    expect(find.byKey(const Key('cancelRequest')), findsNothing);
  });

  testWidgets('approvals: approve with a note; the request leaves the list', (tester) async {
    final fake = FakeRequests()..inboxItems = [correction()];
    await pump(tester, ApprovalsScreen(strings: s, isArabic: true, service: fake));
    expect(find.textContaining('محمد سالم · 710013 · العمليات'), findsOneWidget);
    await tester.tap(find.byKey(const Key('approve-r1')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('decisionNote')), 'موافق');
    await tester.tap(find.byKey(const Key('confirmDecision')));
    await tester.pumpAndSettle();
    expect(fake.decisions.single, ('r1', true, 'موافق'));
    expect(find.text('تم حفظ القرار.'), findsOneWidget);
    expect(find.text('لا توجد طلبات تنتظر قرارك.'), findsOneWidget);
  });

  testWidgets('employee lookup: unknown number, then the record with punches (no photos for HR)', (tester) async {
    final fake = FakeRequests()
      ..employees = {710013: const EmployeeRef(id: 'e1', fileNumber: 710013, nameAr: 'محمد سالم', nameEn: 'Mohammed Salem')}
      ..punchRows = [PunchRow(at: DateTime.now(), type: 'check_in', accepted: false, reason: 'outside_site')];
    await pump(tester, EmployeeLookupScreen(strings: s, isArabic: true, service: fake, withPhotos: false));
    await tester.enterText(find.byKey(const Key('lookupFile')), '799999');
    await tester.tap(find.byKey(const Key('lookupShow')));
    await tester.pumpAndSettle();
    expect(find.text('لا يوجد موظف بهذا الرقم.'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('lookupFile')), '710013');
    await tester.tap(find.byKey(const Key('lookupShow')));
    await tester.pumpAndSettle();
    expect(find.text('محمد سالم · 710013'), findsOneWidget);
    expect(find.text('صور البصمات يطّلع عليها المشرف ومدير النظام فقط.'), findsOneWidget);
    expect(find.textContaining('أنت خارج نطاق موقع العمل.'), findsOneWidget);
    expect(fake.lastWithPhotos, isFalse);
  });
}
