import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/reservation_model.dart';
import '../../../providers/reservation_provider.dart';

/// Halaman Scanner & Validasi QR Code Pintu (Prioritas 3)
class AdminQrScannerScreen extends StatefulWidget {
  const AdminQrScannerScreen({super.key});

  @override
  State<AdminQrScannerScreen> createState() => _AdminQrScannerScreenState();
}

class _AdminQrScannerScreenState extends State<AdminQrScannerScreen> {
  final _codeController = TextEditingController();
  bool _isLoading = false;
  ReservationModel? _verifiedReservation;
  String? _statusMessage;
  bool _isSuccess = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  /// Mengekstrak ID Reservasi dari string QR Code: 'ROOMBOOK-14-2' atau 'RB-14' atau '14'
  int? _parseReservationId(String input) {
    final clean = input.trim().toUpperCase();
    if (clean.startsWith('ROOMBOOK-')) {
      final parts = clean.split('-');
      if (parts.length >= 2) return int.tryParse(parts[1]);
    }
    if (clean.startsWith('RB-')) {
      return int.tryParse(clean.replaceFirst('RB-', ''));
    }
    return int.tryParse(clean);
  }

  Future<void> _verifyAndCheckIn([String? codeToVerify]) async {
    final code = codeToVerify ?? _codeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Masukkan atau pindai kode QR tiket terlebih dahulu.')),
      );
      return;
    }

    final resId = _parseReservationId(code);
    if (resId == null) {
      setState(() {
        _isSuccess = false;
        _statusMessage = 'Format kode tiket tidak valid. Format yang benar: "RB-XX" atau "ROOMBOOK-XX-YY".';
        _verifiedReservation = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = null;
      _verifiedReservation = null;
    });

    try {
      final resProvider = Provider.of<ReservationProvider>(context, listen: false);

      // Ambil data detail tiket
      final detail = await resProvider.getReservationDetail(resId);
      _verifiedReservation = detail;

      if (!detail.isApproved) {
        setState(() {
          _isSuccess = false;
          _statusMessage = 'Tiket #${detail.displayId} belum disetujui admin (Status: "${detail.status}"). Akses pintu ditolak.';
          _isLoading = false;
        });
        return;
      }

      // Jalankan proses check-in
      final checkInResult = await resProvider.checkIn(detail.id, qrCode: code);

      setState(() {
        _isSuccess = true;
        _statusMessage = checkInResult['message']?.toString() ??
            'Verifikasi Berhasil! Pintu ruangan siap diakses untuk kegiatan "${detail.eventName}".';
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isSuccess = false;
        _statusMessage = 'Verifikasi Gagal: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: const Text('Validasi & Scan QR Pintu'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Viewfinder Simulasi Scanner
            Container(
              height: 200,
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 10, offset: const Offset(0, 4)),
                ],
              ),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Laser Line
                  Container(
                    width: 180,
                    height: 180,
                    decoration: BoxDecoration(
                      border: Border.all(color: AppTheme.secondary, width: 2),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.qr_code_scanner_rounded, size: 64, color: Colors.white.withOpacity(0.85)),
                          const SizedBox(height: 8),
                          Text(
                            'Arahkan Scanner ke QR Tiket',
                            style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Input Kode Tiket Manual
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
                  const Text(
                    'Input Manual / Simulasi Scan QR',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Masukkan string QR Code (misal: "ROOMBOOK-1-1" atau nomor tiket "RB-1"):',
                    style: TextStyle(fontSize: 12, color: AppTheme.outline),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _codeController,
                          decoration: const InputDecoration(
                            hintText: 'ROOMBOOK-1-1 atau RB-1',
                            prefixIcon: Icon(Icons.qr_code_2_rounded),
                          ),
                          onSubmitted: (v) => _verifyAndCheckIn(),
                        ),
                      ),
                      const SizedBox(width: 10),
                      ElevatedButton(
                        onPressed: _isLoading ? null : () => _verifyAndCheckIn(),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
                        ),
                        child: _isLoading
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Verifikasi'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Hasil Verifikasi
            if (_statusMessage != null)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _isSuccess ? AppTheme.successContainer.withOpacity(0.4) : AppTheme.errorContainer.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _isSuccess ? AppTheme.success.withOpacity(0.5) : AppTheme.error.withOpacity(0.5)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      _isSuccess ? Icons.check_circle_rounded : Icons.error_outline_rounded,
                      color: _isSuccess ? AppTheme.success : AppTheme.error,
                      size: 24,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isSuccess ? 'Tiket Valid & Terverifikasi' : 'Verifikasi Gagal',
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: _isSuccess ? AppTheme.success : AppTheme.error,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _statusMessage!,
                            style: const TextStyle(fontSize: 13, height: 1.35),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            // Card Detail Tiket Terverifikasi
            if (_verifiedReservation != null) ...[
              const SizedBox(height: 16),
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
                        Text(
                          _verifiedReservation!.displayId,
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 16),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: AppTheme.successContainer,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Text('AKSES DIIZINKAN', style: TextStyle(color: AppTheme.success, fontSize: 11, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _verifiedReservation!.eventName,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Ruangan: ${_verifiedReservation!.room?.name ?? "Ruangan #${_verifiedReservation!.roomId}"}',
                      style: const TextStyle(fontSize: 13, color: AppTheme.onSurfaceVariant),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Jadwal: ${DateFormatter.formatFullDate(_verifiedReservation!.startTime)} • ${DateFormatter.formatTimeRange(_verifiedReservation!.startTime, _verifiedReservation!.endTime)}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.secondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Peserta: ${_verifiedReservation!.participants} Orang',
                      style: const TextStyle(fontSize: 12, color: AppTheme.outline),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

