-- =========================================================================
-- ROOMBOOK: SKRIP MODUL 2 — KEAMANAN RESERVASI, WORKFLOW RPC, & AUDIT HISTORY
-- =========================================================================
-- File: supabase_reservations_rls.sql
-- Urutan Eksekusi: LANGKAH 2 (Jalankan file ini SETELAH supabase_auth_rls.sql)
-- Karakteristik: Idempotent — aman dijalankan berulang tanpa merusak data
--
-- FUNGSI SKRIP INI:
-- 1. Mengaktifkan Row Level Security (RLS) pada reservations & reservation_history.
-- 2. Menerapkan Arsitektur ZERO DIRECT MUTATION: authenticated hanya boleh SELECT.
--    Semua operasi INSERT, UPDATE, DELETE pada reservasi WAJIB melalui fungsi RPC.
-- 3. Mengamankan tabel rooms (read-only untuk pengguna umum).
-- 4. Mengunci hak akses sequence tabel agar tidak dapat dimanipulasi langsung.
-- 5. Memasang fungsi RPC create_reservation_safe dengan anti-overlap & locking ruangan.
-- 6. Memasang fungsi RPC update_reservation_status_safe dengan locking konsisten & double-approval check.
-- 7. Seluruh fungsi SECURITY DEFINER menggunakan search_path = pg_catalog, public, pg_temp.
-- =========================================================================

-- =========================================================================
-- BAGIAN 1: STRUKTUR TABEL & AKTIFKAN RLS
-- =========================================================================
-- Pastikan kolom formulir lengkap tersedia pada tabel reservations
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS event_name text;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS participants integer DEFAULT 1;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS facilities text[] DEFAULT '{}';

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_history ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- BAGIAN 2: CABUT HAK AKSES BERLEBIH PADA SCHEMA, TABEL, & SEQUENCE
-- =========================================================================
-- 2a. Batasi hak pada schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM anon, authenticated, PUBLIC;

-- 2b. Pastikan tabel rooms bersifat read-only untuk anon dan authenticated
GRANT SELECT ON TABLE public.rooms TO anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.rooms FROM anon, authenticated;

-- 2c. Cabut SEMUA hak mutasi langsung pada tabel reservations
REVOKE ALL ON TABLE public.reservations FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reservations FROM authenticated;
GRANT SELECT ON TABLE public.reservations TO authenticated;

-- 2d. Cabut SEMUA hak mutasi langsung pada tabel reservation_history
REVOKE ALL ON TABLE public.reservation_history FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.reservation_history FROM authenticated;
GRANT SELECT ON TABLE public.reservation_history TO authenticated;

-- 2e. Cabut hak pada sequence tabel reservations & reservation_history
--     (Fungsi RPC SECURITY DEFINER tetap dapat mengakses via hak pemilik fungsi)
DO $$
DECLARE
  v_seq_res text;
  v_seq_hist text;
BEGIN
  v_seq_res := pg_get_serial_sequence('public.reservations', 'id');
  IF v_seq_res IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated;', v_seq_res);
  END IF;

  v_seq_hist := pg_get_serial_sequence('public.reservation_history', 'id');
  IF v_seq_hist IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated;', v_seq_hist);
  END IF;
END $$;


-- =========================================================================
-- BAGIAN 3: DEFINISI KONSISTEN is_admin() (SECURITY DEFINER)
-- =========================================================================
-- Memastikan fungsi is_admin() terdefinisi secara identik dengan supabase_auth_rls.sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- =========================================================================
-- BAGIAN 4: KEBIJAKAN RLS TABEL RESERVATIONS (HANYA SELECT)
-- =========================================================================
-- Bersihkan SEMUA policy lama pada reservations secara dinamis
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reservations'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Pemilik reservasi membaca reservasinya sendiri, admin membaca seluruh reservasi
CREATE POLICY "Users can view own reservations or admin can view all"
ON public.reservations
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR
  public.is_admin()
);


-- =========================================================================
-- BAGIAN 5: KEBIJAKAN RLS TABEL RESERVATION_HISTORY (HANYA SELECT)
-- =========================================================================
-- Bersihkan SEMUA policy lama pada reservation_history secara dinamis
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reservation_history'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Pemilik reservasi membaca riwayat reservasi miliknya, admin membaca seluruh riwayat
CREATE POLICY "Users can view history of their reservations or admin can view all"
ON public.reservation_history
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR
  EXISTS (
    SELECT 1 FROM public.reservations r
    WHERE r.id = reservation_history.reservation_id
      AND r.user_id = auth.uid()
  )
);


