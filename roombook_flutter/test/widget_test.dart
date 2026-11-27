import 'package:flutter_test/flutter_test.dart';
import 'package:roombook_flutter/data/models/room_model.dart';
import 'package:roombook_flutter/data/models/reservation_model.dart';

void main() {
  test('RoomModel parses correctly from json', () {
    final json = {
      'id': 2,
      'name': 'Ruang Rapat Utama',
      'capacity': 20,
      'facilities': 'Proyektor, WiFi, AC',
      'image_url': 'https://example.com/image.jpg',
      'floor': 'Lantai 1'
    };

    final room = RoomModel.fromJson(json);
    expect(room.id, 2);
    expect(room.name, 'Ruang Rapat Utama');
    expect(room.capacity, 20);
    expect(room.facilities.length, 3);
  });

  test('ReservationModel displayId format', () {
    final json = {
      'id': 14,
      'room_id': 2,
      'user_id': 'test-uuid',
      'event_name': 'Rapat Evaluasi',
      'purpose': 'Koordinasi Mingguan',
      'status': 'pending',
      'participants': 10,
    };

    final res = ReservationModel.fromJson(json);
    expect(res.displayId, 'RB-14');
    expect(res.isPending, true);
    expect(res.isApproved, false);
  });

  test('ReservationModel handles cancelled, completed status and history items', () {
    final json = {
      'id': 20,
      'room_id': 3,
      'user_id': 'user-123',
      'event_name': 'Workshop Flutter',
      'purpose': 'Pelatihan Mahasiswa',
      'status': 'cancelled',
      'participants': 25,
      'reservation_history': [
        {
          'id': 101,
          'reservation_id': 20,
          'action': 'CREATED',
          'notes': 'Pengajuan baru',
          'created_at': '2026-11-06T08:00:00Z'
        },
        {
          'id': 102,
          'reservation_id': 20,
          'action': 'CANCELLED_BY_USER',
          'notes': 'Dibatalkan oleh pemohon.',
          'created_at': '2026-11-06T09:00:00Z'
        }
      ]
    };

    final res = ReservationModel.fromJson(json);
    expect(res.id, 20);
    expect(res.isCancelled, true);
    expect(res.isCompleted, false);
    expect(res.history.length, 2);
    expect(res.history[1].action, 'CANCELLED_BY_USER');
    expect(res.history[1].notes, 'Dibatalkan oleh pemohon.');
  });
}


