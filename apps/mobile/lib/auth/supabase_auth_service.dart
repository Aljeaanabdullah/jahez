import 'dart:io' show SocketException;

import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import 'auth_service.dart';
import 'device_identity.dart';

class SupabaseAuthService implements AuthService {
  SupabaseAuthService(this._client, {DeviceIdentity? device}) : _device = device ?? DeviceIdentity();

  final SupabaseClient _client;
  final DeviceIdentity _device;

  @override
  Future<Profile?> currentProfile() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;
    final row = await _client
        .from('employees')
        .select('id, file_number, full_name_ar, full_name_en, role, must_change_password, is_active')
        .eq('user_id', user.id)
        .maybeSingle();
    if (row == null || row['is_active'] != true) {
      await _client.auth.signOut();
      return null;
    }
    return Profile(
      id: row['id'] as String,
      fileNumber: row['file_number'] as int,
      nameAr: row['full_name_ar'] as String,
      nameEn: row['full_name_en'] as String,
      role: row['role'] as String,
      mustChangePassword: row['must_change_password'] as bool,
    );
  }

  @override
  Future<Profile> signIn(String fileNumber, String password) async {
    if (!RegExp(r'^\d{6}$').hasMatch(fileNumber)) throw const AuthFailure('invalid_file_number');
    try {
      await _client.auth.signInWithPassword(email: AppConfig.emailFor(fileNumber), password: password);
    } on AuthException {
      throw const AuthFailure('invalid_credentials');
    } on SocketException {
      throw const AuthFailure('no_internet');
    }
    final profile = await currentProfile();
    if (profile == null) throw const AuthFailure('account_disabled');
    return profile;
  }

  @override
  Future<void> changePassword(String newPassword) async {
    try {
      final res = await _client.functions.invoke('change-password', body: {'new_password': newPassword});
      if (res.status != 200) throw const AuthFailure('generic');
    } on FunctionException catch (e) {
      final details = e.details;
      final code = details is Map ? details['error'] as String? : null;
      throw AuthFailure(code ?? 'generic');
    } on SocketException {
      throw const AuthFailure('no_internet');
    }
    // Refresh the session so it reflects the new password.
    await _client.auth.refreshSession();
  }

  @override
  Future<DeviceStatus> bindThisDevice() async {
    final result = await _client.rpc('bind_device', params: {
      'p_device_identifier': await _device.id(),
      'p_platform': _device.platform,
      'p_model': await _device.model(),
    });
    return switch (result as String) {
      'bound' => DeviceStatus.bound,
      'ok' => DeviceStatus.ok,
      'other_device' => DeviceStatus.otherDevice,
      _ => DeviceStatus.deviceTaken,
    };
  }

  @override
  Future<bool> hasConsent() async {
    final profile = await currentProfile();
    if (profile == null) return false;
    final rows = await _client.from('consents').select('id').eq('employee_id', profile.id).limit(1);
    return (rows as List).isNotEmpty;
  }

  @override
  Future<void> giveConsent() async {
    final profile = await currentProfile();
    if (profile == null) throw const AuthFailure('generic');
    await _client.from('consents').insert({'employee_id': profile.id, 'consent_version': consentVersion});
  }

  @override
  Future<void> signOut() => _client.auth.signOut();
}
