import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/models/room_model.dart';
import '../../../providers/room_provider.dart';
import '../../widgets/room_image.dart';

/// Halaman Manajemen Ruangan Khusus Administrator (Prioritas 3)
class AdminRoomManagementScreen extends StatefulWidget {
  const AdminRoomManagementScreen({super.key});

  @override
  State<AdminRoomManagementScreen> createState() => _AdminRoomManagementScreenState();
}

class _AdminRoomManagementScreenState extends State<AdminRoomManagementScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<RoomProvider>(context, listen: false).loadRooms();
    });
  }

  void _showRoomDialog([RoomModel? room]) {
    final isEditing = room != null;
    final nameCtrl = TextEditingController(text: room?.name ?? '');
    final capCtrl = TextEditingController(text: room != null ? room.capacity.toString() : '20');
    final floorCtrl = TextEditingController(text: room?.floor ?? 'Lantai 1');
    final facCtrl = TextEditingController(text: room?.facilities.join(', ') ?? 'AC Central, WiFi High-Speed, Proyektor');
    final imgCtrl = TextEditingController(text: room?.imageUrl ?? '');

    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          isEditing ? 'Edit Data Ruangan' : 'Tambah Ruangan Baru',
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
        content: SingleChildScrollView(
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Nama Ruangan', hintText: 'Misal: Ruang Rapat Senat'),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Nama ruangan wajib diisi' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: capCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Kapasitas (Orang)'),
                        validator: (v) {
                          final n = int.tryParse(v ?? '');
                          if (n == null || n <= 0) return 'Harus > 0';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: floorCtrl,
                        decoration: const InputDecoration(labelText: 'Lokasi Lantai', hintText: 'Lantai 2'),
                        validator: (v) => v == null || v.trim().isEmpty ? 'Wajib diisi' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: facCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Fasilitas (Pisahkan Koma)',
                    hintText: 'AC, Proyektor, WiFi, Sound System',
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Fasilitas wajib diisi' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: imgCtrl,
                  decoration: const InputDecoration(
                    labelText: 'URL Gambar Ruangan (Opsional)',
                    hintText: 'https://...',
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(ctx);

              final roomProvider = Provider.of<RoomProvider>(context, listen: false);
              final facilities = facCtrl.text
                  .split(',')
                  .map((e) => e.trim())
                  .where((e) => e.isNotEmpty)
                  .toList();

              try {
                if (isEditing) {
                  await roomProvider.updateRoom(
                    roomId: room.id,
                    name: nameCtrl.text.trim(),
                    capacity: int.parse(capCtrl.text.trim()),
                    floor: floorCtrl.text.trim(),
                    facilities: facilities,
                    imageUrl: imgCtrl.text.trim().isNotEmpty ? imgCtrl.text.trim() : null,
                  );
                } else {
                  await roomProvider.createRoom(
                    name: nameCtrl.text.trim(),
                    capacity: int.parse(capCtrl.text.trim()),
                    floor: floorCtrl.text.trim(),
                    facilities: facilities,
                    imageUrl: imgCtrl.text.trim().isNotEmpty ? imgCtrl.text.trim() : null,
                  );
                }

                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(isEditing ? 'Ruangan berhasil diperbarui.' : 'Ruangan baru berhasil ditambahkan.'),
                    backgroundColor: AppTheme.success,
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Gagal menyimpan ruangan: $e'), backgroundColor: AppTheme.error),
                );
              }
            },
            child: Text(isEditing ? 'Simpan Perubahan' : 'Tambahkan'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(RoomModel room) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.delete_outline_rounded, color: AppTheme.error),
            SizedBox(width: 8),
            Text('Hapus Ruangan?'),
          ],
        ),
        content: Text('Apakah Anda yakin ingin menghapus "${room.name}"? Pastikan tidak ada jadwal aktif.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.error, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                final provider = Provider.of<RoomProvider>(context, listen: false);
                await provider.deleteRoom(room.id);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Ruangan berhasil dihapus.'), backgroundColor: AppTheme.primary),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text('Gagal menghapus ruangan: $e'), backgroundColor: AppTheme.error),
                );
              }
            },
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final roomProvider = Provider.of<RoomProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: const Text('Manajemen Ruangan'),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Tambah Ruangan',
            onPressed: () => _showRoomDialog(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => roomProvider.loadRooms(),
        color: AppTheme.primary,
        child: roomProvider.isLoading && roomProvider.rooms.isEmpty
            ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
            : roomProvider.rooms.isEmpty
                ? const Center(child: Text('Belum ada data ruangan.'))
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: roomProvider.rooms.length,
                    itemBuilder: (context, index) {
                      final room = roomProvider.rooms[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: RoomImage(
                                imageUrl: room.imageUrl,
                                width: 70,
                                height: 70,
                                fit: BoxFit.cover,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    room.name,
                                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    '${room.floor} • Kapasitas: ${room.capacity} Orang',
                                    style: const TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    room.facilities.join(', '),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, size: 20, color: AppTheme.primary),
                                  onPressed: () => _showRoomDialog(room),
                                  tooltip: 'Edit',
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline_rounded, size: 20, color: AppTheme.error),
                                  onPressed: () => _confirmDelete(room),
                                  tooltip: 'Hapus',
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showRoomDialog(),
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Tambah Ruangan'),
      ),
    );
  }
}

