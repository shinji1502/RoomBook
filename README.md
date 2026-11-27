# RoomBook — Sistem Pemesanan & Manajemen Ruangan

Aplikasi pemesanan dan pengelolaan jadwal ruangan kampus & kantor berbasis **Web (Vanilla JS + Tailwind CSS)** dan **Mobile (Flutter)** yang terintegrasi dengan **Supabase Cloud (PostgreSQL, Auth, Storage, & Realtime)**.

---

## 📁 Struktur Repositori

- **`stitch_room_booking_app_frontend/`** — Aplikasi Web SPA (Portal User & Portal Admin) beserta skrip migrasi SQL & RLS Supabase (`supabase_auth_rls.sql`, `supabase_reservations_rls.sql`, `supabase_migration_v2.sql`, `supabase_migration_v3.sql`, `supabase_migration_v4.sql`).
- **`roombook_flutter/`** — Aplikasi Mobile Flutter (`Android` & `Web`).
- **`server.js`** — Server HTTP lokal ringan (port `3000`) untuk menjalankan aplikasi web.
- **`scratch/`** — Skrip verifikasi integrasi RPC frontend-backend.

---

## ✨ Fitur Utama

### Portal Pengguna (User)
- Autentikasi akun via Supabase Auth (Daftar & Masuk).
- Daftar & detail ruangan real-time (otomatis ter-update saat Admin menambah atau menghapus ruangan).
- Formulir reservasi aman anti-bentrok jadwal (`create_reservation_safe`) dan validasi kapasitas.
- Riwayat reservasi, pembatalan pengajuan, catatan/alasan persetujuan admin, dan QR Code check-in.

### Portal Administrator (Admin)
- Dashboard ringkasan status & antrean permohonan masuk.
- Persetujuan (`approved`) dan penolakan (`rejected`) reservasi dengan catatan/alasan via RPC `update_reservation_status_safe`.
- **Tambah Ruangan Baru** dengan upload foto langsung ke Supabase Storage (`room-images`).
- **Hapus Ruangan** dengan proteksi jadwal aktif (`admin_delete_room`).

---

## 🚀 Cara Menjalankan Aplikasi Web Lokal

1. Pastikan **Node.js** sudah terinstal, lalu instal dependensi (jika perlu):
   ```bash
   npm install
   ```
2. Jalankan server lokal:
   ```bash
   node server.js
   ```
3. Buka browser dan akses **`http://localhost:3000`**.

---

## 🗄️ Setup Database Supabase

Jalankan file migrasi SQL berikut secara berurutan di **SQL Editor** Supabase Dashboard:
1. `stitch_room_booking_app_frontend/supabase_auth_rls.sql`
2. `stitch_room_booking_app_frontend/supabase_reservations_rls.sql`
3. `stitch_room_booking_app_frontend/supabase_migration_v2.sql`
4. `stitch_room_booking_app_frontend/supabase_migration_v3.sql`
5. `stitch_room_booking_app_frontend/supabase_migration_v4.sql`
