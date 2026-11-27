# RoomBook Mobile (Flutter App)

Aplikasi mobile pemesanan dan manajemen jadwal ruangan kampus & kantor **RoomBook** yang dibangun menggunakan **Flutter** dan terintegrasi langsung ke backend **Supabase Cloud (PostgreSQL)**.

---

## 📱 Fitur Utama Aplikasi Mobile

### Prioritas 1: Kritis & User Experience (UX)
1. **Pembatalan Tiket oleh Pemohon (*User Cancellation*):**
   - Pemohon dapat membatalkan pengajuan yang masih berstatus `pending` langsung dari halaman Detail Reservasi atau Riwayat.
   - Status diperbarui menjadi `cancelled` dan dicatat ke `reservation_history` dengan aksi `CANCELLED_BY_USER`.
2. **Linimasa Riwayat Audit & Alasan Admin Dinamis:**
   - Seluruh linimasa status tiket diambil dinamis dari tabel `public.reservation_history`.
   - Catatan alasan penolakan atau instruksi persetujuan dari admin ditampilkan secara jelas pada banner khusus tiket.
3. **Konfigurasi Lingkungan Aman (`.env`):**
   - Kredensial URL dan Anon Key Supabase mendukung environment override via `--dart-define` dan template `.env.example`.

### Prioritas 2: Siklus Status, Visualisasi Jadwal & Realtime
1. **Siklus Status Lengkap:**
   - Mendukung status `pending`, `approved`, `rejected`, `cancelled`, dan `completed`.
2. **Visual Ketersediaan Slot Waktu (*Time-Slot Visualizer*):**
   - Pada formulir pemesanan, pengguna dapat melihat visualisasi jadwal terisi pada ruangan & tanggal yang dipilih.
   - Dilengkapi validasi bentrok (*anti-conflict*), jam operasional gedung (07:00 - 21:00 WIB), dan pencegahan memilih jam masa lalu.
3. **Sinkronisasi Supabase Realtime:**
   - Mendengarkan perubahan data tabel `reservations` secara langsung melalui WebSocket Supabase channel.

### Prioritas 3: QR Scanner Check-in & Manajemen Admin
1. **Validasi & Scanner QR Code Pintu:**
   - Halaman scanner QR & input cepat kode tiket (`ROOMBOOK-XX-YY` atau `RB-XX`) untuk memvalidasi izin akses pintu ruangan.
   - Menjalankan RPC `check_in_reservation_safe` untuk mencatat kehadiran pemohon.
2. **Manajemen Ruangan Khusus Admin (*Room Management CRUD*):**
   - Administrator dapat menambah ruangan baru, mengedit kapasitas/lokasi lantai/fasilitas/foto ruangan, serta menghapus ruangan langsung dari aplikasi.
3. **Dashboard Admin Terintegrasi:**
   - Dilengkapi tab filter (Menunggu, Disetujui, Ditolak/Batal, Semua), metrik statistik, dan akses langsung ke detail permohonan.

---

## 🛠️ Struktur Proyek

```text
roombook_flutter/
├── .env.example                        # Template environment variabel
├── pubspec.yaml
├── lib/
│   ├── main.dart                       # Entry point aplikasi & AuthWrapper
│   ├── core/
│   │   ├── constants/
│   │   │   └── supabase_config.dart    # URL & Anon Key Supabase (support --dart-define)
│   │   ├── theme/
│   │   │   └── app_theme.dart          # Tema Material 3 & Palet Warna Stitch
│   │   └── utils/
│   │       └── date_formatter.dart     # Formatter tanggal & jam WIB
│   ├── data/
│   │   ├── models/
│   │   │   ├── reservation_model.dart  # Model Reservasi & Riwayat Audit
│   │   │   ├── room_model.dart         # Model Ruangan
│   │   │   └── user_profile_model.dart # Model Profil Pengguna & Role
│   │   └── services/
│   │       ├── auth_service.dart       # Layanan Auth Supabase
│   │       ├── reservation_service.dart# Layanan RPC Reservasi, Check-in & Schedule
│   │       └── room_service.dart       # Layanan CRUD Ruangan
│   ├── providers/
│   │   ├── auth_provider.dart          # State Management Autentikasi
│   │   ├── reservation_provider.dart   # State Management Reservasi & Realtime
│   │   └── room_provider.dart          # State Management Ruangan & CRUD
│   └── ui/
│       ├── screens/
│       │   ├── auth/
│       │   │   └── login_screen.dart
│       │   ├── user/
│       │   │   ├── home_screen.dart
│       │   │   ├── room_detail_screen.dart
│       │   │   ├── reservation_form_screen.dart # Form dengan Visual Slot Waktu
│       │   │   ├── reservation_detail_screen.dart # Detail dengan Tombol Batal & Check-in
│       │   │   ├── history_screen.dart
│       │   │   ├── profile_screen.dart
│       │   │   └── user_main_nav.dart
│       │   └── admin/
│       │       ├── admin_dashboard_screen.dart   # Dashboard & Antrean Persetujuan
│       │       ├── admin_room_management_screen.dart # CRUD Ruangan
│       │       └── admin_qr_scanner_screen.dart  # Validasi QR Pintu
│       └── widgets/
│           ├── room_card.dart
│           ├── reservation_card.dart
│           └── status_badge.dart
└── test/
    └── widget_test.dart
```

---

## 🗄️ Menjalankan Skrip Migrasi Database (Supabase SQL)

Buka **SQL Editor** pada Supabase Dashboard Anda, lalu jalankan secara berurutan:
1. `stitch_room_booking_app_frontend/supabase_auth_rls.sql`
2. `stitch_room_booking_app_frontend/supabase_migration_v2.sql`
3. `stitch_room_booking_app_frontend/supabase_migration_v3.sql` *(Pembaruan status `cancelled`, check-in, jadwal visual, dan CRUD ruangan admin)*.

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Mengambil Dependensi
Masuk ke folder `roombook_flutter`:
```bash
cd roombook_flutter
flutter pub get
```

### 2. Menjalankan Aplikasi
```bash
# Di HP Android / Emulator:
flutter run

# Di Web Browser:
flutter run -d chrome

# Dengan environment override:
flutter run --dart-define=SUPABASE_URL=https://... --dart-define=SUPABASE_ANON_KEY=sb_...
```
