import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
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
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final roomProvider = Provider.of<RoomProvider>(context, listen: false);
      roomProvider.loadRooms();
      roomProvider.initRealtimeSubscription();
    });
  }

  void _showRoomDialog([RoomModel? room]) {
    final isEditing = room != null;
    final nameCtrl = TextEditingController(text: room?.name ?? '');
    final capCtrl = TextEditingController(text: room != null ? room.capacity.toString() : '20');
    final floorCtrl = TextEditingController(text: room?.floor ?? 'Lantai 1');
    final facCtrl = TextEditingController(text: room?.facilities.join(', ') ?? 'AC Central, WiFi High-Speed, Proyektor');
    Uint8List? selectedPhotoBytes;
    String? selectedFileName;
    String? selectedMimeType;

    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
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
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainerLow,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFDDE2EB)),
                    ),
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: selectedPhotoBytes != null
                              ? Image.memory(
                                  selectedPhotoBytes!,
                                  width: double.infinity,
                                  height: 130,
                                  fit: BoxFit.cover,
                                )
                              : (isEditing && room.imageUrl.isNotEmpty)
                                  ? RoomImage(
                                      imageUrl: room.imageUrl,
                                      width: double.infinity,
                                      height: 130,
                                      fit: BoxFit.cover,
                                    )
                                  : Container(
                                      width: double.infinity,
                                      height: 110,
                                      color: AppTheme.surfaceContainerHigh,
                                      child: const Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.add_a_photo_rounded, size: 32, color: AppTheme.primary),
                                          SizedBox(height: 6),
                                          Text('Belum ada foto dipilih', style: TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant)),
                                        ],
                                      ),
                                    ),
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.photo_library_rounded, size: 18),
                            label: Text(selectedPhotoBytes != null || isEditing ? 'Ganti Foto Ruangan' : 'Pilih Foto dari Galeri'),
                            onPressed: () async {
                              final picked = await _picker.pickImage(
                                source: ImageSource.gallery,
                                maxWidth: 1000,
                                maxHeight: 750,
                                imageQuality: 70,
                              );
                              if (picked == null) return;
                              final bytes = await picked.readAsBytes();
                              setDialogState(() {
                                selectedPhotoBytes = bytes;
                                selectedFileName = picked.name;
                                selectedMimeType = picked.mimeType;
                              });
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
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
                      imageUrl: room.imageUrl,
                      imageBytes: selectedPhotoBytes,
                      imageFileName: selectedFileName,
                      imageMimeType: selectedMimeType,
                    );
                  } else {
                    await roomProvider.createRoom(
                      name: nameCtrl.text.trim(),
                      capacity: int.parse(capCtrl.text.trim()),
                      floor: floorCtrl.text.trim(),
                      facilities: facilities,
                      imageBytes: selectedPhotoBytes,
                      imageFileName: selectedFileName,
                      imageMimeType: selectedMimeType,
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

