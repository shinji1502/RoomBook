import 'package:flutter/foundation.dart';
import '../data/models/room_model.dart';
import '../data/services/room_service.dart';

/// State Management untuk Daftar Ruangan
class RoomProvider extends ChangeNotifier {
  final RoomService _roomService = RoomService();

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

  /// Menambah ruangan baru (khusus Admin - Prioritas 3)
  Future<void> createRoom({
    required String name,
    required int capacity,
    required String floor,
    required List<String> facilities,
    String? imageUrl,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _roomService.createRoom(
        name: name,
        capacity: capacity,
        floor: floor,
        facilities: facilities,
        imageUrl: imageUrl,
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
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      await _roomService.updateRoom(
        roomId: roomId,
        name: name,
        capacity: capacity,
        floor: floor,
        facilities: facilities,
        imageUrl: imageUrl,
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
}


