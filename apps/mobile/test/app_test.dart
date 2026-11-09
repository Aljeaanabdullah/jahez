import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jahez/main.dart';

void main() {
  testWidgets('shows the Jahez placeholder in Arabic, right-to-left',
      (tester) async {
    await tester.pumpWidget(const JahezApp());

    expect(find.text('Jahez'), findsOneWidget);
    expect(find.text('تطبيق التحضير — قيد الإنشاء'), findsOneWidget);

    final context = tester.element(find.byType(PlaceholderScreen));
    expect(Directionality.of(context), TextDirection.rtl);
  });
}
