import 'package:supabase_flutter/supabase_flutter.dart';

/// One day of the attendance record (server rules engine, Phase 7).
class DayRecord {
  const DayRecord({
    required this.day,
    required this.kind,
    this.shiftStart,
    this.shiftEnd,
    this.arrival,
    this.departure,
    this.checkIn,
    this.checkOut,
    this.lateMinutes = 0,
    this.earlyLeaveMinutes = 0,
    this.checkInCorrected = false,
    this.checkOutCorrected = false,
  });

  final DateTime day; // calendar date (no time)
  final String kind; // work | continued | holiday | off | before_hire
  final DateTime? shiftStart;
  final DateTime? shiftEnd;
  final String? arrival; // pending | on_time | late | absent
  final String? departure; // pending | done | missing | not_applicable
  final DateTime? checkIn;
  final DateTime? checkOut;
  final int lateMinutes;
  final int earlyLeaveMinutes;
  final bool checkInCorrected;
  final bool checkOutCorrected;

  factory DayRecord.fromRow(Map<String, dynamic> r) {
    DateTime? t(String k) => r[k] == null ? null : DateTime.parse(r[k] as String).toLocal();
    return DayRecord(
      day: DateTime.parse(r['day'] as String),
      kind: r['kind'] as String,
      shiftStart: t('shift_start'),
      shiftEnd: t('shift_end'),
      arrival: r['arrival'] as String?,
      departure: r['departure'] as String?,
      checkIn: t('check_in_at'),
      checkOut: t('check_out_at'),
      lateMinutes: (r['late_minutes'] as num? ?? 0).toInt(),
      earlyLeaveMinutes: (r['early_leave_minutes'] as num? ?? 0).toInt(),
      checkInCorrected: r['check_in_corrected'] == true,
      checkOutCorrected: r['check_out_corrected'] == true,
    );
  }
}

/// A punch correction or external mission request.
class RequestItem {
  const RequestItem({
    required this.id,
    required this.type,
    required this.status,
    required this.shiftDate,
    required this.reason,
    required this.createdAt,
    this.punchType,
    this.time,
    this.siteAr,
    this.siteEn,
    this.employeeNameAr,
    this.employeeNameEn,
    this.fileNumber,
    this.departmentAr,
    this.departmentEn,
  });

  final String id;
  final String type; // punch_correction | external_mission
  final String status; // pending_supervisor | pending_hr | approved | rejected | cancelled
  final DateTime shiftDate;
  final String reason;
  final DateTime createdAt;
  final String? punchType;
  final DateTime? time;
  final String? siteAr;
  final String? siteEn;
  // In the approvals inbox only:
  final String? employeeNameAr;
  final String? employeeNameEn;
  final int? fileNumber;
  final String? departmentAr;
  final String? departmentEn;

  bool get isPending => status == 'pending_supervisor' || status == 'pending_hr';
}

class TimelineEntry {
  const TimelineEntry({required this.stage, required this.decision, required this.at, this.note, this.nameAr, this.nameEn});
  final String stage; // supervisor | hr
  final String decision; // approved | rejected
  final DateTime at;
  final String? note;
  final String? nameAr;
  final String? nameEn;
}

class SiteOption {
  const SiteOption({required this.id, required this.nameAr, required this.nameEn});
  final String id;
  final String nameAr;
  final String nameEn;
}

class EmployeeRef {
  const EmployeeRef({required this.id, required this.fileNumber, required this.nameAr, required this.nameEn});
  final String id;
  final int fileNumber;
  final String nameAr;
  final String nameEn;
}

class PunchRow {
  const PunchRow({
    required this.at,
    required this.type,
    required this.accepted,
    this.reason,
    this.corrected = false,
    this.siteAr,
    this.siteEn,
    this.photoUrl,
  });
  final DateTime at;
  final String type;
  final bool accepted;
  final String? reason;
  final bool corrected;
  final String? siteAr;
  final String? siteEn;
  final String? photoUrl;
}

/// A refusal from the server, with a code that has a text in `l10n.dart` (`req_error_<code>`).
class RequestError implements Exception {
  const RequestError(this.code);
  final String code;
  @override
  String toString() => 'RequestError($code)';
}

