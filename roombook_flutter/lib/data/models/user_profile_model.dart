/// Model Profil Pengguna dari tabel public.profiles
class UserProfileModel {
  final String id;
  final String fullName;
  final String role; // 'user' atau 'admin'
  final String? email;

  UserProfileModel({
    required this.id,
    required this.fullName,
    required this.role,
    this.email,
  });

  bool get isAdmin => role == 'admin';

  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return 'U';
    if (parts.length == 1) return parts[0].substring(0, parts[0].length >= 2 ? 2 : 1).toUpperCase();
    return (parts[0][0] + parts.last[0]).toUpperCase();
  }

  factory UserProfileModel.fromJson(Map<String, dynamic> json, {String? email}) {
    return UserProfileModel(
      id: json['id']?.toString() ?? '',
      fullName: json['full_name'] ?? 'Pengguna Terdaftar',
      role: json['role'] ?? 'user',
      email: email,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'full_name': fullName,
      'role': role,
    };
  }
}

