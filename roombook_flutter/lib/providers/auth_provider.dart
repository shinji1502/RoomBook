import 'package:flutter/foundation.dart';
import '../data/models/user_profile_model.dart';
import '../data/services/auth_service.dart';

/// State Management untuk Autentikasi Pengguna
class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  UserProfileModel? _profile;
  bool _isLoading = false;
  String? _errorMessage;

  UserProfileModel? get profile => _profile;
  bool get isAuthenticated => _profile != null && _authService.isAuthenticated;
  bool get isAdmin => _profile?.isAdmin ?? false;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  /// Inisialisasi status sesi awal
  Future<void> initSession() async {
    final user = _authService.currentUser;
    if (user != null) {
      _isLoading = true;
      notifyListeners();
      try {
        _profile = await _authService.fetchProfile(user.id, email: user.email);
      } catch (e) {
        _profile = null;
      }
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Masuk dengan email & password
  Future<bool> signIn(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _profile = await _authService.signIn(email: email, password: password);
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Pendaftaran akun baru
  Future<bool> signUp(String email, String password, String fullName) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _profile = await _authService.signUp(
        email: email,
        password: password,
        fullName: fullName,
      );
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  /// Keluar dari akun
  Future<void> signOut() async {
    await _authService.signOut();
    _profile = null;
    notifyListeners();
  }
}

