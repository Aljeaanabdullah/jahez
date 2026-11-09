import 'package:flutter/material.dart';

import '../l10n.dart';

/// Shown once, before anything else, until the employee accepts.
class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key, required this.strings, required this.onAccept, required this.onSignOut});

  final Strings strings;
  final Future<void> Function() onAccept;
  final VoidCallback onSignOut;

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool _busy = false;
  bool _failed = false;

  Future<void> _accept() async {
    setState(() {
      _busy = true;
      _failed = false;
    });
    try {
      await widget.onAccept();
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.strings;
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(title: Text(s.consentTitle), automaticallyImplyLeading: false),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(24),
            children: [
              const Icon(Icons.verified_user_outlined, size: 56),
              const SizedBox(height: 16),
              Text(s.consentBody, key: const Key('consentBody'), style: Theme.of(context).textTheme.bodyLarge),
              if (_failed) ...[
                const SizedBox(height: 16),
                Text(s.error('generic'), style: TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 32),
              FilledButton(
                key: const Key('acceptConsent'),
                onPressed: _busy ? null : _accept,
                child: Padding(padding: const EdgeInsets.all(12), child: Text(s.consentAccept)),
              ),
              const SizedBox(height: 12),
              TextButton(onPressed: widget.onSignOut, child: Text(s.signOut)),
            ],
          ),
        ),
      ),
    );
  }
}
