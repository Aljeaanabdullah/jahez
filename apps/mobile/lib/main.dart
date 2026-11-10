import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'auth/supabase_auth_service.dart';
import 'config.dart';
import 'enroll/enroll_service.dart';
import 'face/face_capture.dart';
import 'punch/phone_checks.dart';
import 'punch/punch_service.dart';
import 'requests/requests_service.dart';
import 'settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabasePublishableKey);
  final settings = await AppSettings.load();
  final client = Supabase.instance.client;
  runApp(JahezApp(
    settings: settings,
    auth: SupabaseAuthService(client),
    enroll: SupabaseEnrollService(client),
    analyserFactory: FaceCapture.create,
    punch: SupabasePunchService(client),
    requests: SupabaseRequestsService(client),
    // Debug builds may run on the emulator, which looks rooted; release builds always check.
    checks: const RealPhoneChecks(allowRootedForTesting: kDebugMode || bool.fromEnvironment('JAHEZ_ALLOW_EMULATOR')),
  ));
}
