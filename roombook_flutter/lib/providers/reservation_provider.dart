import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/models/reservation_model.dart';
import '../data/models/room_model.dart';
import '../data/models/user_profile_model.dart';
import '../data/services/reservation_service.dart';

/// State Management untuk Reservasi Ruangan
class ReservationProvider extends ChangeNotifier {
  final ReservationService _service = ReservationService();
  RealtimeChannel? _realtimeChannel;

  List<ReservationModel> _reservations = [];
  bool _isLoading = false;
  String? _errorMessage;
  String _activeFilter = 'all'; // 'all', 'pending', 'approved', 'rejected', 'cancelled'

  List<ReservationModel> get reservations => _reservations;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  String get activeFilter => _activeFilter;

  List<ReservationModel> get filteredReservations {
    if (_activeFilter == 'all') return _reservations;
    return _reservations.where((r) => r.status == _activeFilter).toList();
  }

  void setFilter(String filter) {
    _activeFilter = filter;
    notifyListeners();
  }

  /// Memuat daftar reservasi dari Supabase
  Future<void> loadReservations({bool isAdmin = false, String? currentUserId}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final fetched = await _service.fetchReservations(isAdmin: isAdmin);

      // Filter pengguna biasa: hanya tampilkan tiket miliknya
      if (!isAdmin && currentUserId != null) {
        _reservations = fetched.where((r) => r.userId == currentUserId).toList();
      } else {
        _reservations = fetched;
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Mengajukan reservasi baru (dengan cache optimistik instan)
  Future<ReservationModel> createReservation({
    required RoomModel room,
    required UserProfileModel user,
    required String eventName,
    required String purpose,
    required DateTime startTime,
    required DateTime endTime,
    required int participants,
    required List<String> facilities,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final rpcResult = await _service.createReservation(
        roomId: room.id,
        eventName: eventName,
        purpose: purpose,
        startTime: startTime,
        endTime: endTime,
        participants: participants,
        facilities: facilities,
      );

      final newId = rpcResult['reservation_id'] as int;

      // Buat objek reservasi lokal secara instan
      final newReservation = ReservationModel(
        id: newId,
        roomId: room.id,
        userId: user.id,
        eventName: eventName,
        purpose: purpose,
        startTime: startTime,
        endTime: endTime,
        participants: participants,
        facilities: facilities,
        status: 'pending',
        createdAt: DateTime.now(),
        room: room,
        profile: user,
        history: [
          ReservationHistoryItem(
            id: 0,
            reservationId: newId,
            action: 'CREATED',
            notes: 'Pengajuan reservasi baru diajukan oleh pemohon dengan status awal pending.',
            createdAt: DateTime.now(),
          )
        ],
      );

      // Simpan langsung di daftar paling atas
      _reservations.insert(0, newReservation);

      // Coba perbarui data server di latar belakang
      loadReservations(isAdmin: user.isAdmin, currentUserId: user.id);

      _isLoading = false;
      notifyListeners();
      return newReservation;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Mengambil detail satu reservasi
  Future<ReservationModel> getReservationDetail(int id) async {
    try {
      final detail = await _service.fetchReservationDetail(id);
      final idx = _reservations.indexWhere((r) => r.id == id);
      if (idx >= 0) {
        _reservations[idx] = detail;
        notifyListeners();
      }
      return detail;
    } catch (e) {
      // Jika remote gagal, gunakan data cache jika ada
      final local = _reservations.firstWhere((r) => r.id == id,
          orElse: () => throw Exception('Data reservasi tidak ditemukan di cache.'));
      return local;
    }
  }

  /// Memproses persetujuan / penolakan admin
  Future<void> updateStatus({
    required int reservationId,
    required String newStatus,
    String? notes,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _service.updateReservationStatus(
        reservationId: reservationId,
        newStatus: newStatus,
        notes: notes,
      );

      // Perbarui status lokal
      final idx = _reservations.indexWhere((r) => r.id == reservationId);
      if (idx >= 0) {
        _reservations[idx] = _reservations[idx].copyWith(status: newStatus);
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  /// Membatalkan reservasi oleh pemohon (Prioritas 1)
  Future<void> cancelReservation(int reservationId, {String? notes}) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _service.cancelReservation(
        reservationId: reservationId,
        notes: notes ?? 'Dibatalkan oleh pemohon.',
      );

      final idx = _reservations.indexWhere((r) => r.id == reservationId);
      if (idx >= 0) {
        final current = _reservations[idx];
        final updatedHistory = List<ReservationHistoryItem>.from(current.history)
          ..add(ReservationHistoryItem(
            id: DateTime.now().millisecondsSinceEpoch,
            reservationId: reservationId,
            action: 'CANCELLED_BY_USER',
            notes: notes ?? 'Dibatalkan oleh pemohon.',
            createdAt: DateTime.now(),
          ));

        _reservations[idx] = current.copyWith(
          status: 'cancelled',
          history: updatedHistory,
        );
      }

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Check-in kehadiran menggunakan kode QR tiket (Prioritas 3)
  Future<Map<String, dynamic>> checkIn(int reservationId, {String? qrCode}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final res = await _service.checkInReservation(
        reservationId: reservationId,
        qrCode: qrCode,
      );

      final idx = _reservations.indexWhere((r) => r.id == reservationId);
      if (idx >= 0) {
        final current = _reservations[idx];
        final updatedHistory = List<ReservationHistoryItem>.from(current.history)
          ..add(ReservationHistoryItem(
            id: DateTime.now().millisecondsSinceEpoch,
            reservationId: reservationId,
            action: 'CHECKED_IN',
            notes: 'Check-in berhasil via QR code.',
            createdAt: DateTime.now(),
          ));

        _reservations[idx] = current.copyWith(history: updatedHistory);
      }

      _isLoading = false;
      notifyListeners();
      return res;
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Mengambil jadwal slot ruangan pada hari tertentu (Prioritas 2)
  Future<List<Map<String, dynamic>>> loadRoomSchedule(int roomId, DateTime date) async {
    return await _service.fetchRoomSchedule(roomId: roomId, date: date);
  }

  /// Menginisialisasi sinkronisasi Realtime Supabase (Prioritas 2)
  void initRealtimeSubscription({bool isAdmin = false, String? currentUserId}) {
    if (_realtimeChannel != null) return;

    try {
      final client = Supabase.instance.client;
      _realtimeChannel = client
          .channel('public:reservations_changes')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'reservations',
            callback: (payload) {
              // Otomatis refresh data saat ada event INSERT, UPDATE, atau DELETE
              loadReservations(isAdmin: isAdmin, currentUserId: currentUserId);
            },
          )
          .subscribe();
    } catch (_) {
      // Abaikan jika realtime channel belum tersedia di jaringan lokal
    }
  }

  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }
}


