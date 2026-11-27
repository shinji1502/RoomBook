-- =========================================================================
-- ROOMBOOK: SKRIP MIGRASI V3 — STATUS CANCELLED, CHECK-IN, REALTIME & CRUD RUANGAN
-- =========================================================================
-- File: supabase_migration_v3.sql
-- Karakteristik: Idempotent — aman dijalankan setelah supabase_migration_v2.sql
-- Tujuan:
--   1. Memperbarui RPC update_reservation_status_safe untuk mendukung status 'cancelled'
--      resmi oleh pengguna (terpisah dari penolakan admin 'rejected').
--   2. Menyediakan RPC check_in_reservation_safe untuk validasi kedatangan & pemindaian QR Code.
--   3. Menyediakan RPC CRUD Ruangan khusus Admin (create, update, delete) dengan proteksi is_admin().
--   4. Menyediakan RPC get_room_schedule untuk visualisasi slot waktu terisi di halaman booking.
--   5. Memastikan publikasi Supabase Realtime aktif pada tabel reservations dan rooms.
-- =========================================================================

-- =========================================================================
-- 1. PEMBARUAN RPC: update_reservation_status_safe
-- =========================================================================
-- Mendukung:
--   - Admin: 'approved', 'rejected'
--   - Pengguna: 'cancelled' (atau 'rejected' demi kompatibilitas lama)
--   - Check-in / Penutupan: 'completed'
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
  v_now timestamptz;
