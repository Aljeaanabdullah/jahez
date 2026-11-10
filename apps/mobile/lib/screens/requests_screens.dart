import 'package:flutter/material.dart';

import '../l10n.dart';
import '../requests/requests_service.dart';

String _statusText(Strings s, String status) => s.get('status_$status');

Color _statusColor(BuildContext context, String status) {
  final c = Theme.of(context).colorScheme;
  return switch (status) {
    'approved' => Colors.green,
    'rejected' => c.error,
    'cancelled' => c.outline,
    _ => c.primary,
  };
}

/// What the request asks for, in one line.
String requestSummary(Strings s, MaterialLocalizations loc, RequestItem r, bool isArabic) {
  final day = loc.formatMediumDate(r.shiftDate);
  if (r.type == 'punch_correction') {
    final kind = r.punchType == 'check_in' ? s.punchIn : s.punchOut;
    return '$day · $kind ${loc.formatTimeOfDay(TimeOfDay.fromDateTime(r.time!))}';
  }
  return '$day · ${(isArabic ? r.siteAr : r.siteEn) ?? '—'}';
}

/// "My requests": the list, with a button for a new one (Phase 8).
class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key, required this.strings, required this.isArabic, required this.service});
  final Strings strings;
  final bool isArabic;
  final RequestsService service;

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> {
  List<RequestItem>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await widget.service.myRequests();
      if (mounted) setState(() => _items = items);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    }
  }

  Future<void> _open(Widget screen) async {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final loc = MaterialLocalizations.of(context);
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: Text(s.get('my_requests'))),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('newRequest'),
        icon: const Icon(Icons.add),
        label: Text(s.get('new_request')),
        onPressed: () => _open(NewRequestScreen(strings: s, isArabic: widget.isArabic, service: widget.service)),
      ),
      body: items == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
                children: [
                  if (items.isEmpty) Text(s.get('no_requests')),
                  for (final r in items)
                    Card(
                      child: ListTile(
                        title: Text(s.get('type_${r.type}')),
                        subtitle: Text(requestSummary(s, loc, r, widget.isArabic)),
                        trailing: Text(_statusText(s, r.status), style: TextStyle(color: _statusColor(context, r.status))),
                        onTap: () => _open(RequestDetailsScreen(strings: s, isArabic: widget.isArabic, service: widget.service, request: r)),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

/// New request: punch correction (last 7 days) or external mission (today .. +30 days).
class NewRequestScreen extends StatefulWidget {
  const NewRequestScreen({super.key, required this.strings, required this.isArabic, required this.service});
  final Strings strings;
  final bool isArabic;
  final RequestsService service;

  @override
  State<NewRequestScreen> createState() => _NewRequestScreenState();
}

class _NewRequestScreenState extends State<NewRequestScreen> {
  String _type = 'punch_correction';
  String _punchType = 'check_in';
  DateTime? _date;
  TimeOfDay? _time;
  String? _siteId;
  List<SiteOption>? _sites;
  final _reason = TextEditingController();
  String? _error;
  bool _sending = false;

  DateTime get _today => DateUtils.dateOnly(DateTime.now());

  @override
  void initState() {
    super.initState();
    widget.service.missionSites().then((v) {
      if (mounted) setState(() => _sites = v);
    }).catchError((_) {
      if (mounted) setState(() => _sites = const []);
    });
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final correction = _type == 'punch_correction';
    final picked = await showDatePicker(
      context: context,
      firstDate: correction ? _today.subtract(const Duration(days: 7)) : _today,
      lastDate: correction ? _today : _today.add(const Duration(days: 30)),
      initialDate: _date ?? (correction ? _today.subtract(const Duration(days: 1)) : _today),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(context: context, initialTime: _time ?? const TimeOfDay(hour: 7, minute: 0));
    if (picked != null) setState(() => _time = picked);
  }

  Future<void> _send() async {
    final s = widget.strings;
    final reason = _reason.text.trim();
    final correction = _type == 'punch_correction';
    if (_date == null || (correction && _time == null) || (!correction && _siteId == null)) {
      setState(() => _error = s.get('req_error_generic'));
      return;
    }
    if (reason.length < 3) {
      setState(() => _error = s.get('req_error_reason_required'));
      return;
    }
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      if (correction) {
        // The time is on the shift's day; for a night shift, a check-out after midnight is on the next day.
        final sameDay = kuwaitTime(_date!, _time!.hour, _time!.minute);
        try {
          await widget.service.submitCorrection(shiftDate: _date!, punchType: _punchType, time: sameDay, reason: reason);
        } on RequestError catch (e) {
          if (_punchType != 'check_out' || e.code != 'time_outside_shift') rethrow;
          final nextDay = kuwaitTime(_date!.add(const Duration(days: 1)), _time!.hour, _time!.minute);
          await widget.service.submitCorrection(shiftDate: _date!, punchType: _punchType, time: nextDay, reason: reason);
        }
      } else {
        await widget.service.submitMission(date: _date!, siteId: _siteId!, reason: reason);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(s.get('sent'))));
      Navigator.of(context).pop();
    } on RequestError catch (e) {
      setState(() => _error = s.get('req_error_${e.code}'));
    } catch (_) {
      setState(() => _error = s.get('req_error_generic'));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final loc = MaterialLocalizations.of(context);
    final correction = _type == 'punch_correction';
    return Scaffold(
      appBar: AppBar(title: Text(s.get('new_request'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'punch_correction', label: Text(s.get('type_punch_correction'))),
              ButtonSegment(value: 'external_mission', label: Text(s.get('type_external_mission'))),
            ],
            selected: {_type},
            onSelectionChanged: (v) => setState(() {
              _type = v.first;
              _date = null;
              _error = null;
            }),
          ),
          const SizedBox(height: 12),
          Text(s.get(correction ? 'correction_hint' : 'mission_hint'), style: TextStyle(color: Theme.of(context).colorScheme.outline)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            key: const Key('pickDate'),
            icon: const Icon(Icons.event),
            label: Text(_date == null ? s.get('choose_date') : loc.formatFullDate(_date!)),
            onPressed: _pickDate,
          ),
          const SizedBox(height: 12),
          if (correction) ...[
            SegmentedButton<String>(
              segments: [
                ButtonSegment(value: 'check_in', label: Text(s.punchIn)),
                ButtonSegment(value: 'check_out', label: Text(s.punchOut)),
              ],
              selected: {_punchType},
              onSelectionChanged: (v) => setState(() => _punchType = v.first),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: const Key('pickTime'),
              icon: const Icon(Icons.schedule),
              label: Text(_time == null ? s.get('choose_time') : loc.formatTimeOfDay(_time!)),
              onPressed: _pickTime,
            ),
          ] else if (_sites == null)
            const Center(child: CircularProgressIndicator())
          else if (_sites!.isEmpty)
            Text(s.get('no_mission_sites'))
          else
            DropdownButtonFormField<String>(
              key: const Key('pickSite'),
              initialValue: _siteId,
              decoration: InputDecoration(labelText: s.get('choose_site'), border: const OutlineInputBorder()),
              items: [
                for (final site in _sites!)
                  DropdownMenuItem(value: site.id, child: Text(widget.isArabic ? site.nameAr : site.nameEn)),
              ],
              onChanged: (v) => setState(() => _siteId = v),
            ),
          const SizedBox(height: 12),
          TextField(
            key: const Key('reason'),
            controller: _reason,
            maxLength: 1000,
            minLines: 2,
            maxLines: 5,
            decoration: InputDecoration(labelText: s.get('reason'), border: const OutlineInputBorder()),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(_error!, key: const Key('requestError'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ),
          FilledButton(
            key: const Key('sendRequest'),
            onPressed: _sending ? null : _send,
            child: Text(s.get('send')),
          ),
        ],
      ),
    );
  }
}

/// One request: what it asks, its approval steps, and a cancel button while pending.
class RequestDetailsScreen extends StatefulWidget {
  const RequestDetailsScreen({super.key, required this.strings, required this.isArabic, required this.service, required this.request});
  final Strings strings;
  final bool isArabic;
  final RequestsService service;
  final RequestItem request;

  @override
  State<RequestDetailsScreen> createState() => _RequestDetailsScreenState();
}

class _RequestDetailsScreenState extends State<RequestDetailsScreen> {
  List<TimelineEntry>? _timeline;
  late String _status = widget.request.status;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.service.timeline(widget.request.id).then((t) {
      if (mounted) setState(() => _timeline = t);
    }).catchError((_) {
      if (mounted) setState(() => _timeline = const []);
    });
  }

  Future<void> _cancel() async {
    final s = widget.strings;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        content: Text(s.get('cancel_confirm')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: Text(s.get('no'))),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(s.get('yes'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await widget.service.cancel(widget.request.id);
      if (mounted) setState(() => _status = 'cancelled');
    } on RequestError catch (e) {
      if (mounted) setState(() => _error = s.get('req_error_${e.code}'));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final r = widget.request;
    final loc = MaterialLocalizations.of(context);
    String when(DateTime d) => '${loc.formatMediumDate(d)} ${loc.formatTimeOfDay(TimeOfDay.fromDateTime(d))}';
    final pending = _status == 'pending_supervisor' || _status == 'pending_hr';
    return Scaffold(
      appBar: AppBar(title: Text(s.get('request_details'))),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(s.get('type_${r.type}'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(_statusText(s, _status), key: const Key('requestStatus'), style: TextStyle(color: _statusColor(context, _status))),
          const SizedBox(height: 16),
          _row(context, s.get('shift_day'), loc.formatFullDate(r.shiftDate)),
          if (r.type == 'punch_correction')
            _row(context, s.get('requested_time'),
                '${r.punchType == 'check_in' ? s.punchIn : s.punchOut} — ${loc.formatTimeOfDay(TimeOfDay.fromDateTime(r.time!))}')
          else
            _row(context, s.get('site'), (widget.isArabic ? r.siteAr : r.siteEn) ?? '—'),
          _row(context, s.get('reason'), r.reason),
          _row(context, s.get('submitted_at'), when(r.createdAt)),
          const Divider(height: 32),
          Text(s.get('path'), style: Theme.of(context).textTheme.titleMedium),
          if (_timeline == null) const LinearProgressIndicator(),
          for (final t in _timeline ?? const <TimelineEntry>[])
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(t.decision == 'approved' ? Icons.check_circle : Icons.cancel,
                  color: t.decision == 'approved' ? Colors.green : Theme.of(context).colorScheme.error),
              title: Text('${s.get('stage_${t.stage}')}: ${(widget.isArabic ? t.nameAr : t.nameEn) ?? ''} ${s.get('decision_${t.decision}')}'),
              subtitle: Text([when(t.at), if (t.note != null) t.note!].join('\n')),
            ),
          if (pending && _timeline != null)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.hourglass_top),
              title: Text(_statusText(s, _status)),
              subtitle: Text(s.get('waiting')),
            ),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          if (pending) ...[
            const SizedBox(height: 16),
            OutlinedButton.icon(
              key: const Key('cancelRequest'),
              icon: const Icon(Icons.close),
              label: Text(s.get('cancel_request')),
              onPressed: _cancel,
            ),
          ],
        ],
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(width: 120, child: Text(label, style: TextStyle(color: Theme.of(context).colorScheme.outline))),
            Expanded(child: Text(value)),
          ],
        ),
      );
}
