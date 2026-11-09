/// Public Supabase settings (safe to ship in the app; data is protected by RLS).
/// Override at build time with --dart-define=SUPABASE_URL=... etc.
class AppConfig {
  static const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://etaetoflotynlmgrehuu.supabase.co',
  );
  static const supabasePublishableKey = String.fromEnvironment(
    'SUPABASE_PUBLISHABLE_KEY',
    defaultValue: 'sb_publishable_5R1YPcMEQ0HQ-kdJ0DsLeA_vg49wCA4',
  );

  /// Internal e-mail behind a file number. Users only ever type the file number.
  static String emailFor(String fileNumber) => '$fileNumber@jahez.local';
}
