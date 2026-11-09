import 'package:flutter/widgets.dart';

/// Arabic and English texts. Arabic is the default.
class Strings {
  const Strings._(this._t);
  final Map<String, String> _t;

  static const ar = Strings._(_ar);
  static const en = Strings._(_en);
  static Strings of(Locale locale) => locale.languageCode == 'en' ? en : ar;

  String get(String key) => _t[key] ?? _t['error_generic']!;

  String get appName => 'Jahez';
  String get chooseLanguage => get('choose_language');
  String get chooseTheme => get('choose_theme');
  String get light => get('light');
  String get dark => get('dark');
  String get continueLabel => get('continue');
  String get fileNumber => get('file_number');
  String get password => get('password');
  String get signIn => get('sign_in');
  String get signOut => get('sign_out');
  String get newPassword => get('new_password');
  String get confirmPassword => get('confirm_password');
  String get changePasswordTitle => get('change_password_title');
  String get changePasswordIntro => get('change_password_intro');
  String get passwordRules => get('password_rules');
  String get save => get('save');
  String get deviceBlockedTitle => get('device_blocked_title');
  String get welcome => get('welcome');
  String get homeComingSoon => get('home_coming_soon');
  String get settings => get('settings');
  String get language => get('language');
  String get theme => get('theme');

  /// Message for an error code coming from the server or the form.
  String error(String code) => _t['error_$code'] ?? _t['error_generic']!;
}

const _ar = {
  'choose_language': 'اختر اللغة',
  'choose_theme': 'اختر المظهر',
  'light': 'نهاري',
  'dark': 'ليلي',
  'continue': 'متابعة',
  'file_number': 'رقم الملف الوظيفي',
  'password': 'كلمة المرور',
  'sign_in': 'تسجيل الدخول',
  'sign_out': 'تسجيل الخروج',
  'new_password': 'كلمة المرور الجديدة',
  'confirm_password': 'تأكيد كلمة المرور',
  'change_password_title': 'تغيير كلمة المرور',
  'change_password_intro': 'هذا أول دخول لك. اختر كلمة مرور جديدة قبل المتابعة.',
  'password_rules': '8 أحرف على الأقل، وفيها حروف وأرقام، ولا تحتوي رقم ملفك.',
  'save': 'حفظ',
  'device_blocked_title': 'جهاز غير مسموح',
  'welcome': 'مرحباً',
  'home_coming_soon': 'شاشة التبصيم تُضاف في مرحلة قادمة.',
  'settings': 'الإعدادات',
  'language': 'اللغة',
  'theme': 'المظهر',
  'error_invalid_file_number': 'رقم الملف يجب أن يكون 6 أرقام.',
  'error_invalid_credentials': 'رقم الملف أو كلمة المرور غير صحيحة.',
  'error_account_disabled': 'هذا الحساب موقوف. تواصل مع مدير النظام.',
  'error_no_internet': 'لا يوجد اتصال بالإنترنت. حاول مرة أخرى.',
  'error_mismatch': 'كلمتا المرور غير متطابقتين.',
  'error_too_short': 'كلمة المرور قصيرة. 8 أحرف على الأقل.',
  'error_too_long': 'كلمة المرور طويلة جداً.',
  'error_needs_letter': 'كلمة المرور يجب أن تحتوي حرفاً واحداً على الأقل.',
  'error_needs_digit': 'كلمة المرور يجب أن تحتوي رقماً واحداً على الأقل.',
  'error_contains_file_number': 'لا تستخدم رقم ملفك داخل كلمة المرور.',
  'error_password_rejected': 'كلمة المرور هذه ضعيفة أو مسرّبة. اختر غيرها.',
  'error_other_device':
      'حسابك مرتبط بجوال آخر. إذا غيّرت جوالك، اطلب من مدير النظام فك الربط.',
  'error_device_taken': 'هذا الجوال مرتبط بحساب موظف آخر. لا يمكن استخدامه لحسابك.',
  'error_generic': 'حدث خطأ. حاول مرة أخرى.',
};

const _en = {
  'choose_language': 'Choose your language',
  'choose_theme': 'Choose the look',
  'light': 'Light',
  'dark': 'Dark',
  'continue': 'Continue',
  'file_number': 'File number',
  'password': 'Password',
  'sign_in': 'Sign in',
  'sign_out': 'Sign out',
  'new_password': 'New password',
  'confirm_password': 'Confirm password',
  'change_password_title': 'Change password',
  'change_password_intro': 'This is your first sign-in. Choose a new password to continue.',
  'password_rules': 'At least 8 characters, with letters and digits, and not your file number.',
  'save': 'Save',
  'device_blocked_title': 'Phone not allowed',
  'welcome': 'Welcome',
  'home_coming_soon': 'The punch screen comes in a later phase.',
  'settings': 'Settings',
  'language': 'Language',
  'theme': 'Theme',
  'error_invalid_file_number': 'The file number must be 6 digits.',
  'error_invalid_credentials': 'Wrong file number or password.',
  'error_account_disabled': 'This account is disabled. Contact the system admin.',
  'error_no_internet': 'No internet connection. Try again.',
  'error_mismatch': 'The two passwords do not match.',
  'error_too_short': 'Password too short. At least 8 characters.',
  'error_too_long': 'Password too long.',
  'error_needs_letter': 'The password needs at least one letter.',
  'error_needs_digit': 'The password needs at least one digit.',
  'error_contains_file_number': 'Do not use your file number in the password.',
  'error_password_rejected': 'This password is weak or leaked. Choose another.',
  'error_other_device':
      'Your account is bound to another phone. If you changed phones, ask the system admin to unbind it.',
  'error_device_taken': 'This phone is bound to another employee and cannot be used for your account.',
  'error_generic': 'Something went wrong. Try again.',
};
