import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/reservation_model.dart';

/// Layanan Reservasi Supabase
class ReservationService {
  final SupabaseClient _client = Supabase.instance.client;

  /// Mengajukan reservasi baru melalui RPC create_reservation_safe
  Future<Map<String, dynamic>> createReservation({
    required int roomId,
    required String eventName,
    required String purpose,
    required DateTime startTime,
    required DateTime endTime,
    required int participants,
    required List<String> facilities,
  }) async {
    final payload = {
      'p_room_id': roomId,
      'p_event_name': eventName.trim(),
      'p_purpose': purpose.trim(),
      'p_start_time': startTime.toUtc().toIso8601String(),
      'p_end_time': endTime.toUtc().toIso8601String(),
      'p_participants': participants,
      'p_facilities': facilities,
    };

    final result = await _client.rpc('create_reservation_safe', params: payload);
    return Map<String, dynamic>.from(result);
  }

  /// Mengambil daftar reservasi dengan relasi rooms dan profiles
  Future<List<ReservationModel>> fetchReservations({bool isAdmin = false}) async {
    try {
      final response = await _client
          .from('reservations')
          .select('''
            *,
            rooms (id, name, capacity, facilities, image_url),
            profiles:user_id (id, full_name, role)
          ''')
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => ReservationModel.fromJson(json))
          .toList();
    } catch (e) {
      // Fallback query langsung jika relasi profiles gagal
      final response = await _client
          .from('reservations')
          .select('*')
          .order('created_at', ascending: false);

      return (response as List)
          .map((json) => ReservationModel.fromJson(json))
          .toList();
    }
  }

  /// Mengambil detail satu reservasi beserta riwayat audit dari reservation_history
  Future<ReservationModel> fetchReservationDetail(int id) async {
    final resData = await _client
        .from('reservations')
        .select('''
          *,
          rooms (id, name, capacity, facilities, image_url),
          profiles:user_id (id, full_name, role)
        ''')
        .eq('id', id)
        .maybeSingle();

    if (resData == null) {
      throw Exception('Data reservasi #RB-$id tidak ditemukan di database.');
    }

    final reservation = ReservationModel.fromJson(resData);

    // Ambil linimasa riwayat
    List<ReservationHistoryItem> historyItems = [];
    try {
      final historyData = await _client
          .from('reservation_history')
          .select('*')
          .eq('reservation_id', id)
          .order('created_at', ascending: true);

      historyItems = (historyData as List)
          .map((h) => ReservationHistoryItem.fromJson(h))
          .toList();
    } catch (_) {}

    return reservation.copyWith(history: historyItems);
  }

  /// Memproses persetujuan / penolakan reservasi melalui RPC update_reservation_status_safe
  Future<Map<String, dynamic>> updateReservationStatus({
    required int reservationId,
    required String newStatus, // 'approved', 'rejected', 'cancelled', 'completed'
    String? notes,
  }) async {
    final payload = {
      'p_reservation_id': reservationId,
      'p_new_status': newStatus,
      'p_notes': notes?.trim(),
    };

    final result = await _client.rpc(
      'update_reservation_status_safe',
      params: payload,
    );

    return Map<String, dynamic>.from(result);
  }

  /// Membatalkan reservasi oleh pemohon tiket (status 'cancelled')
  Future<Map<String, dynamic>> cancelReservation({
    required int reservationId,
    String? notes,
  }) async {
    return await updateReservationStatus(
      reservationId: reservationId,
      newStatus: 'cancelled',
      notes: notes ?? 'Dibatalkan oleh pemohon.',
    );
  }

  /// Melakukan check-in kehadiran di pintu via RPC check_in_reservation_safe
  Future<Map<String, dynamic>> checkInReservation({
    required int reservationId,
    String? qrCode,
  }) async {
    final payload = {
      'p_reservation_id': reservationId,
      'p_qr_code': qrCode,
    };

    final result = await _client.rpc(
      'check_in_reservation_safe',
      params: payload,
    );

    return Map<String, dynamic>.from(result);
  }

  /// Mengambil jadwal slot ruangan pada tanggal tertentu untuk visualisasi ketersediaan
  Future<List<Map<String, dynamic>>> fetchRoomSchedule({
    required int roomId,
    required DateTime date,
  }) async {
    try {
      final dateStr =
          "${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}";
      final result = await _client.rpc('get_room_schedule', params: {
        'p_room_id': roomId,
        'p_date': dateStr,
      });

      return List<Map<String, dynamic>>.from(result);
    } catch (_) {
      // Fallback: query tabel reservations langsung jika RPC belum dieksekusi di database
      final startOfDay = DateTime(date.year, date.month, date.day).toUtc().toIso8601String();
      final endOfDay = DateTime(date.year, date.month, date.day, 23, 59, 59).toUtc().toIso8601String();

      final res = await _client
          .from('reservations')
          .select('id, event_name, start_time, end_time, status')
          .eq('room_id', roomId)
          .inFilter('status', ['pending', 'approved'])
          .gte('end_time', startOfDay)
          .lte('start_time', endOfDay)
          .order('start_time', ascending: true);

      return (res as List).map((e) => Map<String, dynamic>.from(e)).toList();
    }
  }
}


