import 'package:flutter/material.dart';

import '../l10n.dart';
import '../requests/requests_service.dart';

/// One month of attendance, day by day, with month navigation (Phase 8).
/// Employees see their own; supervisors / HR / admin see anyone's, with punches
/// (photos only for supervisors and the admin, PRD 4.4).
class MonthRecordScreen extends StatefulWidget {
  const MonthRecordScreen({
    super.key,
    required this.strings,
    required this.isArabic,
    required this.service,
    required this.employeeId,
    required this.title,
    this.showPunches = false,
    this.withPhotos = false,
  });

  final Strings strings;
  final bool isArabic;
  final RequestsService service;
  final String employeeId;
  final String title;
  final bool showPunches;
  final bool withPhotos;

  @override
  State<MonthRecordScreen> createState() => _MonthRecordScreenState();
}

class _MonthRecordScreenState extends State<MonthRecordScreen> {
  late DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  List<DayRecord>? _days;
  List<PunchRow>? _punches;
  String? _error;

  bool get _isCurrent => _month.year == DateTime.now().year && _month.month == DateTime.now().month;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _days = null;
      _punches = null;
      _error = null;
    });
    final from = _month;
    final to = DateTime(_month.year, _month.month + 1, 0);
    try {
      final days = await widget.service.history(widget.employeeId, from, to);
      final punches = widget.showPunches
          ? await widget.service.punches(widget.employeeId, from, to, withPhotos: widget.withPhotos)
          : const <PunchRow>[];
      if (mounted) {
        setState(() {
          _days = days.reversed.toList();
          _punches = punches;
        });
      }
    } on RequestError catch (e) {
      if (mounted) setState(() => _error = widget.strings.get('req_error_${e.code}'));
    } catch (_) {
      if (mounted) setState(() => _error = widget.strings.get('req_error_generic'));
    }
  }

  void _go(int by) {
    _month = DateTime(_month.year, _month.month + by);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final loc = MaterialLocalizations.of(context);
    final colors = Theme.of(context).colorScheme;
    String hm(DateTime? d) => d == null ? '—' : loc.formatTimeOfDay(TimeOfDay.fromDateTime(d));
    final days = _days;
    final late = days?.where((d) => d.arrival == 'late').length ?? 0;
    final absent = days?.where((d) => d.arrival == 'absent').length ?? 0;
    final missing = days?.where((d) => d.departure == 'missing').length ?? 0;

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                IconButton(
                  key: const Key('prevMonth'),
                  tooltip: s.get('prev_month'),
                  icon: Icon(widget.isArabic ? Icons.chevron_right : Icons.chevron_left),
                  onPressed: () => _go(-1),
                ),
                Expanded(
                  child: Text(loc.formatMonthYear(_month), textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
                ),
                IconButton(
                  key: const Key('nextMonth'),
                  tooltip: s.get('next_month'),
                  icon: Icon(widget.isArabic ? Icons.chevron_left : Icons.chevron_right),
                  onPressed: _isCurrent ? null : () => _go(1),
                ),
              ],
            ),
            if (_error != null) Text(_error!, style: TextStyle(color: colors.error)),
            if (days == null && _error == null) const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator())),
            if (days != null) ...[
              Text(s.fill('totals', {'late': late, 'absent': absent, 'missing': missing}), key: const Key('monthTotals')),
              const SizedBox(height: 8),
              for (final d in days) _DayTile(day: d, strings: s, hm: hm, loc: loc),
            ],
            if (widget.showPunches && _punches != null) ...[
              const Divider(height: 32),
              Text(s.get('punches'), style: Theme.of(context).textTheme.titleMedium),
              if (!widget.withPhotos) Text(s.get('photos_hidden'), style: TextStyle(color: colors.outline)),
              if (_punches!.isEmpty) Text(s.get('no_punches'), style: TextStyle(color: colors.outline)),
              for (final p in _punches!)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: p.photoUrl != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: Image.network(p.photoUrl!, width: 48, height: 48, fit: BoxFit.cover),
                        )
                      : Icon(p.accepted ? Icons.check_circle : Icons.cancel, color: p.accepted ? Colors.green : colors.error),
                  title: Text('${p.type == 'check_in' ? s.punchIn : s.punchOut} · ${loc.formatShortDate(p.at)} ${hm(p.at)}'),
                  subtitle: Text([
                    p.accepted ? s.get('accepted') : '${s.get('rejected')}: ${s.punchReason(p.reason ?? 'generic')}',
                    if (p.corrected) s.get('corrected'),
                    if ((widget.isArabic ? p.siteAr : p.siteEn) != null) (widget.isArabic ? p.siteAr : p.siteEn)!,
                  ].join(' · ')),
                ),
            ],
          ],
        ),
      ),
    );
  }
}

class _DayTile extends StatelessWidget {
  const _DayTile({required this.day, required this.strings, required this.hm, required this.loc});
  final DayRecord day;
  final Strings strings;
  final String Function(DateTime?) hm;
  final MaterialLocalizations loc;

  @override
  Widget build(BuildContext context) {
    final s = strings;
    final colors = Theme.of(context).colorScheme;
    final notes = <(String, bool)>[];
    if (day.kind != 'work') {
      notes.add((s.get('kind_${day.kind}'), false));
    } else if (day.arrival == 'late') {
      notes.add((s.fill('late_by', {'minutes': day.lateMinutes}), true));
    } else if (day.arrival == 'pending' && day.shiftStart != null && day.shiftStart!.isAfter(DateTime.now())) {
      notes.add((s.get('arrival_upcoming'), false));
    } else if (day.arrival != null) {
      notes.add((s.get('arrival_${day.arrival}'), day.arrival == 'absent'));
    }
    if (day.departure == 'missing') notes.add((s.get('missing_out'), true));
    if (day.earlyLeaveMinutes > 0) notes.add((s.fill('early_by', {'minutes': day.earlyLeaveMinutes}), false));
    final work = day.kind == 'work';
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: ListTile(
        dense: true,
        title: Text(loc.formatFullDate(day.day), style: TextStyle(color: work ? null : colors.outline)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (work)
              Text(
                '${s.get('in_label')}: ${hm(day.checkIn)}${day.checkInCorrected ? ' (${s.get('corrected')})' : ''}'
                '   ${s.get('out_label')}: ${hm(day.checkOut)}${day.checkOutCorrected ? ' (${s.get('corrected')})' : ''}',
              ),
            for (final (text, bad) in notes) Text(text, style: TextStyle(color: bad ? colors.error : null)),
          ],
        ),
      ),
    );
  }
}
