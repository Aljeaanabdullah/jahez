import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'auth/supabase_auth_service.dart';
import 'config.dart';
import 'settings.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(url: AppConfig.supabaseUrl, publishableKey: AppConfig.supabasePublishableKey);
  final settings = await AppSettings.load();
  runApp(JahezApp(settings: settings, auth: SupabaseAuthService(Supabase.instance.client)));
}
