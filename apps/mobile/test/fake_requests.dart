import 'package:jahez/requests/requests_service.dart';

/// In-memory stand-in for the requests / record server functions.
class FakeRequests implements RequestsService {
  List<DayRecord> days = [];
  List<RequestItem> mine = [];
  List<RequestItem> inboxItems = [];
  List<TimelineEntry> timelineEntries = [];
  List<SiteOption> sites = const [SiteOption(id: 'site-2', nameAr: 'موقع الشويخ', nameEn: 'Shuwaikh site')];
  List<PunchRow> punchRows = [];
  Map<int, EmployeeRef> employees = {};

  /// When set, the next submit fails with this code.
  String? submitError;
  final submitted = <Map<String, Object?>>[];
  final decisions = <(String, bool, String?)>[];
  final cancelled = <String>[];
  bool? lastWithPhotos;

  @override
  Future<List<DayRecord>> history(String employeeId, DateTime from, DateTime to) async => days;

  @override
  Future<List<RequestItem>> myRequests() async => mine;

  @override
  Future<String> submitCorrection({required DateTime shiftDate, required String punchType, required DateTime time, required String reason}) async {
    final e = submitError;
    if (e != null) {
      submitError = null;
      throw RequestError(e);
    }
    submitted.add({'type': 'punch_correction', 'date': shiftDate, 'punch': punchType, 'time': time, 'reason': reason});
    return 'new-id';
  }

  @override
  Future<String> submitMission({required DateTime date, required String siteId, required String reason}) async {
    submitted.add({'type': 'external_mission', 'date': date, 'site': siteId, 'reason': reason});
    return 'new-id';
  }

  @override
  Future<void> cancel(String requestId) async => cancelled.add(requestId);

  @override
  Future<List<TimelineEntry>> timeline(String requestId) async => timelineEntries;

  @override
  Future<List<SiteOption>> missionSites() async => sites;

  @override
  Future<List<RequestItem>> inbox() async => inboxItems.where((r) => !decisions.any((d) => d.$1 == r.id)).toList();

  @override
  Future<String> decide(String requestId, {required bool approve, String? note}) async {
    decisions.add((requestId, approve, note));
    return approve ? 'pending_hr' : 'rejected';
  }

  @override
  Future<EmployeeRef?> findEmployee(int fileNumber) async => employees[fileNumber];

  @override
  Future<List<PunchRow>> punches(String employeeId, DateTime from, DateTime to, {required bool withPhotos}) async {
    lastWithPhotos = withPhotos;
    return punchRows;
  }
}
