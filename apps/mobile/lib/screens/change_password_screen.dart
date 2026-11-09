import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../l10n.dart';

/// Forced on first sign-in. There is no "skip" or back button.
class ChangePasswordScreen extends StatefulWidget {
  const ChangePasswordScreen({
    super.key,
    required this.strings,
    required this.auth,
    required this.fileNumber,
    required this.onChanged,
  });

  final Strings strings;
  final AuthService auth;
  final int fileNumber;
  final VoidCallback onChanged;

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final problem = _new.text != _confirm.text ? 'mismatch' : passwordProblem(_new.text, widget.fileNumber);
    if (problem != null) {
      setState(() => _error = problem);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.changePassword(_new.text);
      widget.onChanged();
    } on AuthFailure catch (e) {
      if (mounted) setState(() => _error = e.code);
    } catch (_) {
      if (mounted) setState(() => _error = 'generic');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    final colors = Theme.of(context).colorScheme;
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(title: Text(s.changePasswordTitle), automaticallyImplyLeading: false),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(s.changePasswordIntro),
              const SizedBox(height: 24),
              TextField(
                key: const Key('newPassword'),
                controller: _new,
                obscureText: true,
                textDirection: TextDirection.ltr,
                autofillHints: const [AutofillHints.newPassword],
                decoration: InputDecoration(labelText: s.newPassword, border: const OutlineInputBorder()),
              ),
              const SizedBox(height: 16),
              TextField(
                key: const Key('confirmPassword'),
                controller: _confirm,
                obscureText: true,
                textDirection: TextDirection.ltr,
                decoration: InputDecoration(labelText: s.confirmPassword, border: const OutlineInputBorder()),
              ),
              const SizedBox(height: 8),
              Text(s.passwordRules, style: Theme.of(context).textTheme.bodySmall),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(s.error(_error!), key: const Key('error'), style: TextStyle(color: colors.error)),
              ],
              const SizedBox(height: 24),
              FilledButton(
                key: const Key('save'),
                onPressed: _busy ? null : _submit,
                child: Padding(padding: const EdgeInsets.all(12), child: Text(s.save)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
