import 'room_model.dart';
import 'user_profile_model.dart';

/// Item riwayat audit dari tabel public.reservation_history
class ReservationHistoryItem {
  final int id;
  final int reservationId;
  final String action;
  final String? notes;
  final DateTime createdAt;

  ReservationHistoryItem({
    required this.id,
    required this.reservationId,
    required this.action,
    this.notes,
    required this.createdAt,
  });

  factory ReservationHistoryItem.fromJson(Map<String, dynamic> json) {
    return ReservationHistoryItem(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      reservationId: json['reservation_id'] is int
          ? json['reservation_id']
          : int.parse(json['reservation_id'].toString()),
      action: json['action'] ?? 'UNKNOWN',
      notes: json['notes'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
    );
  }
}

/// Model Reservasi dari tabel public.reservations
class ReservationModel {
  final int id;
  final int roomId;
  final String userId;
  final String eventName;
  final String purpose;
  final DateTime startTime;
  final DateTime endTime;
  final int participants;
  final List<String> facilities;
  final String status; // 'pending', 'approved', 'rejected'
  final DateTime createdAt;

  // Relasi
  final RoomModel? room;
  final UserProfileModel? profile;
  final List<ReservationHistoryItem> history;

  ReservationModel({
    required this.id,
    required this.roomId,
    required this.userId,
    required this.eventName,
    required this.purpose,
    required this.startTime,
    required this.endTime,
    required this.participants,
    required this.facilities,
    required this.status,
    required this.createdAt,
    this.room,
    this.profile,
    this.history = const [],
  });

  String get displayId => 'RB-$id';
  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isCancelled => status == 'cancelled';
  bool get isCompleted => status == 'completed';

  factory ReservationModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedFacilities = [];
    final rawFac = json['facilities'];
    if (rawFac is List) {
      parsedFacilities = rawFac.map((e) => e.toString()).toList();
    }

    RoomModel? parsedRoom;
    if (json['rooms'] is Map<String, dynamic>) {
      parsedRoom = RoomModel.fromJson(json['rooms']);
    }

    UserProfileModel? parsedProfile;
    if (json['profiles'] is Map<String, dynamic>) {
      parsedProfile = UserProfileModel.fromJson(json['profiles']);
    }

    List<ReservationHistoryItem> parsedHistory = [];
    final rawHistory = json['reservation_history'];
    if (rawHistory is List) {
      parsedHistory = rawHistory
          .map((h) => ReservationHistoryItem.fromJson(Map<String, dynamic>.from(h)))
          .toList();
    }

    return ReservationModel(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      roomId: json['room_id'] is int ? json['room_id'] : int.parse(json['room_id'].toString()),
      userId: json['user_id']?.toString() ?? '',
      eventName: json['event_name'] ?? json['purpose'] ?? 'Agenda Rapat',
      purpose: json['purpose'] ?? '',
      startTime: json['start_time'] != null
          ? DateTime.parse(json['start_time'])
          : DateTime.now(),
      endTime: json['end_time'] != null
          ? DateTime.parse(json['end_time'])
          : DateTime.now().add(const Duration(hours: 2)),
      participants: json['participants'] is int
          ? json['participants']
          : int.tryParse(json['participants']?.toString() ?? '1') ?? 1,
      facilities: parsedFacilities,
      status: json['status'] ?? 'pending',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : DateTime.now(),
      room: parsedRoom,
      profile: parsedProfile,
      history: parsedHistory,
    );
  }

  ReservationModel copyWith({
    String? status,
    RoomModel? room,
    UserProfileModel? profile,
    List<ReservationHistoryItem>? history,
  }) {
    return ReservationModel(
      id: id,
      roomId: roomId,
      userId: userId,
      eventName: eventName,
      purpose: purpose,
      startTime: startTime,
      endTime: endTime,
      participants: participants,
      facilities: facilities,
      status: status ?? this.status,
      createdAt: createdAt,
      room: room ?? this.room,
      profile: profile ?? this.profile,
      history: history ?? this.history,
    );
  }
}

