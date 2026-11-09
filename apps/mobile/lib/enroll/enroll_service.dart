import 'package:supabase_flutter/supabase_flutter.dart';

import '../face/face_model.dart';

/// Employee as HR sees it on the enrollment screen.
class EnrollTarget {
  const EnrollTarget({
    required this.id,
    required this.fileNumber,
    required this.nameAr,
    required this.nameEn,
    required this.isActive,
    required this.hasLogin,
    required this.hasConsent,
    required this.enrolled,
  });

  final String id;
  final int fileNumber;
  final String nameAr;
  final String nameEn;
  final bool isActive;
  final bool hasLogin;
  final bool hasConsent;
  final bool enrolled;
}

class EnrollFailure implements Exception {
  const EnrollFailure(this.code, {this.fileNumber});

  /// Matches an `enroll_<code>` text in l10n.dart.
  final String code;
  final int? fileNumber;
}

abstract class EnrollService {
  Future<EnrollTarget?> find(int fileNumber);
  Future<void> enroll(String employeeId, List<String> photos, List<List<double>> descriptors);
}

class SupabaseEnrollService implements EnrollService {
  SupabaseEnrollService(this._client);

  final SupabaseClient _client;

  @override
  Future<EnrollTarget?> find(int fileNumber) async {
    final row = await _client
        .from('employees')
        .select('id, file_number, full_name_ar, full_name_en, is_active, user_id')
        .eq('file_number', fileNumber)
        .maybeSingle();
    if (row == null) return null;
    final status = await _client.rpc('face_enrollment_status', params: {'p_employee_id': row['id']}) as List;
    final s = status.isEmpty ? <String, dynamic>{} : status.first as Map<String, dynamic>;
    return EnrollTarget(
      id: row['id'] as String,
      fileNumber: row['file_number'] as int,
      nameAr: row['full_name_ar'] as String,
      nameEn: row['full_name_en'] as String,
      isActive: row['is_active'] as bool,
      hasLogin: row['user_id'] != null,
      hasConsent: s['has_consent'] == true,
      enrolled: s['enrolled'] == true,
    );
  }

  @override
  Future<void> enroll(String employeeId, List<String> photos, List<List<double>> descriptors) async {
    try {
      await _client.functions.invoke('enroll-face', body: {
        'employee_id': employeeId,
        'source': 'mobile',
        'model_version': faceModelVersion,
        'photos': photos,
        'descriptors': descriptors,
      });
    } on FunctionException catch (e) {
      final details = e.details;
      if (details is Map) {
        throw EnrollFailure(details['error'] as String? ?? 'generic', fileNumber: details['file_number'] as int?);
      }
      throw const EnrollFailure('generic');
    }
  }
}
