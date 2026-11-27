import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/reservation_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/reservation_provider.dart';
import '../widgets/status_badge.dart';

class ReservationDetailScreen extends StatefulWidget {
  final int reservationId;

  const ReservationDetailScreen({super.key, required this.reservationId});

  @override
  State<ReservationDetailScreen> createState() => _ReservationDetailScreenState();
}

class _ReservationDetailScreenState extends State<ReservationDetailScreen> {
  ReservationModel? _reservation;
  bool _isLoading = true;
  bool _isProcessingAction = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDetail();
  }

  Future<void> _loadDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final resProvider = Provider.of<ReservationProvider>(context, listen: false);
      final data = await resProvider.getReservationDetail(widget.reservationId);
      setState(() {
        _reservation = data;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception:', '').trim();
        _isLoading = false;
      });
    }
  }

  /// Dialog konfirmasi pembatalan reservasi oleh pemohon (Prioritas 1)
  void _showCancelDialog(ReservationModel res) {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppTheme.error),
            SizedBox(width: 8),
            Text(
              'Batalkan Pengajuan?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Apakah Anda yakin ingin membatalkan permohonan tiket #${res.displayId} (${res.eventName})?',
              style: const TextStyle(fontSize: 13, color: AppTheme.onSurfaceVariant),
            ),
            const SizedBox(height: 14),
            const Text(
              'Alasan Pembatalan (Opsional):',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: reasonController,
              maxLines: 2,
              decoration: const InputDecoration(
                hintText: 'Misal: Rapat diundur, salah pilih ruangan...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Kembali'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              setState(() => _isProcessingAction = true);

              try {
                final resProvider = Provider.of<ReservationProvider>(context, listen: false);
                final reason = reasonController.text.trim().isNotEmpty
                    ? reasonController.text.trim()
                    : 'Dibatalkan oleh pemohon.';

                await resProvider.cancelReservation(res.id, notes: reason);
                await _loadDetail();

                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Tiket #${res.displayId} berhasil dibatalkan.'),
                    backgroundColor: AppTheme.primary,
                  ),
                );
              } catch (e) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Gagal membatalkan tiket: $e'),
                    backgroundColor: AppTheme.error,
                  ),
                );
              } finally {
                if (mounted) setState(() => _isProcessingAction = false);
              }
            },
            child: const Text('Ya, Batalkan'),
          ),
        ],
      ),
    );
  }

  /// Proses Check-in kehadiran di pintu via QR Code (Prioritas 3)
  Future<void> _handleCheckIn(ReservationModel res) async {
    setState(() => _isProcessingAction = true);
    try {
      final resProvider = Provider.of<ReservationProvider>(context, listen: false);
      final qrString = 'ROOMBOOK-${res.id}-${res.roomId}';
      final result = await resProvider.checkIn(res.id, qrCode: qrString);

      await _loadDetail();

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result['message']?.toString() ?? 'Check-in berhasil! Pintu ruangan siap diakses.'),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Check-in gagal: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    } finally {
      if (mounted) setState(() => _isProcessingAction = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: AppTheme.surface,
        appBar: AppBar(title: const Text('Detail Reservasi')),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: AppTheme.primary),
              SizedBox(height: 12),
              Text('Memuat Detail Tiket...', style: TextStyle(color: AppTheme.onSurfaceVariant)),
            ],
          ),
        ),
      );
    }

    if (_error != null || _reservation == null) {
      return Scaffold(
        backgroundColor: AppTheme.surface,
        appBar: AppBar(title: const Text('Detail Reservasi')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.search_off_rounded, size: 64, color: AppTheme.outline),
                const SizedBox(height: 14),
                const Text(
                  'Reservasi Tidak Ditemukan',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 6),
                Text(
                  _error ?? 'Data tiket tidak dapat dimuat.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.onSurfaceVariant, fontSize: 13),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _loadDetail,
                  child: const Text('Coba Lagi'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final res = _reservation!;
    final authProvider = Provider.of<AuthProvider>(context);
    final roomName = res.room?.name ?? 'Ruangan #${res.roomId}';
    final isOwner = authProvider.profile?.id == res.userId;
    final canCancel = res.isPending && (isOwner || authProvider.isAdmin);

    // Cari catatan admin terakhir dari riwayat audit (Prioritas 1)
    final latestHistoryWithNotes = res.history.reversed.firstWhere(
      (h) => h.notes != null && h.notes!.trim().isNotEmpty && h.action != 'CREATED',
      orElse: () => ReservationHistoryItem(
        id: 0,
        reservationId: res.id,
        action: '',
        notes: null,
        createdAt: DateTime.now(),
      ),
    );

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: Text(res.displayId),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Segarkan Data',
            onPressed: _loadDetail,
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Header Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Nomor Tiket: ${res.displayId}',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Diajukan: ${DateFormatter.formatShortDateTime(res.createdAt)}',
                        style: const TextStyle(fontSize: 12, color: AppTheme.outline),
                      ),
                    ],
                  ),
                  StatusBadge(status: res.status),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Callout Banner Catatan / Alasan Admin Dinamis (Prioritas 1)
            if (latestHistoryWithNotes.notes != null)
              _buildNotesBanner(res.status, latestHistoryWithNotes),

            // Info Jadwal & Ruangan
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    res.eventName,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    res.purpose,
                    style: const TextStyle(fontSize: 13, color: AppTheme.onSurfaceVariant, height: 1.4),
                  ),
                  const Divider(height: 24, color: Color(0xFFF3F4F6)),
                  _buildDetailRow(Icons.meeting_room_outlined, 'Ruangan', roomName),
                  const SizedBox(height: 10),
                  _buildDetailRow(Icons.calendar_today_rounded, 'Tanggal', DateFormatter.formatFullDate(res.startTime)),
                  const SizedBox(height: 10),
                  _buildDetailRow(
                    Icons.schedule_rounded,
                    'Waktu & Durasi',
                    '${DateFormatter.formatTimeRange(res.startTime, res.endTime)} (${DateFormatter.formatDuration(res.startTime, res.endTime)})',
                  ),
                  const SizedBox(height: 10),
                  _buildDetailRow(Icons.people_alt_outlined, 'Jumlah Peserta', '${res.participants} Orang'),
                  if (res.facilities.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    _buildDetailRow(Icons.extension_outlined, 'Fasilitas Tambahan', res.facilities.join(', ')),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Linimasa Riwayat Audit Dinamis (Prioritas 1)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      const Text(
                        'Linimasa Pengajuan',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.onSurface,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${res.history.length} Catatan Audit',
                          style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (res.history.isNotEmpty)
                    ...res.history.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final item = entry.value;
                      final isLast = idx == res.history.length - 1;
                      return _buildDynamicHistoryItem(item, isLast: isLast);
                    })
                  else ...[
                    _buildTimelineItem(
                      title: 'Pengajuan Diterima Sistem',
                      subtitle: 'Tiket berhasil dicatat di server database.',
                      isDone: true,
                      isLast: false,
                    ),
                    _buildTimelineItem(
                      title: 'Verifikasi Administrator',
                      subtitle: res.isPending
                          ? 'Sedang dalam antrean peninjauan oleh admin.'
                          : 'Verifikasi selesai.',
                      isDone: true,
                      isCurrent: res.isPending,
                      isLast: false,
                    ),
                    _buildTimelineItem(
                      title: res.isApproved
                          ? 'Pengajuan Disetujui'
                          : (res.isRejected
                              ? 'Pengajuan Ditolak'
                              : (res.isCancelled ? 'Pengajuan Dibatalkan' : 'Keputusan Final')),
                      subtitle: res.isApproved
                          ? 'Ruangan siap digunakan sesuai jadwal.'
                          : (res.isRejected
                              ? 'Peminjaman tidak dapat disetujui.'
                              : (res.isCancelled
                                  ? 'Dibatalkan oleh pemohon.'
                                  : 'Menunggu keputusan persetujuan.')),
                      isDone: res.isApproved || res.isRejected || res.isCancelled,
                      isCurrent: false,
                      isLast: true,
                      isError: res.isRejected,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // QR Code Check-in (Prioritas 3)
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        res.isApproved ? Icons.qr_code_scanner_rounded : Icons.lock_outline_rounded,
                        color: res.isApproved ? AppTheme.primary : AppTheme.outline,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        res.isApproved ? 'QR Code Check-in Pintu' : 'QR Code Terkunci',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.bold,
                          color: res.isApproved ? AppTheme.primary : AppTheme.outline,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (res.isApproved) ...[
                    Center(
                      child: QrImageView(
                        data: 'ROOMBOOK-${res.id}-${res.roomId}',
                        version: QrVersions.auto,
                        size: 160.0,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Pindai QR ini pada scanner pintu untuk membuka akses ruangan.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 12),
                    // Tombol Check-in Kehadiran (Prioritas 3)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: _isProcessingAction ? null : () => _handleCheckIn(res),
                        icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                        label: Text(_isProcessingAction ? 'Memproses...' : 'Simulasi Check-in Pintu'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                      ),
                    ),
                  ] else ...[
                    Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceContainerLow,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Center(
                        child: Icon(Icons.qr_code_2_rounded, size: 64, color: AppTheme.outlineVariant),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      res.isCancelled
                          ? 'Tiket ini telah dibatalkan.'
                          : (res.isRejected
                              ? 'Pengajuan tiket ini ditolak.'
                              : 'QR Code akan terbuka secara otomatis setelah disetujui oleh admin.'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 12, color: AppTheme.outline),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Tombol Batalkan Pengajuan (Prioritas 1)
            if (canCancel) ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: OutlinedButton.icon(
                  onPressed: _isProcessingAction ? null : () => _showCancelDialog(res),
                  icon: const Icon(Icons.cancel_outlined, size: 18),
                  label: Text(_isProcessingAction ? 'Memproses...' : 'Batalkan Pengajuan Ini'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppTheme.error,
                    side: const BorderSide(color: AppTheme.error),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ],
        ),
      ),
    );
  }

  /// Banner khusus untuk menampilkan catatan / alasan penolakan admin (Prioritas 1)
  Widget _buildNotesBanner(String status, ReservationHistoryItem item) {
    Color bg;
    Color border;
    Color text;
    IconData icon;
    String header;

    if (status == 'rejected') {
      bg = AppTheme.errorContainer.withOpacity(0.4);
      border = AppTheme.error.withOpacity(0.5);
      text = AppTheme.error;
      icon = Icons.cancel_rounded;
      header = 'Alasan Penolakan dari Administrator:';
    } else if (status == 'cancelled') {
      bg = const Color(0xFFF3F4F6);
      border = const Color(0xFFD1D5DB);
      text = const Color(0xFF4B5563);
      icon = Icons.info_outline_rounded;
      header = 'Keterangan Pembatalan:';
    } else {
      bg = AppTheme.successContainer.withOpacity(0.4);
      border = AppTheme.success.withOpacity(0.5);
      text = AppTheme.success;
      icon = Icons.check_circle_rounded;
      header = 'Catatan Administrator:';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: text, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  header,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: text,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  item.notes ?? '',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppTheme.onSurface,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  DateFormatter.formatShortDateTime(item.createdAt),
                  style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDynamicHistoryItem(ReservationHistoryItem item, {required bool isLast}) {
    Color color;
    IconData icon;
    String title;

    switch (item.action.toUpperCase()) {
      case 'CREATED':
        color = AppTheme.primary;
        icon = Icons.add_task_rounded;
        title = 'Pengajuan Dibuat';
        break;
      case 'APPROVED':
        color = AppTheme.success;
        icon = Icons.check_circle_rounded;
        title = 'Disetujui Administrator';
        break;
      case 'REJECTED':
        color = AppTheme.error;
        icon = Icons.cancel_rounded;
        title = 'Ditolak Administrator';
        break;
      case 'CANCELLED_BY_USER':
        color = AppTheme.outline;
        icon = Icons.remove_circle_outline_rounded;
        title = 'Dibatalkan oleh Pemohon';
        break;
      case 'CHECKED_IN':
        color = AppTheme.secondary;
        icon = Icons.qr_code_scanner_rounded;
        title = 'Check-in Kehadiran';
        break;
      case 'COMPLETED':
        color = const Color(0xFF0284C7);
        icon = Icons.task_alt_rounded;
        title = 'Selesai Digunakan';
        break;
      default:
        color = AppTheme.outlineVariant;
        icon = Icons.info_outline_rounded;
        title = item.action;
        break;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: color.withOpacity(0.15),
                border: Border.all(color: color, width: 2),
              ),
              child: Icon(icon, size: 12, color: color),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 42,
                color: const Color(0xFFE5E7EB),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.between,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: color,
                      ),
                    ),
                    Text(
                      DateFormatter.formatShortDateTime(item.createdAt),
                      style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                    ),
                  ],
                ),
                if (item.notes != null && item.notes!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    item.notes!,
                    style: const TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: AppTheme.outline),
        const SizedBox(width: 8),
        SizedBox(
          width: 120,
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, color: AppTheme.outline),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.onSurface),
          ),
        ),
      ],
    );
  }

  Widget _buildTimelineItem({
    required String title,
    required String subtitle,
    required bool isDone,
    bool isCurrent = false,
    bool isLast = false,
    bool isError = false,
  }) {
    Color iconColor;
    if (isError) {
      iconColor = AppTheme.error;
    } else if (isDone) {
      iconColor = AppTheme.success;
    } else if (isCurrent) {
      iconColor = AppTheme.secondary;
    } else {
      iconColor = AppTheme.outlineVariant;
    }

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: iconColor.withOpacity(0.15),
                border: Border.all(color: iconColor, width: 2),
              ),
              child: Icon(
                isError
                    ? Icons.close_rounded
                    : (isDone ? Icons.check_rounded : Icons.circle),
                size: 12,
                color: iconColor,
              ),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 36,
                color: const Color(0xFFE5E7EB),
              ),
          ],
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isError ? AppTheme.error : AppTheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
