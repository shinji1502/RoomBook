import 'package:intl/intl.dart';

/// Helper formatting tanggal & jam dengan zona waktu WIB (UTC+7)
class DateFormatter {
  static const List<String> indonesianDays = [
    'Senin',
    'Selasa',
    'Rabu',
    'Kamis',
    'Jumat',
    'Sabtu',
    'Minggu'
  ];

  static const List<String> indonesianMonths = [
    'Januari',
    'Februari',
    'Maret',
    'April',
    'Mei',
    'Juni',
    'Juli',
    'Agustus',
    'September',
    'Oktober',
    'November',
    'Desember'
  ];

  /// Mengonversi DateTime ke zona waktu WIB (UTC+7)
  static DateTime toWib(DateTime dt) {
    return dt.toUtc().add(const Duration(hours: 7));
  }

  /// Format: "Senin, 24 Oktober 2026"
  static String formatFullDate(DateTime dt) {
    final wib = toWib(dt);
    final dayName = indonesianDays[wib.weekday - 1];
    final monthName = indonesianMonths[wib.month - 1];
    return '$dayName, ${wib.day} $monthName ${wib.year}';
  }

  /// Format: "09:00 - 11:00 WIB"
  static String formatTimeRange(DateTime start, DateTime end) {
    final wibStart = toWib(start);
    final wibEnd = toWib(end);
    final f = DateFormat('HH:mm');
    return '${f.format(wibStart)} - ${f.format(wibEnd)} WIB';
  }

  /// Format durasi: "2 Jam" atau "45 Menit"
  static String formatDuration(DateTime start, DateTime end) {
    final diff = end.difference(start);
    final hours = diff.inHours;
    final minutes = diff.inMinutes % 60;
    if (hours > 0 && minutes > 0) {
      return '$hours Jam $minutes Menit';
    } else if (hours > 0) {
      return '$hours Jam';
    } else {
      return '$minutes Menit';
    }
  }

  /// Format tanggal singkat: "24 Okt 2026, 10:30 WIB"
  static String formatShortDateTime(DateTime dt) {
    final wib = toWib(dt);
    final monthName = indonesianMonths[wib.month - 1].substring(0, 3);
    final fTime = DateFormat('HH:mm');
    return '${wib.day} $monthName ${wib.year}, ${fTime.format(wib)} WIB';
  }
}

