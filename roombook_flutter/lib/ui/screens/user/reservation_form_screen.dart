import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/date_formatter.dart';
import '../../../data/models/room_model.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/reservation_provider.dart';
import '../../widgets/room_image.dart';
import 'reservation_detail_screen.dart';

class ReservationFormScreen extends StatefulWidget {
  final RoomModel room;

  const ReservationFormScreen({super.key, required this.room});

  @override
  State<ReservationFormScreen> createState() => _ReservationFormScreenState();
}

class _ReservationFormScreenState extends State<ReservationFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _purposeController = TextEditingController();
  final _eventNameController = TextEditingController();

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _startTime = const TimeOfDay(hour: 9, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 11, minute: 0);
  int _participants = 5;

  List<Map<String, dynamic>> _bookedSlots = [];
  bool _isLoadingSlots = false;

  final List<String> _availableFacilities = [
    'Proyektor & Kabel HDMI',
    'Microfon Wireless (2 unit)',
    'Pointer Presentasi',
    'Layanan Kebersihan Ekstra',
  ];
  final List<String> _selectedFacilities = ['Proyektor & Kabel HDMI'];

  @override
  void initState() {
    super.initState();
    _participants = widget.room.capacity >= 5 ? 5 : widget.room.capacity;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSchedule();
    });
  }

  @override
  void dispose() {
    _purposeController.dispose();
    _eventNameController.dispose();
    super.dispose();
  }

  /// Memuat jadwal terisi pada tanggal yang dipilih (Prioritas 2)
  Future<void> _loadSchedule() async {
    setState(() => _isLoadingSlots = true);
    try {
      final resProvider = Provider.of<ReservationProvider>(context, listen: false);
      final slots = await resProvider.loadRoomSchedule(widget.room.id, _selectedDate);
      if (mounted) {
        setState(() {
          _bookedSlots = slots;
          _isLoadingSlots = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoadingSlots = false);
    }
  }

  Future<void> _selectDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 90)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadSchedule();
    }
  }

  Future<void> _selectStartTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _startTime,
    );
    if (picked != null) {
      setState(() => _startTime = picked);
    }
  }

  Future<void> _selectEndTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _endTime,
    );
    if (picked != null) {
      setState(() => _endTime = picked);
    }
  }

  /// Memeriksa apakah pilihan jam bertabrakan dengan jadwal aktif di server
  Map<String, dynamic>? get _conflictingSlot {
    final startDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _startTime.hour,
      _startTime.minute,
    );
    final endDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _endTime.hour,
      _endTime.minute,
    );

    for (final slot in _bookedSlots) {
      final slotStart = DateTime.parse(slot['start_time']).toLocal();
      final slotEnd = DateTime.parse(slot['end_time']).toLocal();

      // Overlap: start < slotEnd AND end > slotStart
      if (startDateTime.isBefore(slotEnd) && endDateTime.isAfter(slotStart)) {
        return slot;
      }
    }
    return null;
  }

  void _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final startDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _startTime.hour,
      _startTime.minute,
    );

    final endDateTime = DateTime(
      _selectedDate.year,
      _selectedDate.month,
      _selectedDate.day,
      _endTime.hour,
      _endTime.minute,
    );

    // Validasi 1: Jam selesai > jam mulai
    if (endDateTime.isBefore(startDateTime) || endDateTime.isAtSameMomentAs(startDateTime)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Jam selesai harus lebih besar daripada jam mulai.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    // Validasi 2: Jam operasional (07:00 - 21:00 WIB)
    if (_startTime.hour < 7 || _endTime.hour > 21 || (_endTime.hour == 21 && _endTime.minute > 0)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Jam operasional peminjaman gedung adalah 07:00 - 21:00 WIB.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    // Validasi 3: Waktu masa lalu di hari yang sama
    final now = DateTime.now();
    if (startDateTime.isBefore(now.subtract(const Duration(minutes: 5)))) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Waktu mulai tidak boleh berada di masa lalu.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    // Validasi 4: Peringatan bentrok jadwal
    final conflict = _conflictingSlot;
    if (conflict != null) {
      final conflictStart = DateTime.parse(conflict['start_time']).toLocal();
      final conflictEnd = DateTime.parse(conflict['end_time']).toLocal();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Jadwal bentrok dengan "${conflict['event_name'] ?? 'Reservasi Lain'}" (${DateFormatter.formatTimeRange(conflictStart, conflictEnd)}). Silakan pilih jam lain.',
          ),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final resProvider = Provider.of<ReservationProvider>(context, listen: false);

    if (authProvider.profile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Silakan login terlebih dahulu untuk mengajukan peminjaman.'),
          backgroundColor: AppTheme.error,
        ),
      );
      return;
    }

    try {
      final created = await resProvider.createReservation(
        room: widget.room,
        user: authProvider.profile!,
        eventName: _eventNameController.text.trim().isNotEmpty
            ? _eventNameController.text.trim()
            : _purposeController.text.trim(),
        purpose: _purposeController.text.trim(),
        startTime: startDateTime,
        endTime: endDateTime,
        participants: _participants,
        facilities: _selectedFacilities,
      );

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Pengajuan #${created.displayId} berhasil tersimpan di Supabase!'),
          backgroundColor: AppTheme.success,
        ),
      );

      // Beralih ke halaman detail reservasi
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => ReservationDetailScreen(reservationId: created.id),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Gagal mengajukan reservasi: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final resProvider = Provider.of<ReservationProvider>(context);
    final conflict = _conflictingSlot;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: const Text('Formulir Reservasi'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Ringkasan Ruangan Terpilih
              Container(
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
                        imageUrl: widget.room.imageUrl,
                        width: 60,
                        height: 60,
                        fit: BoxFit.cover,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.room.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: AppTheme.onSurface,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Kapasitas Maksimal: ${widget.room.capacity} Orang • ${widget.room.floor}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Pilih Tanggal
              const Text(
                'Tanggal Peminjaman',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
              ),
              const SizedBox(height: 8),
              InkWell(
                onTap: _selectDate,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.calendar_today_rounded, size: 18, color: AppTheme.primary),
                          const SizedBox(width: 10),
                          Text(
                            DateFormatter.formatFullDate(_selectedDate),
                            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const Icon(Icons.arrow_drop_down, color: AppTheme.outline),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),

              // Visual Slot Ketersediaan Jam (Prioritas 2)
              _buildScheduleVisualizer(),
              const SizedBox(height: 18),

              // Pilih Rentang Jam
              const Text(
                'Waktu Pemakaian',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _selectStartTime,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: conflict != null ? AppTheme.error : const Color(0xFFE5E7EB),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Jam Mulai', style: TextStyle(fontSize: 11, color: AppTheme.outline)),
                            const SizedBox(height: 4),
                            Text(
                              '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')} WIB',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(Icons.arrow_forward_rounded, size: 18, color: AppTheme.outline),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: _selectEndTime,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: conflict != null ? AppTheme.error : const Color(0xFFE5E7EB),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('Jam Selesai', style: TextStyle(fontSize: 11, color: AppTheme.outline)),
                            const SizedBox(height: 4),
                            Text(
                              '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')} WIB',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Indikator Status Bentrok / Aman
              if (conflict != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: AppTheme.errorContainer.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.error.withOpacity(0.5)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, size: 18, color: AppTheme.error),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Slot waktu bertabrakan dengan "${conflict['event_name'] ?? 'Jadwal Aktif'}". Silakan geser jam mulai atau jam selesai.',
                          style: const TextStyle(fontSize: 12, color: AppTheme.error, fontWeight: FontWeight.w500),
                        ),
                      ),
                    ],
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.successContainer.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.check_circle_rounded, size: 16, color: AppTheme.success),
                      SizedBox(width: 6),
                      Text(
                        'Slot waktu tersedia dan siap dipesan.',
                        style: TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 20),

              // Jumlah Peserta (Stepper)
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Jumlah Peserta',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
                      ),
                      Text(
                        'Maksimal ${widget.room.capacity} orang',
                        style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                      ),
                    ],
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE5E7EB)),
                    ),
                    child: Row(
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove, size: 18),
                          onPressed: _participants > 1 ? () => setState(() => _participants--) : null,
                        ),
                        Text(
                          '$_participants',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add, size: 18),
                          onPressed: _participants < widget.room.capacity
                              ? () => setState(() => _participants++)
                              : null,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Nama Agenda / Kegiatan
              const Text(
                'Nama Kegiatan / Agenda',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _eventNameController,
                decoration: const InputDecoration(
                  hintText: 'Misal: Rapat Koordinasi Anggaran Divisi',
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Nama agenda wajib diisi.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Deskripsi & Tujuan Peminjaman
              const Text(
                'Tujuan / Deskripsi Peminjaman',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _purposeController,
                maxLines: 3,
                decoration: const InputDecoration(
                  hintText: 'Jelaskan keperluan pemakaian ruangan...',
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return 'Tujuan peminjaman wajib diisi.';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Fasilitas Tambahan
              const Text(
                'Fasilitas Tambahan',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
              ),
              const SizedBox(height: 8),
              ..._availableFacilities.map((facility) {
                final isChecked = _selectedFacilities.contains(facility);
                return CheckboxListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(facility, style: const TextStyle(fontSize: 13)),
                  value: isChecked,
                  activeColor: AppTheme.primary,
                  onChanged: (val) {
                    setState(() {
                      if (val == true) {
                        _selectedFacilities.add(facility);
                      } else {
                        _selectedFacilities.remove(facility);
                      }
                    });
                  },
                );
              }),
              const SizedBox(height: 24),

              // Tombol Submit
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  onPressed: resProvider.isLoading || conflict != null ? null : _submit,
                  child: resProvider.isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Kirim Pengajuan Reservasi'),
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  /// Komponen Visualisasi Jadwal Terisi Ruangan (Prioritas 2)
  Widget _buildScheduleVisualizer() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              const Row(
                children: [
                  Icon(Icons.access_time_filled_rounded, size: 16, color: AppTheme.primary),
                  SizedBox(width: 6),
                  Text(
                    'Jadwal Terisi Hari Tersebut',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppTheme.onSurface),
                  ),
                ],
              ),
              if (_isLoadingSlots)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                )
              else
                Text(
                  '${_bookedSlots.length} Jadwal Aktif',
                  style: const TextStyle(fontSize: 11, color: AppTheme.outline),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (_bookedSlots.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_outline_rounded, size: 16, color: AppTheme.success),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Ruangan masih kosong sepanjang hari ini (07:00 - 21:00 WIB). Bebas memilih jam.',
                      style: TextStyle(fontSize: 12, color: AppTheme.onSurfaceVariant),
                    ),
                  ),
                ],
              ),
            )
          else
            Column(
              children: _bookedSlots.map((slot) {
                final slotStart = DateTime.parse(slot['start_time']).toLocal();
                final slotEnd = DateTime.parse(slot['end_time']).toLocal();
                final status = slot['status']?.toString() ?? 'approved';
                final isApproved = status == 'approved';

                return Container(
                  margin: const EdgeInsets.only(bottom: 6),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: isApproved ? AppTheme.primaryContainer.withOpacity(0.12) : AppTheme.warningContainer.withOpacity(0.4),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isApproved ? AppTheme.primary.withOpacity(0.3) : AppTheme.warning.withOpacity(0.4),
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.between,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isApproved ? Icons.lock_clock_rounded : Icons.hourglass_top_rounded,
                            size: 14,
                            color: isApproved ? AppTheme.primary : AppTheme.warning,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            DateFormatter.formatTimeRange(slotStart, slotEnd),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: isApproved ? AppTheme.primary : AppTheme.warning,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            slot['event_name'] ?? 'Agenda',
                            style: const TextStyle(fontSize: 12, color: AppTheme.onSurface),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isApproved ? AppTheme.primary : AppTheme.warning,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          isApproved ? 'Terisi' : 'Pending',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }
}
