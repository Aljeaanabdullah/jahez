import 'package:flutter/material.dart';

import '../l10n.dart';

/// Shown when the account is bound to another phone, or this phone belongs to someone else.
class DeviceBlockedScreen extends StatelessWidget {
  const DeviceBlockedScreen({super.key, required this.strings, required this.code, required this.onSignOut});

  final Strings strings;
  final String code;
  final VoidCallback onSignOut;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.phonelink_lock, size: 72, color: colors.error),
              const SizedBox(height: 16),
              Text(
                strings.deviceBlockedTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(strings.error(code), key: const Key('blockedReason'), textAlign: TextAlign.center),
              const SizedBox(height: 32),
              OutlinedButton(onPressed: onSignOut, child: Text(strings.signOut)),
            ],
          ),
        ),
      ),
    );
  }
}
