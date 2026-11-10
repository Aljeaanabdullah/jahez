import 'dart:io';

import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

/// What the phone reports about itself before a punch. The server refuses the punch
/// when any of these is set; the app also stops early with a clear message.
class PhoneReport {
  const PhoneReport({
    required this.vpn,
    required this.rooted,
    required this.mockLocation,
    required this.position,
  });

  final bool vpn;
  final bool rooted;
  final bool mockLocation;
  final Position? position;

  /// First problem to show the employee, or null.
  String? get problem {
    if (vpn) return 'vpn';
    if (mockLocation) return 'mock_location';
    if (rooted) return 'rooted';
    if (position == null) return 'no_location';
    return null;
  }
}

abstract class PhoneChecks {
  Future<PhoneReport> run();
}

class RealPhoneChecks implements PhoneChecks {
  /// Debug builds may run on the emulator, which looks "rooted". Release builds always check.
  const RealPhoneChecks({this.allowRootedForTesting = false});

  final bool allowRootedForTesting;

  /// Root check implemented in MainActivity.kt (su tool, root apps, test-keys build).
  static const _integrity = MethodChannel('jahez/integrity');

  @override
  Future<PhoneReport> run() async {
    final vpn = await _vpnActive();
    var rooted = false;
    try {
      rooted = await _integrity.invokeMethod<bool>('isRooted') ?? false;
    } catch (_) {
      rooted = false;
    }
    if (allowRootedForTesting) rooted = false;

    Position? position;
    try {
      position = await _position();
    } catch (_) {
      position = null;
    }
    return PhoneReport(
      vpn: vpn,
      rooted: rooted,
      mockLocation: position?.isMocked ?? false,
      position: position,
    );
  }

  /// A VPN shows up as a tunnel network interface (tun, ppp, ipsec, WireGuard…).
  static Future<bool> _vpnActive() async {
    try {
      final interfaces = await NetworkInterface.list(includeLoopback: false, type: InternetAddressType.any);
      return interfaces.any((i) => RegExp(r'^(tun|ppp|pptp|ipsec|wg|utun|tap)', caseSensitive: false).hasMatch(i.name));
    } catch (_) {
      return false;
    }
  }

  static Future<Position?> _position() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return null;
    return Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, timeLimit: Duration(seconds: 20)),
    );
  }
}
