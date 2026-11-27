/// Model Ruangan dari tabel public.rooms
class RoomModel {
  final int id;
  final String name;
  final int capacity;
  final List<String> facilities;
  final String imageUrl;
  final String floor;

  RoomModel({
    required this.id,
    required this.name,
    required this.capacity,
    required this.facilities,
    required this.imageUrl,
    String? floor,
  }) : floor = floor ?? (capacity >= 50 ? 'Lantai 2' : (capacity >= 20 ? 'Lantai 3 • Sayap Barat' : 'Lantai 1'));

  factory RoomModel.fromJson(Map<String, dynamic> json) {
    List<String> parsedFacilities = [];
    final rawFac = json['facilities'];
    if (rawFac is List) {
      parsedFacilities = rawFac.map((e) => e.toString()).toList();
    } else if (rawFac is String) {
      parsedFacilities = rawFac
          .split(RegExp(r'[,;\n]'))
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList();
    }

    return RoomModel(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      name: json['name'] ?? 'Ruang Rapat',
      capacity: json['capacity'] is int ? json['capacity'] : int.tryParse(json['capacity']?.toString() ?? '20') ?? 20,
      facilities: parsedFacilities.isEmpty ? ['AC Central', 'WiFi High-Speed', 'Proyektor'] : parsedFacilities,
      imageUrl: json['image_url'] ??
          'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
      floor: json['floor'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'capacity': capacity,
      'facilities': facilities,
      'image_url': imageUrl,
      'floor': floor,
    };
  }
}

