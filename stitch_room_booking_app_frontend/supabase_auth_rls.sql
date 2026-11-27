-- =========================================================================
-- ROOMBOOK: SKRIP MODUL 1 — AUTENTIKASI PENGGUNA & KEAMANAN TABEL PROFILES
-- =========================================================================
-- File: supabase_auth_rls.sql
-- Urutan Eksekusi: LANGKAH 1 (Jalankan file ini SEBELUM supabase_reservations_rls.sql)
-- Karakteristik: Idempotent — aman dijalankan berulang tanpa merusak data
--
-- FUNGSI SKRIP INI:
-- 1. Mengaktifkan Row Level Security (RLS) pada public.profiles.
-- 2. Mengatur hak akses tabel profiles seminimal mungkin (Least Privilege).
-- 3. Memasang fungsi is_admin() dengan search_path ketat (pg_catalog, public, pg_temp).
-- 4. Memasang trigger protect_profile_role untuk mencegah eskalasi peran 'admin'.
-- 5. Mengatur policy RLS (SELECT, INSERT, UPDATE) yang konsisten dan terverifikasi.
-- 6. Memasang trigger otomatis handle_new_user pada auth.users (ON CONFLICT DO NOTHING).
-- =========================================================================

-- 1. Pastikan Row Level Security (RLS) aktif pada tabel public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Atur hak akses dasar tabel profiles (Prinsip Hak Akses Minimum)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
REVOKE ALL ON TABLE public.profiles FROM anon, PUBLIC;
GRANT SELECT ON TABLE public.profiles TO anon;

REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- 3. FUNGSI HELPER PENGECEKAN ADMIN (SECURITY DEFINER):
-- Mencegah rekursi tak terbatas (infinite recursion) pada RLS profiles.
-- search_path dikunci ketat ke: pg_catalog, public, pg_temp
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

-- 4. TRIGGER PROTEKSI ROLE PROFIL (ANTI-ESKALASI HAK ADMIN):
-- Memastikan:
-- - INSERT baru harus memiliki role 'user' (jika NULL otomatis diisi 'user')
-- - Non-admin ditolak jika mencoba mendaftar dengan role 'admin'
-- - UPDATE kolom role hanya dapat dilakukan oleh admin
-- - Kolom id tidak dapat diubah setelah dibuat
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Set default role 'user' jika null
    IF NEW.role IS NULL THEN
      NEW.role := 'user';
    ELSIF NEW.role <> 'user' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Akses ditolak: Pendaftaran akun baru hanya boleh memiliki peran "user".'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Mencegah manipulasi id profil
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Akses ditolak: ID profil tidak dapat diubah.'
        USING ERRCODE = '42501';
    END IF;
    -- Hanya admin yang boleh mengubah nilai role
    IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki izin untuk mengubah peran (role) akun.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 5. KEBIJAKAN RLS TABEL PROFILES (DROP LALU CREATE — IDEMPOTENT)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile as user" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile name only" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 5a. Policy SELECT: Pengguna dapat membaca profilnya sendiri, atau admin dapat membaca semua
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  auth.uid() = id 
  OR 
  public.is_admin()
);

-- 5b. Policy INSERT: Pengguna hanya boleh memasukkan profil miliknya dengan role 'user'
CREATE POLICY "Users can insert own profile as user" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = id 
  AND (role IS NULL OR role = 'user' OR public.is_admin())
);

-- 5c. Policy UPDATE: Pengguna dapat memperbarui profil miliknya
-- Catatan Keamanan: Kolom role dan id diproteksi oleh trigger protect_profile_role dan WITH CHECK RLS
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND (role = 'user' OR public.is_admin())
);

-- 6. FUNCTION & TRIGGER OTOMATIS SAAT PENDAFTARAN SUPABASE AUTH:
-- Membuat baris profil di public.profiles secara otomatis saat user baru terdaftar.
-- search_path dikunci ke: pg_catalog, public, pg_temp
-- Menggunakan ON CONFLICT (id) DO NOTHING agar tidak mengubah full_name atau data profil yang sudah ada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================================
-- PROSES RESMI MENJADIKAN AKUN SEBAGAI ADMINISTRATOR:
-- Jalankan perintah berikut di Supabase SQL Editor untuk memberikan hak admin:
--
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'admin.roombook@kampus.ac.id');
-- =========================================================================