import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// Badge Status Reservasi (Pending / Disetujui / Ditolak)
class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color text;
    String label;
    IconData icon;

    switch (status.toLowerCase()) {
      case 'approved':
        bg = AppTheme.successContainer;
        text = AppTheme.success;
        label = 'Disetujui';
        icon = Icons.check_circle_rounded;
        break;
      case 'rejected':
        bg = AppTheme.errorContainer;
        text = AppTheme.error;
        label = 'Ditolak';
        icon = Icons.cancel_rounded;
        break;
      case 'cancelled':
        bg = const Color(0xFFF3F4F6);
        text = const Color(0xFF6B7280);
        label = 'Dibatalkan';
        icon = Icons.remove_circle_outline_rounded;
        break;
      case 'completed':
        bg = const Color(0xFFE0F2FE);
        text = const Color(0xFF0369A1);
        label = 'Selesai';
        icon = Icons.task_alt_rounded;
        break;
      case 'pending':
      default:
        bg = AppTheme.warningContainer;
        text = AppTheme.warning;
        label = 'Menunggu';
        icon = Icons.schedule_rounded;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: text),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: text,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

