/// What the screens need from the backend. The real implementation talks to
/// Supabase; tests use a fake.
abstract class AuthService {
  /// The signed-in employee, or null when signed out.
  Future<Profile?> currentProfile();

  /// Signs in with file number + password. Throws [AuthFailure] with an error code.
  Future<Profile> signIn(String fileNumber, String password);

  /// Changes the password on the server (rules checked there). Throws [AuthFailure].
  Future<void> changePassword(String newPassword);

  /// Binds this phone to the employee, or checks it is the bound phone.
  Future<DeviceStatus> bindThisDevice();

  /// Whether the signed-in employee has accepted the face and location data consent.
  Future<bool> hasConsent();

  /// Records the signed-in employee's consent (the current text version).
  Future<void> giveConsent();

  Future<void> signOut();
}

class Profile {
  const Profile({
    required this.id,
    required this.fileNumber,
    required this.nameAr,
    required this.nameEn,
    required this.role,
    required this.mustChangePassword,
  });

  final String id;
  final int fileNumber;
  final String nameAr;
  final String nameEn;
  final String role;
  final bool mustChangePassword;

  Profile copyWith({bool? mustChangePassword}) => Profile(
        id: id,
        fileNumber: fileNumber,
        nameAr: nameAr,
        nameEn: nameEn,
        role: role,
        mustChangePassword: mustChangePassword ?? this.mustChangePassword,
      );
}

/// Result of bind_device on the server.
enum DeviceStatus { bound, ok, otherDevice, deviceTaken }

/// Version of the consent text shown in the app (stored with each acceptance).
const String consentVersion = 'v1';

class AuthFailure implements Exception {
  const AuthFailure(this.code);

  /// Matches an `error_<code>` text in l10n.dart.
  final String code;

  @override
  String toString() => 'AuthFailure($code)';
}

/// Same rules as the server, checked first so the user gets instant feedback.
String? passwordProblem(String password, int fileNumber) {
  if (password.length < 8) return 'too_short';
  if (password.length > 72) return 'too_long';
  if (!RegExp(r'\p{L}', unicode: true).hasMatch(password)) return 'needs_letter';
  if (!RegExp(r'\p{Nd}', unicode: true).hasMatch(password)) return 'needs_digit';
  if (password.contains('$fileNumber')) return 'contains_file_number';
  return null;
}
