import 'package:flutter/material.dart';

import '../l10n.dart';
import '../requests/requests_service.dart';
import 'month_record_screen.dart';
import 'requests_screens.dart';

/// Supervisor / HR / admin: requests waiting for my decision (Phase 8).
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key, required this.strings, required this.isArabic, required this.service});
  final Strings strings;
  final bool isArabic;
  final RequestsService service;

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  List<RequestItem>? _items;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final items = await widget.service.inbox();
      if (mounted) setState(() => _items = items);
    } catch (_) {
      if (mounted) setState(() => _items = const []);
    }
  }

  Future<void> _decide(RequestItem r, bool approve) async {
    final s = widget.strings;
    // null = cancelled; otherwise the (possibly empty) note.
    final text = await showDialog<String>(
      context: context,
      builder: (_) => _NoteDialog(strings: s, approve: approve),
    );
    if (text == null || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.service.decide(r.id, approve: approve, note: text);
      messenger.showSnackBar(SnackBar(content: Text(s.get('decided'))));
    } on RequestError catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(s.get('req_error_${e.code}'))));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(s.get('req_error_generic'))));
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final loc = MaterialLocalizations.of(context);
    final items = _items;
    return Scaffold(
      appBar: AppBar(title: Text(s.get('approvals'))),
      body: items == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (items.isEmpty) Text(s.get('inbox_empty'), key: const Key('inboxEmpty')),
                  for (final r in items)
                    Card(
                      key: Key('inbox-${r.id}'),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${s.get('type_${r.type}')} · ${s.get('status_${r.status}')}',
                                style: Theme.of(context).textTheme.titleMedium),
                            Text('${(widget.isArabic ? r.employeeNameAr : r.employeeNameEn) ?? ''} · ${r.fileNumber ?? ''}'
                                '${(widget.isArabic ? r.departmentAr : r.departmentEn) != null ? ' · ${widget.isArabic ? r.departmentAr : r.departmentEn}' : ''}'),
                            const SizedBox(height: 4),
                            Text(requestSummary(s, loc, r, widget.isArabic)),
                            Text('${s.get('reason')}: ${r.reason}'),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                FilledButton(key: Key('approve-${r.id}'), onPressed: () => _decide(r, true), child: Text(s.get('approve'))),
                                const SizedBox(width: 8),
                                OutlinedButton(key: Key('reject-${r.id}'), onPressed: () => _decide(r, false), child: Text(s.get('reject'))),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

/// Supervisor / HR / admin: open any employee's monthly record by file number.
class EmployeeLookupScreen extends StatefulWidget {
  const EmployeeLookupScreen({super.key, required this.strings, required this.isArabic, required this.service, required this.withPhotos});
  final Strings strings;
  final bool isArabic;
  final RequestsService service;
  final bool withPhotos;

  @override
  State<EmployeeLookupScreen> createState() => _EmployeeLookupScreenState();
}

class _EmployeeLookupScreenState extends State<EmployeeLookupScreen> {
  final _file = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _file.dispose();
    super.dispose();
  }

  Future<void> _find() async {
    final s = widget.strings;
    final n = int.tryParse(_file.text.trim());
    final emp = n == null ? null : await widget.service.findEmployee(n).catchError((_) => null);
    if (!mounted) return;
    if (emp == null) {
      setState(() => _error = s.get('employee_not_found'));
      return;
    }
    setState(() => _error = null);
    await Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => MonthRecordScreen(
        strings: s,
        isArabic: widget.isArabic,
        service: widget.service,
        employeeId: emp.id,
        title: '${widget.isArabic ? emp.nameAr : emp.nameEn} · ${emp.fileNumber}',
        showPunches: true,
        withPhotos: widget.withPhotos,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    return Scaffold(
      appBar: AppBar(title: Text(s.get('employee_record'))),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            key: const Key('lookupFile'),
            controller: _file,
            keyboardType: TextInputType.number,
            textDirection: TextDirection.ltr,
            maxLength: 6,
            decoration: InputDecoration(labelText: s.get('find_employee'), border: const OutlineInputBorder()),
            onSubmitted: (_) => _find(),
          ),
          if (_error != null) Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          const SizedBox(height: 12),
          FilledButton(key: const Key('lookupShow'), onPressed: _find, child: Text(s.get('show'))),
        ],
      ),
    );
  }
}

/// Asks for an optional note; returns it, or null when cancelled. Owns (and disposes) its text field.
class _NoteDialog extends StatefulWidget {
  const _NoteDialog({required this.strings, required this.approve});
  final Strings strings;
  final bool approve;

  @override
  State<_NoteDialog> createState() => _NoteDialogState();
}

class _NoteDialogState extends State<_NoteDialog> {
  final _note = TextEditingController();

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final label = s.get(widget.approve ? 'approve' : 'reject');
    return AlertDialog(
      title: Text(label),
      content: TextField(
        key: const Key('decisionNote'),
        controller: _note,
        maxLength: 1000,
        decoration: InputDecoration(labelText: s.get('note_optional')),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: Text(s.get('no'))),
        FilledButton(key: const Key('confirmDecision'), onPressed: () => Navigator.pop(context, _note.text), child: Text(label)),
      ],
    );
  }
}
