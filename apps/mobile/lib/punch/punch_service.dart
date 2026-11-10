import 'package:supabase_flutter/supabase_flutter.dart';

import '../auth/device_identity.dart';
import '../face/face_model.dart';

class PunchResult {
  const PunchResult({
    required this.accepted,
    required this.reason,
    required this.punchType,
    required this.punchedAt,
    this.siteAr,
    this.siteEn,
    this.distanceM,
    this.unlockAt,
  });

  final bool accepted;

  /// Refusal reason code (matches `punch_<code>` texts), or null when accepted.
  final String? reason;
  final String punchType; // check_in | check_out
  final DateTime punchedAt;
  final String? siteAr;
  final String? siteEn;
  final int? distanceM;
  final DateTime? unlockAt;
}

class PunchEntry {
  const PunchEntry({required this.type, required this.at, required this.accepted, this.reason});
  final String type;
  final DateTime at;
  final bool accepted;
  final String? reason;
}

abstract class PunchService {
  Future<PunchResult> punch({
    required double lat,
    required double lng,
    required double accuracy,
    required Map<String, dynamic> report,
    required List<double> descriptor,
    required String photoBase64,
  });

  /// Today's attempts for the signed-in employee, newest first.
  Future<List<PunchEntry>> today();
}

class SupabasePunchService implements PunchService {
  SupabasePunchService(this._client, {DeviceIdentity? device}) : _device = device ?? DeviceIdentity();

  final SupabaseClient _client;
  final DeviceIdentity _device;

  @override
  Future<PunchResult> punch({
    required double lat,
    required double lng,
    required double accuracy,
    required Map<String, dynamic> report,
    required List<double> descriptor,
    required String photoBase64,
  }) async {
    try {
      final res = await _client.functions.invoke('punch', body: {
        'device_identifier': await _device.id(),
        'location': {'lat': lat, 'lng': lng, 'accuracy': accuracy},
        'report': report,
        'descriptor': descriptor,
        'model_version': faceModelVersion,
        'photo': photoBase64,
      });
      final b = res.data as Map<String, dynamic>;
      final site = b['site'] as Map<String, dynamic>?;
      return PunchResult(
        accepted: b['result'] == 'accepted',
        reason: b['reason'] as String?,
        punchType: b['punch_type'] as String,
        punchedAt: DateTime.parse(b['punched_at'] as String),
        siteAr: site?['name_ar'] as String?,
        siteEn: site?['name_en'] as String?,
        distanceM: (b['distance_m'] as num?)?.toInt(),
      );
    } on FunctionException catch (e) {
      final d = e.details;
      final code = d is Map ? d['error'] as String? : null;
      return PunchResult(
        accepted: false,
        reason: code ?? 'generic',
        punchType: 'check_in',
        punchedAt: DateTime.now(),
        unlockAt: d is Map && d['unlock_at'] is String ? DateTime.parse(d['unlock_at'] as String) : null,
      );
    }
  }

  @override
  Future<List<PunchEntry>> today() async {
    final user = _client.auth.currentUser;
    if (user == null) return [];
    final me = await _client.from('employees').select('id').eq('user_id', user.id).single();
    final start = DateTime.now().toUtc().subtract(const Duration(hours: 24));
    final rows = await _client
        .from('attendance_punches')
        .select('punch_type, punched_at, result, reject_reason')
        .eq('employee_id', me['id'] as String)
        .gte('punched_at', start.toIso8601String())
        .order('punched_at', ascending: false)
        .limit(20);
    return (rows as List)
        .map((r) => PunchEntry(
              type: r['punch_type'] as String,
              at: DateTime.parse(r['punched_at'] as String).toLocal(),
              accepted: r['result'] == 'accepted',
              reason: r['reject_reason'] as String?,
            ))
        .toList();
  }
}
