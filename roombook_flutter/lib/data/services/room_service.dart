import 'dart:convert';
import 'dart:typed_data';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/room_model.dart';

/// Layanan untuk mengambil data ruangan dari Supabase
class RoomService {
  final SupabaseClient _client = Supabase.instance.client;

  /// Mengupload foto ruangan ke bucket 'room-images', fallback Data URI jika storage belum aktif
  Future<String> uploadRoomPhotoBytes(
    Uint8List bytes, {
    String fileName = 'room.jpg',
    String? mimeType,
  }) async {
    final ext = fileName.contains('.') ? fileName.split('.').last.toLowerCase() : 'jpg';
    final safeExt = (ext == 'png' || ext == 'webp' || ext == 'jpeg' || ext == 'jpg') ? ext : 'jpg';
    final resolvedMime = mimeType ??
        (safeExt == 'png'
            ? 'image/png'
            : safeExt == 'webp'
                ? 'image/webp'
                : 'image/jpeg');
    final storagePath = 'rooms/room_${DateTime.now().millisecondsSinceEpoch}.$safeExt';

    try {
      await _client.storage.from('room-images').uploadBinary(
            storagePath,
            bytes,
            fileOptions: FileOptions(contentType: resolvedMime, upsert: true),
          );
      return _client.storage.from('room-images').getPublicUrl(storagePath);
    } catch (_) {
      return 'data:$resolvedMime;base64,${base64Encode(bytes)}';
    }
  }

  /// Mengambil semua ruangan dari tabel public.rooms
  Future<List<RoomModel>> fetchRooms() async {
    final response = await _client
        .from('rooms')
        .select('*')
        .order('id', ascending: true);

    return (response as List).map((json) => RoomModel.fromJson(json)).toList();
  }

  /// Mengambil ruangan berdasarkan ID
  Future<RoomModel?> fetchRoomById(int roomId) async {
    final response = await _client
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

    if (response == null) return null;
    return RoomModel.fromJson(response);
  }

  /// Menambah ruangan baru (khusus Admin)
  Future<Map<String, dynamic>> createRoom({
    required String name,
    required int capacity,
    required String floor,
    required List<String> facilities,
    String? imageUrl,
  }) async {
    try {
      final res = await _client.rpc('admin_create_room', params: {
        'p_name': name.trim(),
        'p_capacity': capacity,
        'p_floor': floor.trim(),
        'p_facilities': facilities,
        'p_image_url': imageUrl?.trim(),
      });
      return Map<String, dynamic>.from(res);
    } catch (_) {
      // Fallback mutasi langsung jika RPC belum dieksekusi
      final res = await _client.from('rooms').insert({
        'name': name.trim(),
        'capacity': capacity,
        'floor': floor.trim(),
        'facilities': facilities,
        'image_url': imageUrl?.trim() ??
            'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      }).select().single();
      return Map<String, dynamic>.from(res);
    }
  }

  /// Memperbarui data ruangan (khusus Admin)
  Future<Map<String, dynamic>> updateRoom({
    required int roomId,
    required String name,
    required int capacity,
    required String floor,
    required List<String> facilities,
    String? imageUrl,
  }) async {
    try {
      final res = await _client.rpc('admin_update_room', params: {
        'p_room_id': roomId,
        'p_name': name.trim(),
        'p_capacity': capacity,
        'p_floor': floor.trim(),
        'p_facilities': facilities,
        'p_image_url': imageUrl?.trim(),
      });
      return Map<String, dynamic>.from(res);
    } catch (_) {
      final res = await _client.from('rooms').update({
        'name': name.trim(),
        'capacity': capacity,
        'floor': floor.trim(),
        'facilities': facilities,
        if (imageUrl != null && imageUrl.isNotEmpty) 'image_url': imageUrl.trim(),
      }).eq('id', roomId).select().single();
      return Map<String, dynamic>.from(res);
    }
  }

  /// Menghapus ruangan (khusus Admin)
  Future<void> deleteRoom(int roomId) async {
    try {
      await _client.rpc('admin_delete_room', params: {'p_room_id': roomId});
    } catch (_) {
      await _client.from('rooms').delete().eq('id', roomId);
    }
  }
}


