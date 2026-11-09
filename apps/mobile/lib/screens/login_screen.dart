import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../auth/auth_service.dart';
import '../l10n.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.strings, required this.auth, required this.onSignedIn});

  final Strings strings;
  final AuthService auth;
  final Future<void> Function(Profile profile) onSignedIn;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _fileNumber = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _fileNumber.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final profile = await widget.auth.signIn(_fileNumber.text.trim(), _password.text);
      await widget.onSignedIn(profile);
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
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: AutofillGroup(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    s.appName,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 40, fontWeight: FontWeight.bold, color: colors.primary),
                  ),
                  const SizedBox(height: 32),
                  TextField(
                    key: const Key('fileNumber'),
                    controller: _fileNumber,
                    keyboardType: TextInputType.number,
                    textDirection: TextDirection.ltr,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    autofillHints: const [AutofillHints.username],
                    decoration: InputDecoration(labelText: s.fileNumber, border: const OutlineInputBorder()),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    key: const Key('password'),
                    controller: _password,
                    obscureText: true,
                    textDirection: TextDirection.ltr,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _busy ? null : _submit(),
                    decoration: InputDecoration(labelText: s.password, border: const OutlineInputBorder()),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(s.error(_error!), key: const Key('error'), style: TextStyle(color: colors.error)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton(
                    key: const Key('signIn'),
                    onPressed: _busy ? null : _submit,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: _busy
                          ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(s.signIn),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
