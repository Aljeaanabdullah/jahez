import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// A random id created once per install and kept in the phone's secure storage
/// (Android Keystore / iOS Keychain). Reinstalling the app may create a new id;
/// then the admin unbinds the old phone.
class DeviceIdentity {
  DeviceIdentity({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'jahez_device_id';

  Future<String> id() async {
    final existing = await _storage.read(key: _key);
    if (existing != null && existing.length >= 8) return existing;
    final created = const Uuid().v4();
    await _storage.write(key: _key, value: created);
    return created;
  }

  String get platform => Platform.isIOS ? 'ios' : 'android';

  Future<String> model() async {
    final info = DeviceInfoPlugin();
    if (Platform.isIOS) {
      final ios = await info.iosInfo;
      return ios.utsname.machine;
    }
    final android = await info.androidInfo;
    return '${android.manufacturer} ${android.model}';
  }
}
