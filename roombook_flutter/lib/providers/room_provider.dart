import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../data/models/room_model.dart';
import '../data/services/room_service.dart';

/// State Management untuk Daftar Ruangan
class RoomProvider extends ChangeNotifier {
  final RoomService _roomService = RoomService();
  RealtimeChannel? _realtimeChannel;

  List<RoomModel> _rooms = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<RoomModel> get rooms => _rooms;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> loadRooms() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _rooms = await _roomService.fetchRooms();
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      _isLoading = false;
      notifyListeners();
    }
  }

  RoomModel? getRoomById(int id) {
    try {
      return _rooms.firstWhere((r) => r.id == id);
    } catch (_) {
      return null;
    }
  }

  /// Menginisialisasi sinkronisasi Realtime tabel public.rooms
  void initRealtimeSubscription() {
    if (_realtimeChannel != null) return;
    try {
      final client = Supabase.instance.client;
      _realtimeChannel = client
          .channel('public:rooms_changes')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'rooms',
            callback: (_) {
              loadRooms();
            },
          )
          .subscribe();
    } catch (_) {
      // Abaikan jika realtime channel belum tersedia di jaringan lokal
    }
  }

  /// Menambah ruangan baru (khusus Admin - Prioritas 3)
  Future<void> createRoom({
    required String name,
    required int capacity,
    required String floor,
    required List<String> facilities,
    String? imageUrl,
    Uint8List? imageBytes,
    String? imageFileName,
    String? imageMimeType,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      String? resolvedImageUrl = imageUrl;
      if (imageBytes != null && imageBytes.isNotEmpty) {
        resolvedImageUrl = await _roomService.uploadRoomPhotoBytes(
          imageBytes,
          fileName: imageFileName ?? 'room.jpg',
          mimeType: imageMimeType,
        );
      }

      await _roomService.createRoom(
        name: name,
        capacity: capacity,
        floor: floor,
        facilities: facilities,
        imageUrl: resolvedImageUrl,
      );
      await loadRooms();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Memperbarui data ruangan (khusus Admin - Prioritas 3)
  Future<void> updateRoom({
    required int roomId,
    required String name,
    required int capacity,
    required String floor,
    required List<String> facilities,
    String? imageUrl,
    Uint8List? imageBytes,
    String? imageFileName,
    String? imageMimeType,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      String? resolvedImageUrl = imageUrl;
      if (imageBytes != null && imageBytes.isNotEmpty) {
        resolvedImageUrl = await _roomService.uploadRoomPhotoBytes(
          imageBytes,
          fileName: imageFileName ?? 'room.jpg',
          mimeType: imageMimeType,
        );
      }

      await _roomService.updateRoom(
        roomId: roomId,
        name: name,
        capacity: capacity,
        floor: floor,
        facilities: facilities,
        imageUrl: resolvedImageUrl,
      );
      await loadRooms();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  /// Menghapus ruangan (khusus Admin - Prioritas 3)
  Future<void> deleteRoom(int roomId) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _roomService.deleteRoom(roomId);
      _rooms.removeWhere((r) => r.id == roomId);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }

  @override
  void dispose() {
    _realtimeChannel?.unsubscribe();
    super.dispose();
  }
}