-- =========================================================================
-- BAGIAN 6: FUNGSI RPC — create_reservation_safe
-- =========================================================================
-- Menjamin atomisitas, validasi otorisasi, validasi waktu, validasi kapasitas,
-- dan pencegahan overlap jadwal pada level database.
-- Urutan locking:
--   1. Kunci baris ruangan terkait (public.rooms FOR UPDATE)
--   2. Validasi jumlah peserta vs kapasitas maksimal ruangan
--   3. Periksa jadwal yang bertabrakan (status 'pending' atau 'approved')
--   4. Simpan reservasi baru berstatus 'pending' beserta metadata lengkap
--   5. Catat riwayat audit 'CREATED'

DROP FUNCTION IF EXISTS public.create_reservation_safe(bigint, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.create_reservation_safe(integer, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.create_reservation_safe(bigint, text, timestamptz, timestamptz, text, integer, text[]);
DROP FUNCTION IF EXISTS public.create_reservation_safe(bigint, text, text, timestamptz, timestamptz, integer, text[]);

CREATE OR REPLACE FUNCTION public.create_reservation_safe(
  p_room_id bigint,
  p_event_name text,
  p_purpose text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_participants integer DEFAULT NULL,
  p_facilities text[] DEFAULT '{}'
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_room_name text;
  v_room_capacity integer;
  v_has_conflict boolean;
  v_new_reservation_id bigint;
  v_result jsonb;
  v_clean_event_name text;
  v_clean_purpose text;
  v_now timestamptz;
BEGIN
  -- 1. Verifikasi identitas pemohon dari sesi Supabase Auth (JWT)
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login untuk melakukan reservasi ruangan.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validasi parameter waktu
  IF p_start_time IS NULL OR p_end_time IS NULL THEN
    RAISE EXCEPTION 'Waktu mulai dan waktu selesai wajib diisi.'
      USING ERRCODE = '22023';
  END IF;

  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'Waktu mulai harus lebih awal daripada waktu selesai.'
      USING ERRCODE = '22023';
  END IF;

  -- Toleransi 10 menit untuk mengantisipasi latensi jaringan browser-server
  v_now := pg_catalog.clock_timestamp();
  IF p_start_time < (v_now - INTERVAL '10 minutes') THEN
    RAISE EXCEPTION 'Waktu mulai tidak boleh berada di masa lalu.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Validasi agenda / tujuan peminjaman
  IF p_purpose IS NULL OR pg_catalog.btrim(p_purpose) = '' THEN
    RAISE EXCEPTION 'Tujuan atau agenda peminjaman ruangan wajib diisi.'
      USING ERRCODE = '22023';
  END IF;

  v_clean_purpose := pg_catalog.btrim(p_purpose);
  IF pg_catalog.length(v_clean_purpose) > 500 THEN
    RAISE EXCEPTION 'Tujuan atau agenda peminjaman tidak boleh melebihi 500 karakter.'
      USING ERRCODE = '22023';
  END IF;

  v_clean_event_name := COALESCE(NULLIF(pg_catalog.btrim(p_event_name), ''), v_clean_purpose);
  IF pg_catalog.length(v_clean_event_name) > 200 THEN
    v_clean_event_name := pg_catalog.substr(v_clean_event_name, 1, 200);
  END IF;

  -- 4. VALIDASI JUMLAH PESERTA:
  -- Nilai kosong (NULL), 0, atau negatif WAJIB DITOLAK (tidak otomatis diubah ke 1)
  IF p_participants IS NULL THEN
    RAISE EXCEPTION 'Jumlah peserta wajib diisi dan tidak boleh kosong.'
      USING ERRCODE = '22023';
  END IF;

  IF p_participants <= 0 THEN
    RAISE EXCEPTION 'Jumlah peserta harus lebih dari 0 orang (diberikan: %).', p_participants
      USING ERRCODE = '22023';
  END IF;

  -- 5. KUNCI RUANGAN (Level 1 Lock: public.rooms FOR UPDATE)
  -- Serialisasi proses pemesanan ruangan yang sama untuk mencegah race condition
  SELECT name, capacity INTO v_room_name, v_room_capacity
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ruangan dengan ID % tidak ditemukan di sistem database.', p_room_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Validasi kapasitas ruangan
  IF v_room_capacity IS NOT NULL AND v_room_capacity > 0 AND p_participants > v_room_capacity THEN
    RAISE EXCEPTION 'Jumlah peserta (% orang) melebihi kapasitas maksimal ruangan "%" (% orang).',
      p_participants, v_room_name, v_room_capacity
      USING ERRCODE = '22023';
  END IF;

  -- 6. Pengecekan tumpang tindih jadwal (Overlap Check)
  -- Jadwal bertabrakan jika: start_time < p_end_time DAN end_time > p_start_time
  -- Hanya reservasi 'pending' atau 'approved' yang dianggap memblokir jadwal
  SELECT EXISTS (
    SELECT 1 FROM public.reservations
    WHERE room_id = p_room_id
      AND status IN ('pending', 'approved')
      AND start_time < p_end_time
      AND end_time > p_start_time
  ) INTO v_has_conflict;

  IF v_has_conflict THEN
    RAISE EXCEPTION 'Ruangan "%" sudah memiliki jadwal aktif atau sedang menunggu persetujuan pada rentang waktu tersebut.', v_room_name
      USING ERRCODE = '23P01';
  END IF;

  -- 7. Simpan baris reservasi berstatus awal 'pending' dengan metadata lengkap
  INSERT INTO public.reservations (
    user_id,
    room_id,
    event_name,
    purpose,
    start_time,
    end_time,
    participants,
    facilities,
    status,
    created_at
  ) VALUES (
    v_user_id,
    p_room_id,
    v_clean_event_name,
    v_clean_purpose,
    p_start_time,
    p_end_time,
    p_participants,
    COALESCE(p_facilities, '{}'),
    'pending',
    v_now
  )
  RETURNING id INTO v_new_reservation_id;

  -- 8. Catat riwayat audit pembuatan reservasi
  INSERT INTO public.reservation_history (
    reservation_id,
    action,
    notes,
    created_at
  ) VALUES (
    v_new_reservation_id,
    'CREATED',
    'Pengajuan reservasi baru diajukan oleh pemohon dengan status awal pending.',
    v_now
  );

  -- 8. Kembalikan respons terstruktur
  SELECT jsonb_build_object(
    'success', true,
    'reservation_id', v_new_reservation_id,
    'room_id', p_room_id,
    'room_name', v_room_name,
    'status', 'pending',
    'start_time', p_start_time,
    'end_time', p_end_time,
    'message', 'Reservasi berhasil dibuat dan menunggu persetujuan admin.'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;


-- =========================================================================
-- BAGIAN 7: FUNGSI RPC — update_reservation_status_safe
-- =========================================================================
-- Menangani persetujuan (approval), penolakan (rejection), dan pembatalan (cancellation).
-- Urutan locking konsisten (Level 1: rooms -> Level 2: reservations).
-- Mencegah double-approval jika dua admin memproses reservasi bersamaan.
CREATE OR REPLACE FUNCTION public.update_reservation_status_safe(
  p_reservation_id bigint,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_current_status text;
  v_res_user_id uuid;
  v_room_id bigint;
  v_room_name text;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_has_approved_conflict boolean;
  v_action text;
  v_history_notes text;
  v_clean_status text;
  v_result jsonb;
BEGIN
  -- 1. Verifikasi login pemohon aksi
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login terlebih dahulu.'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_admin();

  -- 2. Validasi nilai status baru
  IF p_new_status IS NULL OR TRIM(p_new_status) = '' THEN
    RAISE EXCEPTION 'Parameter status baru (p_new_status) wajib diisi.'
      USING ERRCODE = '22023';
  END IF;
  v_clean_status := LOWER(TRIM(p_new_status));

  -- Validasi panjang catatan
  IF p_notes IS NOT NULL AND LENGTH(TRIM(p_notes)) > 500 THEN
    RAISE EXCEPTION 'Catatan alasan atau keterangan tidak boleh melebihi 500 karakter.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Identifikasi room_id dari reservasi terkait
  SELECT room_id INTO v_room_id
  FROM public.reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservasi dengan ID % tidak ditemukan di sistem.', p_reservation_id
      USING ERRCODE = '22023';
  END IF;

  -- 4. KUNCI RUANGAN (Level 1 Lock: public.rooms FOR UPDATE)
  SELECT name INTO v_room_name
  FROM public.rooms
  WHERE id = v_room_id
  FOR UPDATE;

  -- 5. KUNCI RESERVASI (Level 2 Lock: public.reservations FOR UPDATE)
  SELECT status, user_id, start_time, end_time
  INTO v_current_status, v_res_user_id, v_start_time, v_end_time
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  -- 6. Hanya reservasi berstatus 'pending' yang dapat diubah statusnya
  IF v_current_status <> 'pending' THEN
    RAISE EXCEPTION 'Reservasi ID % sudah diproses sebelumnya (status saat ini: "%"). Hanya reservasi "pending" yang dapat diubah.',
      p_reservation_id, v_current_status
      USING ERRCODE = '22023';
  END IF;

  -- 7. Validasi otorisasi berdasarkan peran
  IF v_is_admin THEN
    -- Administrator: hanya boleh approve atau reject
    IF v_clean_status NOT IN ('approved', 'rejected') THEN
      RAISE EXCEPTION 'Status yang valid untuk Administrator adalah "approved" atau "rejected".'
        USING ERRCODE = '22023';
    END IF;

    IF v_clean_status = 'approved' THEN
      -- PENCEGAHAN BENTROK GANDA (DOUBLE-APPROVAL PREVENTION):
      -- Periksa apakah ada reservasi lain pada ruangan ini yang SUDAH disetujui (approved)
      SELECT EXISTS (
        SELECT 1 FROM public.reservations
        WHERE room_id = v_room_id
          AND id <> p_reservation_id
          AND status = 'approved'
          AND start_time < v_end_time
          AND end_time > v_start_time
      ) INTO v_has_approved_conflict;

      IF v_has_approved_conflict THEN
        RAISE EXCEPTION 'Tidak dapat menyetujui: Ruangan "%" sudah memiliki jadwal approved yang bertabrakan pada rentang waktu tersebut.', v_room_name
          USING ERRCODE = '23P01';
      END IF;

      v_action := 'APPROVED';
      v_history_notes := COALESCE(NULLIF(TRIM(p_notes), ''), 'Pengajuan disetujui oleh Administrator.');
    ELSE
      v_action := 'REJECTED';
      v_history_notes := COALESCE(NULLIF(TRIM(p_notes), ''), 'Pengajuan ditolak oleh Administrator.');
    END IF;

  ELSE
    -- Pengguna biasa: HANYA boleh membatalkan reservasinya sendiri
    IF v_res_user_id <> v_user_id THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki hak untuk mengubah atau membatalkan reservasi pengguna lain.'
        USING ERRCODE = '42501';
    END IF;

    IF v_clean_status <> 'rejected' THEN
      RAISE EXCEPTION 'Pengguna hanya diizinkan untuk membatalkan pengajuan (status: "rejected").'
        USING ERRCODE = '42501';
    END IF;

    v_action := 'CANCELLED_BY_USER';
    v_history_notes := COALESCE(NULLIF(TRIM(p_notes), ''), 'Dibatalkan sendiri oleh pemohon.');
  END IF;

  -- 8. Eksekusi pembaruan status
  UPDATE public.reservations
  SET status = v_clean_status
  WHERE id = p_reservation_id;

  -- 9. Catat riwayat audit perubahan status
  INSERT INTO public.reservation_history (
    reservation_id,
    action,
    notes
  ) VALUES (
    p_reservation_id,
    v_action,
    v_history_notes
  );

  -- 10. Kembalikan respons terstruktur
  SELECT jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'old_status', v_current_status,
    'new_status', v_clean_status,
    'action', v_action,
    'notes', v_history_notes
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;


-- =========================================================================
-- BAGIAN 8: HAK AKSES EKSEKUSI FUNGSI RPC
-- =========================================================================
REVOKE ALL ON FUNCTION public.create_reservation_safe(bigint, text, text, timestamptz, timestamptz, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_safe(bigint, text, text, timestamptz, timestamptz, integer, text[]) TO authenticated;

REVOKE ALL ON FUNCTION public.update_reservation_status_safe(bigint, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_safe(bigint, text, text) TO authenticated;
