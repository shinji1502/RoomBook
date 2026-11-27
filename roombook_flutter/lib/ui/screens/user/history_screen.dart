import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../providers/auth_provider.dart';
import '../../../providers/reservation_provider.dart';
import '../widgets/reservation_card.dart';
import 'reservation_detail_screen.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refresh();
      final auth = Provider.of<AuthProvider>(context, listen: false);
      Provider.of<ReservationProvider>(context, listen: false).initRealtimeSubscription(
        isAdmin: auth.isAdmin,
        currentUserId: auth.profile?.id,
      );
    });
  }

  Future<void> _refresh() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final res = Provider.of<ReservationProvider>(context, listen: false);
    await res.loadReservations(
      isAdmin: auth.isAdmin,
      currentUserId: auth.profile?.id,
    );
  }

  @override
  Widget build(BuildContext context) {
    final resProvider = Provider.of<ReservationProvider>(context);
    final filtered = resProvider.filteredReservations;

    return Scaffold(
      backgroundColor: AppTheme.surface,
      appBar: AppBar(
        title: const Text('Riwayat Reservasi'),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Segarkan',
            onPressed: _refresh,
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Tabs (Scrollable Horizontal)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildFilterTab('Semua', 'all', resProvider),
                  const SizedBox(width: 8),
                  _buildFilterTab('Menunggu', 'pending', resProvider),
                  const SizedBox(width: 8),
                  _buildFilterTab('Disetujui', 'approved', resProvider),
                  const SizedBox(width: 8),
                  _buildFilterTab('Ditolak', 'rejected', resProvider),
                  const SizedBox(width: 8),
                  _buildFilterTab('Dibatalkan', 'cancelled', resProvider),
                ],
              ),
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE5E7EB)),

          // Daftar Reservasi
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refresh,
              color: AppTheme.primary,
              child: resProvider.isLoading && resProvider.reservations.isEmpty
                  ? const Center(
                      child: CircularProgressIndicator(color: AppTheme.primary),
                    )
                  : filtered.isEmpty
                      ? Center(
                          child: SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            child: Padding(
                              padding: const EdgeInsets.all(40),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.event_busy_rounded, size: 56, color: AppTheme.outline),
                                  const SizedBox(height: 14),
                                  const Text(
                                    'Belum Ada Reservasi',
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                      color: AppTheme.onSurface,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    resProvider.activeFilter == 'all'
                                        ? 'Pengajuan ruangan yang Anda buat akan muncul pada daftar riwayat ini.'
                                        : 'Tidak ada tiket dengan status "${resProvider.activeFilter}".',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(color: AppTheme.outline, fontSize: 13),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final item = filtered[index];
                            return ReservationCard(
                              reservation: item,
                              onTap: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ReservationDetailScreen(reservationId: item.id),
                                  ),
                                );
                                _refresh();
                              },
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTab(String label, String value, ReservationProvider provider) {
    final isSelected = provider.activeFilter == value;
    return GestureDetector(
      onTap: () => provider.setFilter(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primary : AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : AppTheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
