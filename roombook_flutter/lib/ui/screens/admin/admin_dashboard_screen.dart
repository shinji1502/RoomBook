import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/reservation_model.dart';
import '../../../providers/reservation_provider.dart';
import '../user/reservation_detail_screen.dart';
import 'admin_qr_scanner_screen.dart';
import 'admin_room_management_screen.dart';

class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  String _selectedTab = 'pending'; // 'pending', 'approved', 'rejected', 'all'

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refresh();
      Provider.of<ReservationProvider>(context, listen: false).initRealtimeSubscription(isAdmin: true);
    });
  }

  Future<void> _refresh() async {
    await Provider.of<ReservationProvider>(context, listen: false).loadReservations(isAdmin: true);
  }

  void _showApprovalDialog(ReservationModel res, bool isApprove) {
    final notesController = TextEditingController();
    String selectedReason = 'Jadwal Bentrok';

    final reasons = [
      'Jadwal Bentrok',
      'Pemeliharaan Ruangan',
      'Kapasitas Melebihi Batas',
      'Lainnya',
    ];

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          title: Row(
            children: [
              Icon(
                isApprove ? Icons.check_circle_rounded : Icons.do_not_disturb_on_rounded,
                color: isApprove ? AppTheme.success : AppTheme.error,
              ),
              const SizedBox(width: 8),
              Text(
                isApprove ? 'Setujui Permohonan' : 'Tolak Permohonan',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Konfirmasi pemrosesan tiket #${res.displayId} (${res.eventName}).',
                  style: const TextStyle(fontSize: 13, color: AppTheme.onSurfaceVariant),
                ),
                const SizedBox(height: 14),
                if (!isApprove) ...[
                  const Text('Pilih Alasan Penolakan:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String>(
                    value: selectedReason,
                    items: reasons
                        .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                        .toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setDialogState(() => selectedReason = val);
                      }
                    },
                    decoration: const InputDecoration(contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8)),
                  ),
                  const SizedBox(height: 12),
                ],
                const Text('Catatan Tambahan Admin:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                TextField(
                  controller: notesController,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: isApprove ? 'Catatan persetujuan (opsional)' : 'Penjelasan detail alasan penolakan...',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: isApprove ? AppTheme.success : AppTheme.error,
              ),
              onPressed: () async {
                Navigator.pop(ctx);
                final resProvider = Provider.of<ReservationProvider>(context, listen: false);
                try {
                  final finalNotes = isApprove
                      ? (notesController.text.trim().isNotEmpty ? notesController.text.trim() : 'Disetujui oleh Administrator.')
                      : '$selectedReason: ${notesController.text.trim()}';

                  await resProvider.updateStatus(
                    reservationId: res.id,
                    newStatus: isApprove ? 'approved' : 'rejected',
                    notes: finalNotes,
                  );

                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Tiket #${res.displayId} berhasil ${isApprove ? "disetujui" : "ditolak"}.'),
                      backgroundColor: isApprove ? AppTheme.success : AppTheme.error,
                    ),
                  );
                } catch (e) {
                  if (!mounted) return;
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Gagal memperbarui status: $e'), backgroundColor: AppTheme.error),
                  );
                }
              },
              child: Text(isApprove ? 'Ya, Setujui' : 'Konfirmasi Tolak'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final resProvider = Provider.of<ReservationProvider>(context);
    final all = resProvider.reservations;
    final pendingList = all.where((r) => r.isPending).toList();
    final approvedList = all.where((r) => r.isApproved).toList();
    final rejectedList = all.where((r) => r.isRejected || r.isCancelled).toList();

    List<ReservationModel> displayList;
    switch (_selectedTab) {
      case 'approved':
        displayList = approvedList;
        break;
      case 'rejected':
        displayList = rejectedList;
        break;
      case 'all':
        displayList = all;
        break;
      case 'pending':
      default:
        displayList = pendingList;
        break;
    }

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: const Text('Admin RoomBook'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Segarkan Data',
            onPressed: _refresh,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: AppTheme.primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Summary Statistik Cards
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      'Menunggu',
                      '${pendingList.length}',
                      AppTheme.warning,
                      Icons.hourglass_empty_rounded,
                      isActive: _selectedTab == 'pending',
                      onTap: () => setState(() => _selectedTab = 'pending'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      'Disetujui',
                      '${approvedList.length}',
                      AppTheme.success,
                      Icons.check_circle_outline_rounded,
                      isActive: _selectedTab == 'approved',
                      onTap: () => setState(() => _selectedTab = 'approved'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildMetricCard(
                      'Total Tiket',
                      '${all.length}',
                      AppTheme.primary,
                      Icons.event_note_rounded,
                      isActive: _selectedTab == 'all',
                      onTap: () => setState(() => _selectedTab = 'all'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Menu Akses Cepat Admin (Prioritas 3)
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => const AdminRoomManagementScreen()),
                        );
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.meeting_room_outlined, color: AppTheme.primary, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Kelola Ruangan', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  Text('Tambah & Edit', style: TextStyle(fontSize: 11, color: AppTheme.outline)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (context) => const AdminQrScannerScreen()),
                        );
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFE5E7EB)),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.qr_code_scanner_rounded, color: AppTheme.secondary, size: 20),
                            SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('Scan QR Pintu', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  Text('Check-in Tiket', style: TextStyle(fontSize: 11, color: AppTheme.outline)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Filter Tab Pilihan
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildTabPill('Menunggu (${pendingList.length})', 'pending'),
                    const SizedBox(width: 8),
                    _buildTabPill('Disetujui (${approvedList.length})', 'approved'),
                    const SizedBox(width: 8),
                    _buildTabPill('Ditolak / Batal (${rejectedList.length})', 'rejected'),
                    const SizedBox(width: 8),
                    _buildTabPill('Semua Tiket (${all.length})', 'all'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // List Tiket Sesuai Tab
              if (displayList.isEmpty)
                Container(
                  padding: const EdgeInsets.all(32),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, size: 48, color: AppTheme.success),
                      const SizedBox(height: 10),
                      Text(
                        _selectedTab == 'pending'
                            ? 'Semua Permohonan Selesai'
                            : 'Tidak Ada Data Tiket',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _selectedTab == 'pending'
                            ? 'Tidak ada permohonan reservasi yang menunggu verifikasi admin.'
                            : 'Belum ada tiket pada kategori ini.',
                        style: const TextStyle(color: AppTheme.outline, fontSize: 12),
                      ),
                    ],
                  ),
                )
              else
                ...displayList.map((res) {
                  final roomName = res.room?.name ?? 'Ruangan #${res.roomId}';
                  final applicantName = res.profile?.fullName ?? 'Pemohon';

                  return InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ReservationDetailScreen(reservationId: res.id),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE5E7EB)),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.03),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.between,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    res.displayId,
                                    style: const TextStyle(
                                      color: AppTheme.primary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: AppTheme.surfaceContainerLow,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      applicantName,
                                      style: const TextStyle(fontSize: 11, color: AppTheme.onSurfaceVariant),
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                DateFormatter.formatShortDateTime(res.createdAt),
                                style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            res.eventName,
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$roomName • ${res.participants} Orang',
                            style: const TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            DateFormatter.formatTimeRange(res.startTime, res.endTime),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.secondary),
                          ),
                          if (res.isPending) ...[
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () => _showApprovalDialog(res, false),
                                    style: OutlinedButton.styleFrom(
                                      foregroundColor: AppTheme.error,
                                      side: const BorderSide(color: AppTheme.error),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    child: const Text('Tolak'),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: ElevatedButton(
                                    onPressed: () => _showApprovalDialog(res, true),
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.success,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    child: const Text('Setujui'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTabPill(String title, String tabKey) {
    final isSelected = _selectedTab == tabKey;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = tabKey),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? AppTheme.primary : const Color(0xFFE5E7EB)),
        ),
        child: Text(
          title,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : AppTheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, Color color, IconData icon, {bool isActive = false, VoidCallback? onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: isActive ? color : const Color(0xFFE5E7EB), width: isActive ? 2 : 1),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              title,
              style: const TextStyle(fontSize: 11, color: AppTheme.outline),
            ),
          ],
        ),
      ),
    );
  }
}
