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

  String get punchIn => get('punch_in');
  String get punchOut => get('punch_out');
  String get punchToday => get('punch_today');
  String get punchNone => get('punch_none');
  String get punchChecking => get('punch_checking');
  String get punchSending => get('punch_sending');
  String get punchLookAtCamera => get('punch_look_at_camera');
  String get punchFaceCamera => get('punch_face_camera');
  String get punchAccepted => get('punch_accepted');
  String get punchRejected => get('punch_rejected');
  String get punchTryAgain => get('punch_try_again');
  String get punchDone => get('punch_done');
  String get punchRefused => get('punch_refused');

  /// Instruction for a liveness challenge (`blink`, `turnHead`, `smile`).
  String challenge(String name) => get('challenge_$name');

  /// Why a punch was refused (`outside_site`, `face_mismatch`, …).
  String shiftTime(String from, String to) => get('shift_time').replaceAll('{from}', from).replaceAll('{to}', to);
  String shiftOpens(String time) => get('shift_opens').replaceAll('{time}', time);
  String fill(String key, Map<String, Object> values) =>
      values.entries.fold(get(key), (text, e) => text.replaceAll('{${e.key}}', '${e.value}'));

  String shiftLate(int minutes) => get('shift_status_late').replaceAll('{minutes}', '$minutes');

  String punchReason(String code) => _t['punch_reason_$code'] ?? _t['error_generic']!;

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
  'punch_in': 'تسجيل دخول',
  'punch_out': 'تسجيل خروج',
  'punch_today': 'بصمات اليوم',
  'punch_none': 'لا توجد بصمات اليوم.',
  'punch_checking': 'جاري فحص الجوال والموقع…',
  'punch_sending': 'جاري التحقق…',
  'punch_look_at_camera': 'ضع وجهك داخل الإطار.',
  'punch_face_camera': 'الآن انظر مباشرة إلى الكاميرا.',
  'punch_accepted': 'تم التبصيم بنجاح',
  'punch_rejected': 'لم يتم التبصيم',
  'punch_try_again': 'حاول مرة أخرى',
  'punch_done': 'تم',
  'punch_refused': 'مرفوضة',
  'challenge_blink': 'ارمش بعينيك.',
  'challenge_turnHead': 'التفت برأسك يميناً أو يساراً.',
  'challenge_smile': 'ابتسم.',
  'punch_reason_wrong_device': 'هذا ليس جوالك المرتبط بحسابك.',
  'punch_reason_vpn': 'أوقف تشغيل VPN ثم حاول مرة أخرى.',
  'punch_reason_mock_location': 'تم اكتشاف تطبيق لتغيير الموقع. أوقفه ثم حاول مرة أخرى.',
  'punch_reason_rooted': 'هذا الجوال معدّل (روت)، ولا يمكن التبصيم منه.',
  'punch_reason_no_location': 'تعذّر تحديد موقعك. فعّل الموقع (GPS) واسمح للتطبيق باستخدامه.',
  'punch_reason_liveness_failed': 'لم يكتمل التحقق من الوجه الحي. حاول مرة أخرى.',
  'punch_reason_many_faces': 'يوجد أكثر من وجه أمام الكاميرا.',
  'punch_reason_face_changed': 'اختفى الوجه أو تغيّر أثناء التحقق. حاول مرة أخرى.',
  'punch_reason_weak_gps': 'إشارة الموقع ضعيفة. اقترب من مكان مفتوح وحاول مرة أخرى.',
  'punch_reason_outside_site': 'أنت خارج نطاق موقع العمل.',
  'punch_reason_no_site': 'لا يوجد موقع عمل مفعّل لك. تواصل مع مدير النظام.',
  'punch_reason_face_mismatch': 'الوجه لا يطابق الوجه المسجّل.',
  'punch_reason_not_enrolled': 'وجهك غير مسجّل بعد. راجع الموارد البشرية.',
  'punch_reason_no_consent': 'يجب الموافقة على جمع البيانات أولاً.',
  'punch_reason_locked': 'محاولات فاشلة كثيرة. انتظر 5 دقائق ثم حاول.',
  'punch_reason_wrong_model_version': 'حدّث التطبيق إلى آخر نسخة.',
  'punch_reason_timeout': 'انتهى الوقت. حاول مرة أخرى.',
  'punch_reason_no_work_pattern': 'لا يوجد لك نمط دوام. تواصل مع الموارد البشرية.',
  'punch_reason_no_shift_now': 'لا توجد وردية الآن. يفتح التبصيم قبل بداية ورديتك بساعة.',
  'punch_reason_already_checked_out': 'سجّلت انصرافك من هذه الوردية.',
  'punch_reason_checkin_window_closed': 'انتهت ورديتك، ولا يمكن تسجيل الحضور الآن.',
  'punch_reason_rules_failed': 'حدث خطأ في الخادم. حاول مرة أخرى.',
  'shift_title': 'ورديتك',
  'shift_none': 'لا توجد وردية قريبة.',
  'shift_time': 'من {from} إلى {to}',
  'shift_opens': 'يفتح التبصيم الساعة {time}',
  'shift_status_pending': 'لم تسجّل حضورك بعد',
  'shift_status_on_time': 'حضرت في الوقت',
  'shift_status_late': 'متأخر {minutes} دقيقة',
  'shift_status_out': 'سجّلت الانصراف',
  'my_record': 'كشفي الشهري',
  'my_requests': 'طلباتي',
  'approvals': 'الموافقات',
  'employee_record': 'سجل موظف',
  'prev_month': 'الشهر السابق',
  'next_month': 'الشهر التالي',
  'totals': 'تأخير: {late} · غياب: {absent} · بدون انصراف: {missing}',
  'kind_off': 'راحة',
  'kind_holiday': 'عطلة رسمية',
  'kind_continued': 'ضمن الوردية السابقة',
  'kind_before_hire': 'قبل إضافة الموظف',
  'arrival_pending': 'لم يحضر بعد',
  'arrival_upcoming': 'قادمة',
  'arrival_on_time': 'في الوقت',
  'arrival_absent': 'غائب',
  'late_by': 'متأخر {minutes} دقيقة',
  'early_by': 'خرج قبل النهاية بـ {minutes} دقيقة',
  'missing_out': 'لم يسجّل الانصراف',
  'corrected': 'مصححة بطلب',
  'in_label': 'حضور',
  'out_label': 'انصراف',
  'new_request': 'طلب جديد',
  'no_requests': 'لا توجد طلبات.',
  'type_punch_correction': 'تصحيح بصمة',
  'type_external_mission': 'مهمة عمل خارجية',
  'status_pending_supervisor': 'بانتظار المشرف',
  'status_pending_hr': 'بانتظار الموارد البشرية',
  'status_approved': 'مقبول',
  'status_rejected': 'مرفوض',
  'status_cancelled': 'ملغى',
  'stage_supervisor': 'المشرف',
  'stage_hr': 'الموارد البشرية',
  'decision_approved': 'وافق',
  'decision_rejected': 'رفض',
  'request_details': 'تفاصيل الطلب',
  'shift_day': 'يوم الوردية',
  'requested_time': 'الوقت المطلوب',
  'site': 'الموقع',
  'reason': 'السبب',
  'submitted_at': 'قُدّم في',
  'path': 'مراحل الموافقة',
  'waiting': 'بانتظار القرار',
  'cancel_request': 'إلغاء الطلب',
  'cancel_confirm': 'هل تريد إلغاء هذا الطلب؟',
  'yes': 'نعم',
  'no': 'لا',
  'send': 'إرسال',
  'sent': 'تم إرسال الطلب.',
  'choose_date': 'اختر اليوم',
  'choose_time': 'اختر الوقت',
  'choose_site': 'اختر الموقع',
  'correction_hint': 'لوردية في آخر 7 أيام. اختر حضور أو انصراف والوقت الصحيح.',
  'mission_hint': 'لموقع غير مفعّل لك، ليوم واحد من اليوم حتى 30 يوماً قادمة.',
  'no_mission_sites': 'كل المواقع مفعّلة لك، لا حاجة لمهمة خارجية.',
  'note_optional': 'ملاحظة (اختيارية)',
  'approve': 'قبول',
  'reject': 'رفض',
  'decided': 'تم حفظ القرار.',
  'inbox_empty': 'لا توجد طلبات تنتظر قرارك.',
  'find_employee': 'رقم الملف الوظيفي',
  'show': 'عرض',
  'employee_not_found': 'لا يوجد موظف بهذا الرقم.',
  'punches': 'البصمات',
  'no_punches': 'لا توجد بصمات في هذا الشهر.',
  'accepted': 'مقبولة',
  'rejected': 'مرفوضة',
  'photos_hidden': 'صور البصمات يطّلع عليها المشرف ومدير النظام فقط.',
  'req_error_correction_too_old': 'التصحيح مسموح لوردية في آخر 7 أيام فقط.',
  'req_error_time_in_future': 'الوقت المختار لم يأتِ بعد.',
  'req_error_no_shift_that_day': 'ليس لديك وردية في هذا اليوم.',
  'req_error_time_outside_shift': 'الوقت خارج نافذة الوردية.',
  'req_error_check_in_first': 'لا يوجد حضور لهذا اليوم. قدّم طلب تصحيح الحضور أولاً.',
  'req_error_duplicate_request': 'يوجد طلب مشابه لم يُبتّ فيه بعد.',
  'req_error_mission_date_out_of_range': 'تاريخ المهمة من اليوم حتى 30 يوماً قادمة.',
  'req_error_site_not_found': 'الموقع غير موجود أو غير مفعّل.',
  'req_error_site_already_enabled': 'هذا الموقع مفعّل لك أصلاً.',
  'req_error_reason_required': 'اكتب السبب (3 أحرف على الأقل).',
  'req_error_cannot_cancel': 'لا يمكن إلغاء هذا الطلب.',
  'req_error_not_allowed': 'لا تملك صلاحية القرار على هذا الطلب.',
  'req_error_note_too_long': 'الملاحظة طويلة جداً.',
  'req_error_generic': 'حدث خطأ. حاول مرة أخرى.',
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
  'punch_in': 'Punch in',
  'punch_out': 'Punch out',
  'punch_today': "Today's punches",
  'punch_none': 'No punches today.',
  'punch_checking': 'Checking the phone and location…',
  'punch_sending': 'Verifying…',
  'punch_look_at_camera': 'Put your face inside the frame.',
  'punch_face_camera': 'Now look straight at the camera.',
  'punch_accepted': 'Punch recorded',
  'punch_rejected': 'Punch not recorded',
  'punch_try_again': 'Try again',
  'punch_done': 'Done',
  'punch_refused': 'Refused',
  'challenge_blink': 'Blink your eyes.',
  'challenge_turnHead': 'Turn your head left or right.',
  'challenge_smile': 'Smile.',
  'punch_reason_wrong_device': 'This is not the phone bound to your account.',
  'punch_reason_vpn': 'Turn off the VPN and try again.',
  'punch_reason_mock_location': 'A location-faking app was detected. Turn it off and try again.',
  'punch_reason_rooted': 'This phone is rooted; punching from it is not allowed.',
  'punch_reason_no_location': 'Could not get your location. Turn on GPS and allow the app to use it.',
  'punch_reason_liveness_failed': 'The live face check was not completed. Try again.',
  'punch_reason_many_faces': 'More than one face in front of the camera.',
  'punch_reason_face_changed': 'The face disappeared or changed during the check. Try again.',
  'punch_reason_weak_gps': 'Weak location signal. Move to an open area and try again.',
  'punch_reason_outside_site': 'You are outside the work site.',
  'punch_reason_no_site': 'No work site is enabled for you. Contact the system admin.',
  'punch_reason_face_mismatch': 'The face does not match the enrolled face.',
  'punch_reason_not_enrolled': 'Your face is not enrolled yet. See HR.',
  'punch_reason_no_consent': 'You must accept the data consent first.',
  'punch_reason_locked': 'Too many failed attempts. Wait 5 minutes and try again.',
  'punch_reason_wrong_model_version': 'Update the app to the latest version.',
  'punch_reason_timeout': 'Time is up. Try again.',
  'punch_reason_no_work_pattern': 'You have no work pattern. Contact HR.',
  'punch_reason_no_shift_now': 'No shift now. Punching opens one hour before your shift.',
  'punch_reason_already_checked_out': 'You already checked out of this shift.',
  'punch_reason_checkin_window_closed': 'Your shift is over; you cannot check in now.',
  'punch_reason_rules_failed': 'A server error happened. Try again.',
  'shift_title': 'Your shift',
  'shift_none': 'No upcoming shift.',
  'shift_time': 'From {from} to {to}',
  'shift_opens': 'Punching opens at {time}',
  'shift_status_pending': 'Not checked in yet',
  'shift_status_on_time': 'Checked in on time',
  'shift_status_late': 'Late by {minutes} minutes',
  'shift_status_out': 'Checked out',
  'my_record': 'My monthly record',
  'my_requests': 'My requests',
  'approvals': 'Approvals',
  'employee_record': 'Employee record',
  'prev_month': 'Previous month',
  'next_month': 'Next month',
  'totals': 'Late: {late} · Absent: {absent} · No check-out: {missing}',
  'kind_off': 'Day off',
  'kind_holiday': 'Public holiday',
  'kind_continued': 'Part of the previous shift',
  'kind_before_hire': 'Before the employee was added',
  'arrival_pending': 'Not in yet',
  'arrival_upcoming': 'Upcoming',
  'arrival_on_time': 'On time',
  'arrival_absent': 'Absent',
  'late_by': 'Late by {minutes} min',
  'early_by': 'Left {minutes} min early',
  'missing_out': 'No check-out',
  'corrected': 'Corrected by request',
  'in_label': 'In',
  'out_label': 'Out',
  'new_request': 'New request',
  'no_requests': 'No requests.',
  'type_punch_correction': 'Punch correction',
  'type_external_mission': 'External mission',
  'status_pending_supervisor': 'Waiting for supervisor',
  'status_pending_hr': 'Waiting for HR',
  'status_approved': 'Approved',
  'status_rejected': 'Rejected',
  'status_cancelled': 'Cancelled',
  'stage_supervisor': 'Supervisor',
  'stage_hr': 'HR',
  'decision_approved': 'approved',
  'decision_rejected': 'rejected',
  'request_details': 'Request details',
  'shift_day': 'Shift day',
  'requested_time': 'Requested time',
  'site': 'Site',
  'reason': 'Reason',
  'submitted_at': 'Submitted',
  'path': 'Approval steps',
  'waiting': 'Waiting for a decision',
  'cancel_request': 'Cancel request',
  'cancel_confirm': 'Cancel this request?',
  'yes': 'Yes',
  'no': 'No',
  'send': 'Send',
  'sent': 'Request sent.',
  'choose_date': 'Choose the day',
  'choose_time': 'Choose the time',
  'choose_site': 'Choose the site',
  'correction_hint': 'For a shift in the last 7 days. Choose check-in or check-out and the correct time.',
  'mission_hint': 'For a site not enabled for you, on one day from today up to 30 days ahead.',
  'no_mission_sites': 'All sites are enabled for you; no mission needed.',
  'note_optional': 'Note (optional)',
  'approve': 'Approve',
  'reject': 'Reject',
  'decided': 'Decision saved.',
  'inbox_empty': 'No requests are waiting for you.',
  'find_employee': 'File number',
  'show': 'Show',
  'employee_not_found': 'No employee with this file number.',
  'punches': 'Punches',
  'no_punches': 'No punches this month.',
  'accepted': 'Accepted',
  'rejected': 'Rejected',
  'photos_hidden': 'Punch photos are visible to supervisors and the system admin only.',
  'req_error_correction_too_old': 'Corrections are allowed for shifts in the last 7 days only.',
  'req_error_time_in_future': 'The chosen time has not come yet.',
  'req_error_no_shift_that_day': 'You have no shift on this day.',
  'req_error_time_outside_shift': 'The time is outside the shift window.',
  'req_error_check_in_first': 'There is no check-in for this day. Request a check-in correction first.',
  'req_error_duplicate_request': 'A similar request is still waiting.',
  'req_error_mission_date_out_of_range': 'The mission date must be from today up to 30 days ahead.',
  'req_error_site_not_found': 'The site does not exist or is not active.',
  'req_error_site_already_enabled': 'This site is already enabled for you.',
  'req_error_reason_required': 'Write the reason (at least 3 letters).',
  'req_error_cannot_cancel': 'This request cannot be cancelled.',
  'req_error_not_allowed': 'You cannot decide this request.',
  'req_error_note_too_long': 'The note is too long.',
  'req_error_generic': 'Something went wrong. Try again.',
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