/// "YYYY-MM-DD" of a calendar date.
String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Kuwait wall-clock time on a calendar date, as an instant (Kuwait is UTC+3, no daylight saving).
DateTime kuwaitTime(DateTime day, int hour, int minute) =>
    DateTime.utc(day.year, day.month, day.day, hour, minute).subtract(const Duration(hours: 3));

abstract class RequestsService {
  Future<List<DayRecord>> history(String employeeId, DateTime from, DateTime to);
  Future<List<RequestItem>> myRequests();
  Future<String> submitCorrection({required DateTime shiftDate, required String punchType, required DateTime time, required String reason});
  Future<String> submitMission({required DateTime date, required String siteId, required String reason});
  Future<void> cancel(String requestId);
  Future<List<TimelineEntry>> timeline(String requestId);
  Future<List<SiteOption>> missionSites();

  // Supervisor / HR / admin
  Future<List<RequestItem>> inbox();
  Future<String> decide(String requestId, {required bool approve, String? note});
  Future<EmployeeRef?> findEmployee(int fileNumber);
  Future<List<PunchRow>> punches(String employeeId, DateTime from, DateTime to, {required bool withPhotos});
}

class SupabaseRequestsService implements RequestsService {
  SupabaseRequestsService(this._client);
  final SupabaseClient _client;

  static const _known = [
    'correction_too_old', 'time_in_future', 'no_shift_that_day', 'time_outside_shift', 'check_in_first',
    'duplicate_request', 'mission_date_out_of_range', 'site_not_found', 'site_already_enabled', 'reason_required',
    'cannot_cancel', 'not_allowed', 'note_too_long',
  ];

  Future<T> _call<T>(Future<T> Function() f) async {
    try {
      return await f();
    } on PostgrestException catch (e) {
      throw RequestError(_known.firstWhere((k) => e.message.contains(k), orElse: () => 'generic'));
    }
  }

  @override
  Future<List<DayRecord>> history(String employeeId, DateTime from, DateTime to) => _call(() async {
        final rows = await _client.rpc('attendance_history', params: {'p_employee': employeeId, 'p_from': ymd(from), 'p_to': ymd(to)}) as List;
        return rows.map((r) => DayRecord.fromRow(r as Map<String, dynamic>)).toList();
      });

  RequestItem _item(Map<String, dynamic> r) {
    final site = r['sites'] as Map<String, dynamic>?;
    return RequestItem(
      id: r['id'] as String,
      type: r['request_type'] as String,
      status: r['status'] as String,
      shiftDate: DateTime.parse(r['shift_date'] as String),
      reason: r['reason'] as String,
      createdAt: DateTime.parse(r['created_at'] as String).toLocal(),
      punchType: r['corrected_punch_type'] as String?,
      time: r['corrected_time'] == null ? null : DateTime.parse(r['corrected_time'] as String).toLocal(),
      siteAr: (site?['name_ar'] ?? r['site_ar']) as String?,
      siteEn: (site?['name_en'] ?? r['site_en']) as String?,
      employeeNameAr: r['full_name_ar'] as String?,
      employeeNameEn: r['full_name_en'] as String?,
      fileNumber: r['file_number'] as int?,
      departmentAr: r['department_ar'] as String?,
      departmentEn: r['department_en'] as String?,
    );
  }

  @override
  Future<List<RequestItem>> myRequests() => _call(() async {
        final user = _client.auth.currentUser;
        if (user == null) return <RequestItem>[];
        final me = await _client.from('employees').select('id').eq('user_id', user.id).single();
        final rows = await _client
            .from('requests')
            .select('id, request_type, status, shift_date, corrected_punch_type, corrected_time, reason, created_at, sites(name_ar, name_en)')
            .eq('employee_id', me['id'] as String)
            .order('created_at', ascending: false)
            .limit(100);
        return (rows as List).map((r) => _item(r as Map<String, dynamic>)).toList();
      });

  @override
  Future<String> submitCorrection({required DateTime shiftDate, required String punchType, required DateTime time, required String reason}) =>
      _call(() async => await _client.rpc('submit_request', params: {
            'p_type': 'punch_correction',
            'p_shift_date': ymd(shiftDate),
            'p_reason': reason,
            'p_punch_type': punchType,
            'p_time': time.toUtc().toIso8601String(),
          }) as String);

