-- =========================================================================
-- ROOMBOOK: SKRIP MIGRASI V4 — UPLOAD FOTO RUANGAN, KOLOM FLOOR & SINKRONISASI
-- =========================================================================
-- File: supabase_migration_v4.sql
-- Karakteristik: Idempotent — aman dijalankan berulang di Supabase SQL Editor.
-- Tujuan:
--   1. Menambahkan kolom floor pada public.rooms agar sesuai dengan form Admin & User.
--   2. Membuat Storage Bucket 'room-images' (publik) beserta RLS policy upload khusus Admin.
--   3. Memperbarui RPC admin_create_room & admin_update_room agar kompatibel penuh
--      dengan kolom facilities bertipe text maupun text[] serta mengembalikan baris ruangan utuh.
--   4. Memastikan publikasi Supabase Realtime aktif untuk public.rooms agar daftar ruangan
--      di akun User langsung ter-update otomatis begitu Admin menambahkan ruangan baru.
-- =========================================================================

-- =========================================================================
-- 1. STRUKTUR TABEL public.rooms & HAK AKSES BACA
-- =========================================================================
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS floor text DEFAULT 'Lantai 1';

GRANT SELECT ON TABLE public.rooms TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'rooms' AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Public can view rooms" ON public.rooms;
    CREATE POLICY "Public can view rooms"
      ON public.rooms
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;


-- =========================================================================
-- 2. STORAGE BUCKET 'room-images' & POLICY UPLOAD FOTO RUANGAN (KHUSUS ADMIN)
-- =========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-images',
  'room-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Public read room images" ON storage.objects;
CREATE POLICY "Public read room images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'room-images');

