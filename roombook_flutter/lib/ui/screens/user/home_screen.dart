import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/room_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/room_provider.dart';
import '../widgets/room_card.dart';
import 'room_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _searchQuery = '';
  String _selectedCategory = 'Semua';

  final List<String> _categories = [
    'Semua',
    'Kapasitas Besar (≥20)',
    'Ruang Diskusi (<10)',
    'Lantai 1',
    'Lantai 2 & 3',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<RoomProvider>(context, listen: false).loadRooms();
    });
  }

  List<RoomModel> _filterRooms(List<RoomModel> allRooms) {
    return allRooms.where((room) {
      final matchesSearch = room.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          room.facilities.any((f) => f.toLowerCase().contains(_searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      switch (_selectedCategory) {
        case 'Kapasitas Besar (≥20)':
          return room.capacity >= 20;
        case 'Ruang Diskusi (<10)':
          return room.capacity < 10;
        case 'Lantai 1':
          return room.floor.contains('Lantai 1');
        case 'Lantai 2 & 3':
          return room.floor.contains('Lantai 2') || room.floor.contains('Lantai 3');
        default:
          return true;
      }
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final roomProvider = Provider.of<RoomProvider>(context);

    final user = authProvider.profile;
    final userName = user?.fullName ?? 'Pengguna';
    final userInitials = user?.initials ?? 'U';

    final filteredRooms = _filterRooms(roomProvider.rooms);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => roomProvider.loadRooms(),
          color: AppTheme.primary,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top Header (Greeting & Avatar)
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Halo, $userName 👋',
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.onSurface,
                          ),
                        ),
                        const SizedBox(height: 2),
                        const Text(
                          'Cari dan pesan ruang rapat kampus & kantor',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppTheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppTheme.primary,
                      child: Text(
                        userInitials,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Search Bar
                TextField(
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Cari nama ruangan atau fasilitas...',
                    prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.outline),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, size: 18),
                            onPressed: () => setState(() => _searchQuery = ''),
                          )
                        : null,
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.symmetric(vertical: 12),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Category Filter Pills
                SizedBox(
                  height: 36,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, idx) {
                      final cat = _categories[idx];
                      final isSelected = cat == _selectedCategory;
                      return ChoiceChip(
                        label: Text(cat),
                        selected: isSelected,
                        onSelected: (_) => setState(() => _selectedCategory = cat),
                        labelStyle: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? Colors.white : AppTheme.onSurfaceVariant,
                        ),
                        selectedColor: AppTheme.primary,
                        backgroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: isSelected ? AppTheme.primary : const Color(0xFFE5E7EB),
                          ),
                        ),
                        showCheckmark: false,
                      );
                    },
                  ),
                ),
                const SizedBox(height: 24),

                // Section Title
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    const Text(
                      'Daftar Ruangan Tersedia',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.onSurface,
                      ),
                    ),
                    Text(
                      '${filteredRooms.length} Ruangan',
                      style: const TextStyle(fontSize: 12, color: AppTheme.outline),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Daftar Ruangan
                if (roomProvider.isLoading)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(40),
                      child: CircularProgressIndicator(color: AppTheme.primary),
                    ),
                  )
                else if (filteredRooms.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.all(40),
                      child: Column(
                        children: [
                          const Icon(Icons.meeting_room_outlined, size: 48, color: AppTheme.outline),
                          const SizedBox(height: 12),
                          const Text(
                            'Tidak ada ruangan yang cocok',
                            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            roomProvider.errorMessage ?? 'Coba gunakan kata kunci pencarian yang berbeda.',
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: AppTheme.outline, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  ...filteredRooms.map((room) {
                    return RoomCard(
                      room: room,
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => RoomDetailScreen(room: room),
                          ),
                        );
                      },
                    );
                  }),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