  @override
  Future<String> submitMission({required DateTime date, required String siteId, required String reason}) =>
      _call(() async => await _client.rpc('submit_request', params: {
            'p_type': 'external_mission',
            'p_shift_date': ymd(date),
            'p_reason': reason,
            'p_site': siteId,
          }) as String);

  @override
  Future<void> cancel(String requestId) => _call(() => _client.rpc('cancel_request', params: {'p_request': requestId}));

  @override
  Future<List<TimelineEntry>> timeline(String requestId) => _call(() async {
        final rows = await _client.rpc('request_timeline', params: {'p_request': requestId}) as List;
        return rows.map((x) {
          final r = x as Map<String, dynamic>;
          return TimelineEntry(
            stage: r['stage'] as String,
            decision: r['decision'] as String,
            at: DateTime.parse(r['decided_at'] as String).toLocal(),
            note: r['note'] as String?,
            nameAr: r['approver_ar'] as String?,
            nameEn: r['approver_en'] as String?,
          );
        }).toList();
      });

  @override
  Future<List<SiteOption>> missionSites() => _call(() async {
        final user = _client.auth.currentUser;
        if (user == null) return <SiteOption>[];
        final me = await _client.from('employees').select('id').eq('user_id', user.id).single();
        final enabled = await _client.from('employee_sites').select('site_id').eq('employee_id', me['id'] as String);
        final ids = {for (final r in enabled as List) r['site_id'] as String};
        final sites = await _client.from('sites').select('id, name_ar, name_en').eq('is_active', true).order('name_ar');
        return (sites as List)
            .where((s) => !ids.contains(s['id']))
            .map((s) => SiteOption(id: s['id'] as String, nameAr: s['name_ar'] as String, nameEn: s['name_en'] as String))
            .toList();
      });

  @override
  Future<List<RequestItem>> inbox() => _call(() async {
        final rows = await _client.rpc('approval_inbox') as List;
        return rows.map((r) => _item(r as Map<String, dynamic>)).toList();
      });

  @override
  Future<String> decide(String requestId, {required bool approve, String? note}) => _call(() async => await _client.rpc(
        'decide_request',
        params: {'p_request': requestId, 'p_approve': approve, 'p_note': (note ?? '').trim().isEmpty ? null : note!.trim()},
      ) as String);

  @override
  Future<EmployeeRef?> findEmployee(int fileNumber) => _call(() async {
        final r = await _client.from('employees').select('id, file_number, full_name_ar, full_name_en').eq('file_number', fileNumber).maybeSingle();
        if (r == null) return null;
        return EmployeeRef(id: r['id'] as String, fileNumber: r['file_number'] as int, nameAr: r['full_name_ar'] as String, nameEn: r['full_name_en'] as String);
      });

  @override
  Future<List<PunchRow>> punches(String employeeId, DateTime from, DateTime to, {required bool withPhotos}) => _call(() async {
        final rows = await _client
            .from('attendance_punches')
            .select('punch_type, punched_at, result, reject_reason, source, photo_path, sites(name_ar, name_en)')
            .eq('employee_id', employeeId)
            .gte('punched_at', kuwaitTime(from, 0, 0).toIso8601String())
            .lt('punched_at', kuwaitTime(to.add(const Duration(days: 1)), 0, 0).toIso8601String())
            .order('punched_at', ascending: false) as List;
        final paths = withPhotos ? rows.map((r) => r['photo_path'] as String?).whereType<String>().toList() : <String>[];
        final urls = <String, String>{};
        if (paths.isNotEmpty) {
          final signed = await _client.storage.from('punch-photos').createSignedUrlsResult(paths, 300);
          for (final s in signed.whereType<SignedUrlSuccess>()) {
            urls[s.path] = s.signedUrl;
          }
        }
        return rows.map((x) {
          final r = x as Map<String, dynamic>;
          final site = r['sites'] as Map<String, dynamic>?;
          return PunchRow(
            at: DateTime.parse(r['punched_at'] as String).toLocal(),
            type: r['punch_type'] as String,
            accepted: r['result'] == 'accepted',
            reason: r['reject_reason'] as String?,
            corrected: r['source'] == 'correction',
            siteAr: site?['name_ar'] as String?,
            siteEn: site?['name_en'] as String?,
            photoUrl: urls[r['photo_path']],
          );
        }).toList();
      });
}
