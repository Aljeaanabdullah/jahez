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
  String get consentTitle => get('consent_title');
  String get consentBody => get('consent_body');
  String get consentAccept => get('consent_accept');
  String get enrollTitle => get('enroll_title');
  String get enrollFind => get('enroll_find');
  String get enrollNotFound => get('enroll_not_found');
  String get enrollNoLogin => get('enroll_no_login');
  String get enrollNoConsent => get('enroll_no_consent');
  String get enrollSuspended => get('enroll_suspended');
  String get enrollEnrolled => get('enroll_enrolled');
  String get enrollNotEnrolled => get('enroll_not_enrolled');
  String get enrollStart => get('enroll_start');
  String get enrollHint => get('enroll_hint');
  String get enrollCapture => get('enroll_capture');
  String get enrollRetake => get('enroll_retake');
  String get enrollSave => get('enroll_save');
  String get enrollSaved => get('enroll_saved');
  String get enrollReplaces => get('enroll_replaces');
  String get cameraError => get('camera_error');

  /// Text for a photo quality problem (`no_face`, `too_far`, …).
  String quality(String code) => _t['quality_$code'] ?? _t['quality_no_face']!;

  /// Text for an enroll-face server error; `{n}` becomes the other employee's file number.
  String enrollError(String code, {int? fileNumber}) =>
      (_t['enroll_error_$code'] ?? _t['error_generic']!).replaceAll('{n}', '${fileNumber ?? '?'}');

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
  'consent_title': 'الموافقة على جمع البيانات',
  'consent_body':
      'أوافق على أن تجمع الشركة صورة وجهي وبصمته الرقمية، وموقعي وقت التبصيم وأثناء حالات الطوارئ فقط، لغرض تسجيل الحضور والانصراف وسلامتي.\n\n'
          '• لا يُتتبع موقعي طوال الدوام.\n'
          '• تُحذف صور التبصيم تلقائياً بعد 3 أشهر.\n'
          '• عند انتهاء خدمتي يُصدَّر سجلي ثم تُحذف بياناتي.\n\n'
          'بدون هذه الموافقة لا يمكن تسجيل وجهي ولا التبصيم.',
  'consent_accept': 'أوافق',
  'enroll_title': 'تسجيل وجه موظف',
  'enroll_find': 'بحث',
  'enroll_not_found': 'لا يوجد موظف بهذا الرقم.',
  'enroll_no_login': 'ليس للموظف حساب دخول بعد. يجب أن يدخل التطبيق ويوافق أولاً.',
  'enroll_no_consent': 'لم يوافق الموظف بعد. اطلب منه الدخول إلى التطبيق والموافقة.',
  'enroll_suspended': 'حساب الموظف موقوف.',
  'enroll_enrolled': 'مسجّل',
  'enroll_not_enrolled': 'غير مسجّل',
  'enroll_start': 'التقاط الصور',
  'enroll_hint': 'اجعل الوجه في منتصف الصورة، مواجهاً للكاميرا، بإضاءة جيدة. التقط 3 صور.',
  'enroll_capture': 'التقاط',
  'enroll_retake': 'إعادة',
  'enroll_save': 'حفظ التسجيل',
  'enroll_saved': 'تم تسجيل الوجه بنجاح.',
  'enroll_replaces': 'إعادة التسجيل تستبدل البصمة والصور القديمة.',
  'camera_error': 'تعذّر تشغيل الكاميرا. اسمح للتطبيق باستخدامها.',
  'quality_no_face': 'لا يوجد وجه واضح في الصورة.',
  'quality_many_faces': 'يوجد أكثر من وجه. يجب أن يظهر الموظف وحده.',
  'quality_too_far': 'الوجه بعيد. اقترب من الكاميرا.',
  'quality_tilted': 'الرأس مائل. اجعله مستقيماً.',
  'quality_not_frontal': 'انظر مباشرة إلى الكاميرا.',
  'quality_too_dark': 'الإضاءة ضعيفة.',
  'quality_too_bright': 'الإضاءة قوية جداً.',
  'enroll_error_hr_only': 'التسجيل للموارد البشرية فقط.',
  'enroll_error_no_consent': 'لم يوافق الموظف بعد من التطبيق.',
  'enroll_error_photos_not_same_person': 'الصور الثلاث لا تبدو لنفس الشخص. أعد الالتقاط.',
  'enroll_error_face_already_enrolled': 'هذا الوجه مسجّل لموظف آخر (رقم الملف {n}).',
  'enroll_error_employee_suspended': 'حساب الموظف موقوف.',
  'enroll_error_invalid_photos': 'الصور غير صالحة. أعد الالتقاط.',
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
  'consent_title': 'Consent to data collection',
  'consent_body':
      'I agree that the company collects a photo of my face and its digital template, and my location only when I punch and during emergencies, to record attendance and for my safety.\n\n'
          '• My location is not tracked during work.\n'
          '• Punch photos are deleted automatically after 3 months.\n'
          '• When I leave, my record is exported and then my data is deleted.\n\n'
          'Without this consent my face cannot be enrolled and I cannot punch.',
  'consent_accept': 'I agree',
  'enroll_title': 'Enroll an employee face',
  'enroll_find': 'Find',
  'enroll_not_found': 'No employee with this number.',
  'enroll_no_login': 'The employee has no log-in yet. They must sign in to the app and consent first.',
  'enroll_no_consent': 'The employee has not consented yet. Ask them to sign in to the app and accept.',
  'enroll_suspended': "The employee's account is suspended.",
  'enroll_enrolled': 'Enrolled',
  'enroll_not_enrolled': 'Not enrolled',
  'enroll_start': 'Take photos',
  'enroll_hint': 'Keep the face centred, looking at the camera, in good light. Take 3 photos.',
  'enroll_capture': 'Capture',
  'enroll_retake': 'Retake',
  'enroll_save': 'Save enrollment',
  'enroll_saved': 'Face enrolled.',
  'enroll_replaces': 'Re-enrolling replaces the old face data and photos.',
  'camera_error': 'Could not start the camera. Allow the app to use it.',
  'quality_no_face': 'No clear face in the picture.',
  'quality_many_faces': 'More than one face. The employee must be alone.',
  'quality_too_far': 'The face is too far. Move closer.',
  'quality_tilted': 'The head is tilted. Keep it straight.',
  'quality_not_frontal': 'Look straight at the camera.',
  'quality_too_dark': 'Too dark.',
  'quality_too_bright': 'Too bright.',
  'enroll_error_hr_only': 'Only HR can enroll faces.',
  'enroll_error_no_consent': 'The employee has not consented in the app yet.',
  'enroll_error_photos_not_same_person': 'The three photos do not look like the same person. Retake them.',
  'enroll_error_face_already_enrolled': 'This face is already enrolled for another employee (file {n}).',
  'enroll_error_employee_suspended': "The employee's account is suspended.",
  'enroll_error_invalid_photos': 'The photos are not valid. Retake them.',
  'error_generic': 'Something went wrong. Try again.',
};
