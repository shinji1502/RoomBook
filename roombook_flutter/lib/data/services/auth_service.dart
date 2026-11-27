import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/user_profile_model.dart';

/// Layanan Autentikasi Pengguna menggunakan Supabase Auth
class AuthService {
  final SupabaseClient _client = Supabase.instance.client;

  User? get currentUser => _client.auth.currentUser;
  bool get isAuthenticated => currentUser != null;

  /// Masuk dengan email dan kata sandi
  Future<UserProfileModel> signIn({
    required String email,
    required String password,
  }) async {
    final response = await _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );

    final user = response.user;
    if (user == null) {
      throw Exception('Gagal melakukan login. Pengguna tidak ditemukan.');
    }

    return await fetchProfile(user.id, email: user.email);
  }

  /// Pendaftaran akun baru
  Future<UserProfileModel> signUp({
    required String email,
    required String password,
    required String fullName,
  }) async {
    final response = await _client.auth.signUp(
      email: email.trim(),
      password: password,
      data: {'full_name': fullName.trim()},
    );

    final user = response.user;
    if (user == null) {
      throw Exception('Gagal mendaftar akun baru.');
    }

    return await fetchProfile(user.id, email: user.email, defaultName: fullName);
  }

  /// Mengambil profil dari tabel public.profiles
  Future<UserProfileModel> fetchProfile(
    String userId, {
    String? email,
    String? defaultName,
  }) async {
    try {
      final data = await _client
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', userId)
          .maybeSingle();

      if (data != null) {
        return UserProfileModel.fromJson(data, email: email);
      }
    } catch (e) {
      // Abaikan jika query RLS belum siap
    }

    // Default jika record profile belum dibuat
    return UserProfileModel(
      id: userId,
      fullName: defaultName ?? email?.split('@')[0] ?? 'Pengguna',
      role: 'user',
      email: email,
    );
  }

  /// Keluar dari sesi
  Future<void> signOut() async {
    await _client.auth.signOut();
  }
}