DROP POLICY IF EXISTS "Admin upload room images" ON storage.objects;
CREATE POLICY "Admin upload room images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'room-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin update room images" ON storage.objects;
CREATE POLICY "Admin update room images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'room-images' AND public.is_admin())
WITH CHECK (bucket_id = 'room-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete room images" ON storage.objects;
CREATE POLICY "Admin delete room images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'room-images' AND public.is_admin());


-- =========================================================================
-- 3. PEMBARUAN FUNGSI RPC: admin_create_room & admin_update_room
-- =========================================================================
DROP FUNCTION IF EXISTS public.admin_create_room(text, integer, text, text[], text);
DROP FUNCTION IF EXISTS public.admin_update_room(bigint, text, integer, text, text[], text);

-- 3a. Tambah Ruangan Baru (Kompatibel dengan facilities bertipe text maupun text[])
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
  v_clean_name text;
  v_clean_floor text;
  v_img text;
  v_fac_data_type text;
  v_fac_text text;
  v_room_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
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

  v_clean_floor := COALESCE(NULLIF(pg_catalog.btrim(p_floor), ''), 'Lantai 1');
  v_img := COALESCE(NULLIF(pg_catalog.btrim(p_image_url), ''),
    'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80');

  SELECT data_type INTO v_fac_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'rooms'
    AND column_name = 'facilities';

  IF v_fac_data_type = 'ARRAY' THEN
    INSERT INTO public.rooms (name, capacity, floor, facilities, image_url)
    VALUES (v_clean_name, p_capacity, v_clean_floor, COALESCE(p_facilities, '{}'), v_img)
    RETURNING id INTO v_new_id;
  ELSE
    v_fac_text := COALESCE(NULLIF(pg_catalog.array_to_string(COALESCE(p_facilities, '{}'), ', '), ''), 'AC Central, WiFi High-Speed');
    INSERT INTO public.rooms (name, capacity, floor, facilities, image_url)
    VALUES (v_clean_name, p_capacity, v_clean_floor, v_fac_text, v_img)
    RETURNING id INTO v_new_id;
  END IF;

  SELECT to_jsonb(r) INTO v_room_json
  FROM public.rooms r
  WHERE r.id = v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'name', v_clean_name,
    'capacity', p_capacity,
    'floor', v_clean_floor,
    'image_url', v_img,
    'room', v_room_json,
    'message', 'Ruangan baru berhasil ditambahkan.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

-- 3b. Perbarui Data Ruangan
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
  v_clean_name text;
  v_clean_floor text;
  v_img text;
  v_fac_data_type text;
  v_fac_text text;
  v_room_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
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

  v_clean_floor := COALESCE(NULLIF(pg_catalog.btrim(p_floor), ''), 'Lantai 1');
  v_img := NULLIF(pg_catalog.btrim(p_image_url), '');

  SELECT data_type INTO v_fac_data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'rooms'
    AND column_name = 'facilities';

  IF v_fac_data_type = 'ARRAY' THEN
    UPDATE public.rooms
    SET name = v_clean_name,
        capacity = p_capacity,
        floor = v_clean_floor,
        facilities = COALESCE(p_facilities, facilities),
        image_url = COALESCE(v_img, image_url)
    WHERE id = p_room_id;
  ELSE
    v_fac_text := NULLIF(pg_catalog.array_to_string(COALESCE(p_facilities, '{}'), ', '), '');
    UPDATE public.rooms
    SET name = v_clean_name,
        capacity = p_capacity,
        floor = v_clean_floor,
        facilities = COALESCE(v_fac_text, facilities),
        image_url = COALESCE(v_img, image_url)
    WHERE id = p_room_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ruangan dengan ID % tidak ditemukan.', p_room_id USING ERRCODE = 'P0002';
  END IF;

  SELECT to_jsonb(r) INTO v_room_json
  FROM public.rooms r
  WHERE r.id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_room_id,
    'name', v_clean_name,
    'room', v_room_json,
    'message', 'Data ruangan berhasil diperbarui.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_room(text, integer, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_room(text, integer, text, text[], text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_update_room(bigint, text, integer, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_room(bigint, text, integer, text, text[], text) TO authenticated;

-- 3c. Hapus Ruangan (Proteksi Jadwal Aktif + Pembersihan Riwayat Lama & Foto)
DROP FUNCTION IF EXISTS public.admin_delete_room(bigint);
CREATE OR REPLACE FUNCTION public.admin_delete_room(
  p_room_id bigint
)
RETURNS jsonb AS $$
DECLARE
  v_room_name text;
  v_image_url text;
  v_has_active boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang dapat menghapus ruangan.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name, image_url INTO v_room_name, v_image_url
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ruangan dengan ID % tidak ditemukan.', p_room_id USING ERRCODE = 'P0002';
  END IF;

  -- Cegah hapus jika masih ada reservasi pending atau approved yang belum berakhir
  SELECT EXISTS (
    SELECT 1 FROM public.reservations
    WHERE room_id = p_room_id
      AND (
        status = 'pending'
        OR (status = 'approved' AND end_time >= pg_catalog.clock_timestamp())
      )
  ) INTO v_has_active;

  IF v_has_active THEN
    RAISE EXCEPTION 'Tidak dapat menghapus ruangan "%": Masih ada jadwal reservasi aktif atau menunggu persetujuan.', v_room_name
      USING ERRCODE = '23503';
  END IF;

  -- Bersihkan riwayat reservasi lama/ditolak/dibatalkan agar tidak terkena Foreign Key error
  DELETE FROM public.reservations
  WHERE room_id = p_room_id;

  DELETE FROM public.rooms
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_room_id,
    'name', v_room_name,
    'image_url', v_image_url,
    'message', format('Ruangan "%s" berhasil dihapus dari sistem.', v_room_name)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.admin_delete_room(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_room(bigint) TO authenticated;

-- 3d. Tandai Reservasi yang Sudah Lewat Jamnya Menjadi 'completed'
CREATE OR REPLACE FUNCTION public.complete_expired_reservations()
RETURNS jsonb AS $$
DECLARE
  v_uid uuid;
  v_count integer := 0;
  v_rec RECORD;
  v_now timestamptz;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak: Anda harus login.' USING ERRCODE = '42501';
  END IF;

  v_now := pg_catalog.clock_timestamp();

  FOR v_rec IN
    SELECT id
    FROM public.reservations
    WHERE status = 'approved'
      AND end_time < v_now
      AND (user_id = v_uid OR public.is_admin())
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.reservations
    SET status = 'completed'
    WHERE id = v_rec.id;

    INSERT INTO public.reservation_history (reservation_id, action, notes, created_at)
    VALUES (
      v_rec.id,
      'COMPLETED',
      'Jadwal pemakaian ruangan telah berakhir dan ditandai selesai otomatis.',
      v_now
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'completed_count', v_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.complete_expired_reservations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_expired_reservations() TO authenticated;


-- =========================================================================
-- 4. AKTIFKAN REALTIME UNTUK TABEL ROOMS AGAR AKUN USER AUTO-SYNC
-- =========================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'rooms'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