BEGIN
  -- 1. Verifikasi login pemohon aksi
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login terlebih dahulu.'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_admin();

  -- 2. Validasi nilai status baru
  IF p_new_status IS NULL OR pg_catalog.btrim(p_new_status) = '' THEN
    RAISE EXCEPTION 'Parameter status baru (p_new_status) wajib diisi.'
      USING ERRCODE = '22023';
  END IF;
  v_clean_status := pg_catalog.lower(pg_catalog.btrim(p_new_status));

  IF p_notes IS NOT NULL AND pg_catalog.length(pg_catalog.btrim(p_notes)) > 500 THEN
    RAISE EXCEPTION 'Catatan alasan atau keterangan tidak boleh melebihi 500 karakter.'
      USING ERRCODE = '22023';
  END IF;

  -- 3. Identifikasi room_id dari reservasi terkait
  SELECT room_id INTO v_room_id
  FROM public.reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservasi dengan ID % tidak ditemukan di sistem database.', p_reservation_id
      USING ERRCODE = 'P0002';
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

  v_now := pg_catalog.clock_timestamp();

  -- 6. Validasi otorisasi & transisi status
  IF v_is_admin THEN
    IF v_clean_status NOT IN ('approved', 'rejected', 'completed', 'cancelled') THEN
      RAISE EXCEPTION 'Status yang valid untuk Administrator adalah "approved", "rejected", "completed", atau "cancelled".'
        USING ERRCODE = '22023';
    END IF;

    IF v_clean_status = 'approved' THEN
      -- PENCEGAHAN BENTROK GANDA (DOUBLE-APPROVAL PREVENTION):
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
      v_history_notes := COALESCE(NULLIF(pg_catalog.btrim(p_notes), ''), 'Pengajuan disetujui oleh Administrator.');
    ELSIF v_clean_status = 'rejected' THEN
      v_action := 'REJECTED';
      v_history_notes := COALESCE(NULLIF(pg_catalog.btrim(p_notes), ''), 'Pengajuan ditolak oleh Administrator.');
    ELSIF v_clean_status = 'completed' THEN
      v_action := 'COMPLETED';
      v_history_notes := COALESCE(NULLIF(pg_catalog.btrim(p_notes), ''), 'Reservasi telah selesai digunakan.');
    ELSE
      v_action := 'CANCELLED_BY_ADMIN';
      v_history_notes := COALESCE(NULLIF(pg_catalog.btrim(p_notes), ''), 'Dibatalkan oleh Administrator.');
    END IF;

  ELSE
    -- Pengguna biasa: HANYA boleh membatalkan reservasinya sendiri
    IF v_res_user_id <> v_user_id THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki hak untuk mengubah atau membatalkan reservasi pengguna lain.'
        USING ERRCODE = '42501';
    END IF;

    IF v_current_status <> 'pending' AND v_clean_status IN ('cancelled', 'rejected') THEN
      RAISE EXCEPTION 'Pengguna hanya dapat membatalkan reservasi yang masih berstatus "pending".'
        USING ERRCODE = '22023';
    END IF;

    IF v_clean_status NOT IN ('cancelled', 'rejected') THEN
      RAISE EXCEPTION 'Pengguna hanya diizinkan untuk membatalkan pengajuan (status: "cancelled").'
        USING ERRCODE = '42501';
    END IF;

    -- Normalisasi: gunakan status 'cancelled'
    v_clean_status := 'cancelled';
    v_action := 'CANCELLED_BY_USER';
    v_history_notes := COALESCE(NULLIF(pg_catalog.btrim(p_notes), ''), 'Dibatalkan sendiri oleh pemohon.');
  END IF;

  -- 7. Eksekusi pembaruan status
  UPDATE public.reservations
  SET status = v_clean_status
  WHERE id = p_reservation_id;

  -- 8. Catat riwayat audit
  INSERT INTO public.reservation_history (
    reservation_id,
    action,
    notes,
    created_at
  ) VALUES (
    p_reservation_id,
    v_action,
    v_history_notes,
    v_now
  );

  -- 9. Respons JSON
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
-- 2. FUNGSI RPC: check_in_reservation_safe (PEMINDAIAN QR CODE CHECK-IN)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.check_in_reservation_safe(
  p_reservation_id bigint,
  p_qr_code text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
  v_status text;
  v_room_id bigint;
  v_room_name text;
  v_res_user_id uuid;
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_now timestamptz;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login untuk melakukan check-in.'
      USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.is_admin();

  SELECT r.status, r.room_id, ro.name, r.user_id, r.start_time, r.end_time
  INTO v_status, v_room_id, v_room_name, v_res_user_id, v_start_time, v_end_time
  FROM public.reservations r
  JOIN public.rooms ro ON ro.id = r.room_id
  WHERE r.id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservasi dengan ID % tidak ditemukan.', p_reservation_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Hanya reservasi 'approved' yang boleh check-in
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'Check-in gagal: Status tiket saat ini adalah "%". Hanya tiket "approved" yang dapat check-in.', v_status
      USING ERRCODE = '22023';
  END IF;

  -- Pengguna hanya boleh check-in miliknya sendiri kecuali admin
  IF NOT v_is_admin AND v_res_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Akses ditolak: Tiket reservasi ini milik pengguna lain.'
      USING ERRCODE = '42501';
  END IF;

  v_now := pg_catalog.clock_timestamp();

  -- Catat riwayat check-in
  INSERT INTO public.reservation_history (
    reservation_id,
    action,
    notes,
    created_at
  ) VALUES (
    p_reservation_id,
    'CHECKED_IN',
    'Pengguna berhasil melakukan check-in kehadiran di pintu ruangan.',
    v_now
  );

  SELECT jsonb_build_object(
    'success', true,
    'reservation_id', p_reservation_id,
    'room_name', v_room_name,
    'checked_in_at', v_now,
    'message', 'Check-in berhasil! Pintu ruangan siap diakses.'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;


-- =========================================================================
-- 3. FUNGSI RPC: get_room_schedule (VISUALISASI SLOT WAKTU TERISI RUANGAN)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.get_room_schedule(
  p_room_id bigint,
  p_date date
)
RETURNS TABLE (
  reservation_id bigint,
  event_name text,
  start_time timestamptz,
  end_time timestamptz,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id AS reservation_id,
    r.event_name,
    r.start_time,
    r.end_time,
    r.status
  FROM public.reservations r
  WHERE r.room_id = p_room_id
    AND r.status IN ('pending', 'approved')
    AND (
      (r.start_time AT TIME ZONE 'Asia/Jakarta')::date = p_date
      OR (r.end_time AT TIME ZONE 'Asia/Jakarta')::date = p_date
    )
  ORDER BY r.start_time ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;


-- =========================================================================
-- 4. FUNGSI RPC ADMIN CRUD RUANGAN: admin_create_room, admin_update_room, admin_delete_room
-- =========================================================================

-- 4a. Tambah Ruangan Baru
CREATE OR REPLACE FUNCTION public.admin_create_room(
  p_name text,
  p_capacity integer,
  p_floor text DEFAULT 'Lantai 1',
  p_facilities text[] DEFAULT '{}',
  p_image_url text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_new_id bigint;
  v_result jsonb;
  v_clean_name text;
  v_img text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang dapat menambah ruangan.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_name := pg_catalog.btrim(COALESCE(p_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Nama ruangan wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_capacity IS NULL OR p_capacity <= 0 THEN
    RAISE EXCEPTION 'Kapasitas ruangan harus lebih dari 0 orang.' USING ERRCODE = '22023';
  END IF;

  v_img := COALESCE(NULLIF(pg_catalog.btrim(p_image_url), ''),
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80');

  INSERT INTO public.rooms (name, capacity, floor, facilities, image_url)
  VALUES (v_clean_name, p_capacity, COALESCE(p_floor, 'Lantai 1'), COALESCE(p_facilities, '{}'), v_img)
  RETURNING id INTO v_new_id;

  SELECT jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'name', v_clean_name,
    'capacity', p_capacity,
    'message', 'Ruangan baru berhasil ditambahkan.'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 4b. Perbarui Ruangan
CREATE OR REPLACE FUNCTION public.admin_update_room(
  p_room_id bigint,
  p_name text,
  p_capacity integer,
  p_floor text DEFAULT 'Lantai 1',
  p_facilities text[] DEFAULT '{}',
  p_image_url text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
  v_clean_name text;
  v_img text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang dapat mengubah data ruangan.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_name := pg_catalog.btrim(COALESCE(p_name, ''));
  IF v_clean_name = '' THEN
    RAISE EXCEPTION 'Nama ruangan wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_capacity IS NULL OR p_capacity <= 0 THEN
    RAISE EXCEPTION 'Kapasitas ruangan harus lebih dari 0 orang.' USING ERRCODE = '22023';
  END IF;

  v_img := COALESCE(NULLIF(pg_catalog.btrim(p_image_url), ''),
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80');

  UPDATE public.rooms
  SET name = v_clean_name,
      capacity = p_capacity,
      floor = COALESCE(p_floor, floor),
      facilities = COALESCE(p_facilities, facilities),
      image_url = v_img
  WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ruangan dengan ID % tidak ditemukan.', p_room_id USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'id', p_room_id,
    'name', v_clean_name,
    'message', 'Data ruangan berhasil diperbarui.'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 4c. Hapus Ruangan (Memeriksa Ketergantungan Reservasi Aktif)
CREATE OR REPLACE FUNCTION public.admin_delete_room(
  p_room_id bigint
)
RETURNS jsonb AS $$
DECLARE
  v_has_active boolean;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang dapat menghapus ruangan.'
      USING ERRCODE = '42501';
  END IF;

  -- Periksa apakah ada reservasi aktif
  SELECT EXISTS (
    SELECT 1 FROM public.reservations
    WHERE room_id = p_room_id AND status IN ('pending', 'approved')
  ) INTO v_has_active;

  IF v_has_active THEN
    RAISE EXCEPTION 'Tidak dapat menghapus ruangan: Masih ada reservasi berstatus pending atau approved untuk ruangan ini.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.rooms WHERE id = p_room_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ruangan dengan ID % tidak ditemukan.', p_room_id USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'id', p_room_id,
    'message', 'Ruangan berhasil dihapus dari sistem.'
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;


-- =========================================================================
-- 5. HAK AKSES EKSEKUSI FUNGSI RPC BARU
-- =========================================================================
REVOKE ALL ON FUNCTION public.check_in_reservation_safe(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_in_reservation_safe(bigint, text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_room_schedule(bigint, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_room_schedule(bigint, date) TO authenticated, anon;

REVOKE ALL ON FUNCTION public.admin_create_room(text, integer, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_room(text, integer, text, text[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_room(bigint, text, integer, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_room(bigint, text, integer, text, text[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_room(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_room(bigint) TO authenticated;

-- =========================================================================
-- 6. PASTIKAN REALTIME AKTIF PADA TABEL TERKAIT
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reservations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'reservation_history'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_history;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Abaikan jika ekstensi realtime belum aktif di hosting lokal
  NULL;
END;
$$;

