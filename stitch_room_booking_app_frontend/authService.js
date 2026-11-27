// AuthService - Layanan Autentikasi dan Manajemen Profil Pengguna Supabase
// Terintegrasi langsung dengan Supabase Auth (GoTrue) dan tabel public.profiles

(function () {
  'use strict';

  /**
   * Menerjemahkan pesan error Supabase Auth menjadi pesan yang informatif dan ramah pengguna
   * @param {Object} error
   * @returns {string}
   */
  function translateAuthError(error) {
    if (!error) return 'Terjadi kesalahan sistem yang tidak diketahui.';
    const msg = String(error.message || '').toLowerCase();
    const code = String(error.code || '').toLowerCase();

    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
      return 'Email atau kata sandi salah. Silakan periksa kembali kredensial Anda.';
    }
    if (msg.includes('email not confirmed')) {
      return 'Email akun Anda belum dikonfirmasi. Silakan periksa kotak masuk email atau minta administrator mengonfirmasi akun Anda.';
    }
    if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
      return 'Batas pengiriman email verifikasi tercapai (rate limit Supabase). Matikan opsi "Confirm email" di Supabase Dashboard untuk pengujian langsung tanpa jeda.';
    }
    if (code === 'user_already_exists' || msg.includes('user already registered')) {
      return 'Email ini sudah terdaftar di sistem. Silakan langsung masuk dengan akun Anda.';
    }
    if (msg.includes('password should be at least') || msg.includes('weak_password')) {
      return 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.';
    }
    if (code === 'email_address_invalid' || msg.includes('email address') && msg.includes('invalid')) {
      return 'Alamat email tidak valid. Gunakan format email resmi yang benar.';
    }
    if (msg.includes('networkerror') || msg.includes('failed to fetch')) {
      return 'Koneksi ke server Supabase gagal. Periksa koneksi internet Anda.';
    }
    return error.message || 'Terjadi kesalahan saat memproses otentikasi.';
  }

  /**
   * Helper untuk mendapatkan inisial dari nama
   */
  function getInitials(name) {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  const AuthService = {
    _currentUser: null,
    _currentProfile: null,
    _isInitialized: false,

    /**
     * Mengambil instance client Supabase
     */
    getClient() {
      const client = window.supabaseClient;
      if (!client) {
        throw new Error('Supabase Client belum siap. Pastikan supabaseClient.js telah dimuat.');
      }
      return client;
    },

    /**
     * Mengambil profil pengguna dari tabel public.profiles berdasarkan user ID (auth.uid())
     * @param {string} userId
     * @returns {Promise<{ profile: Object|null, error: Object|null }>}
     */
    async fetchProfile(userId) {
      if (!userId) return { profile: null, error: new Error('User ID diperlukan.') };
      try {
        const client = this.getClient();
        console.log('📡 [AuthService] Mengambil profil dari public.profiles untuk user:', userId);
        const { data, error } = await client
          .from('profiles')
          .select('id, full_name, role, created_at')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('⚠️ [AuthService] Gagal membaca profil:', error.message);
          return { profile: null, error };
        }
        return { profile: data, error: null };
      } catch (err) {
        console.error('❌ [AuthService] Network error fetching profile:', err);
        return { profile: null, error: err };
      }
    },

    /**
     * Memastikan baris profil ada di public.profiles.
     * Jika belum ada (misal trigger belum dibuat), dibuatkan baris profil dengan role 'user'.
     * Pengguna biasa TIDAK PERNAH diizinkan menyetel role selain 'user'.
     * @param {Object} user - Objek auth.users
     * @param {string} [fallbackName]
     */
    async ensureProfile(user, fallbackName = '') {
      if (!user || !user.id) return null;
      const client = this.getClient();

      // Cek apakah profil sudah ada
      const { profile } = await this.fetchProfile(user.id);
      if (profile) return profile;

      // Jika belum ada, lakukan insert dengan role tegas 'user'
      const name = fallbackName || user.user_metadata?.full_name || (user.email ? user.email.split('@')[0] : 'Pengguna Baru');
      console.log('📝 [AuthService] Membuat profil awal default (role: user) untuk user:', user.id);
      try {
        const { data, error } = await client
          .from('profiles')
          .insert({
            id: user.id,
            full_name: name,
            role: 'user' // STRICT: Pengguna selalu didaftarkan sebagai user biasa
          })
          .select()
          .maybeSingle();

        if (error) {
          console.warn('⚠️ [AuthService] Tidak dapat membuat baris profiles secara langsung (kemungkinan RLS):', error.message);
          // Return objek in-memory yang aman
          return {
            id: user.id,
            full_name: name,
            role: 'user'
          };
        }
        return data;
      } catch (e) {
        console.error('❌ [AuthService] Error saat ensureProfile:', e);
        return {
          id: user.id,
          full_name: name,
          role: 'user'
        };
      }
    },

    /**
     * Mendaftarkan pengguna baru dengan Supabase Auth
     * Hanya boleh mendaftar sebagai peran 'user'
     * @param {Object} params - { email, password, fullName }
     * @returns {Promise<{ success: boolean, user: Object|null, session: Object|null, profile: Object|null, message: string }>}
     */
    async signUp({ email, password, fullName }) {
      try {
        const client = this.getClient();
        const trimmedEmail = (email || '').trim();
        const cleanName = (fullName || '').trim() || trimmedEmail.split('@')[0];

        if (!trimmedEmail || !password) {
          return {
            success: false,
            message: 'Email dan kata sandi wajib diisi.'
          };
        }

        if (password.length < 6) {
          return {
            success: false,
            message: 'Kata sandi minimal 6 karakter.'
          };
        }

        console.log('📡 [AuthService] Memulai proses registrasi untuk:', trimmedEmail);
        const { data, error } = await client.auth.signUp({
          email: trimmedEmail,
          password: password,
          options: {
            data: {
              full_name: cleanName
            }
          }
        });

        if (error) {
          console.error('❌ [AuthService] Registrasi gagal:', error);
          return {
            success: false,
            message: translateAuthError(error),
            rawError: error
          };
        }

        const user = data?.user;
        const session = data?.session;

        // Jika email confirmation aktif di Supabase, session bernilai null
        if (user && !session) {
          console.log('ℹ️ [AuthService] Registrasi berhasil, menunggu konfirmasi email.');
          return {
            success: true,
            user,
            session: null,
            profile: null,
            isEmailConfirmationRequired: true,
            message: 'Registrasi berhasil! Periksa email Anda untuk verifikasi, atau hubungi admin bila verifikasi otomatis belum aktif.'
          };
        }

        // Jika session langsung aktif
        let profile = null;
        if (user) {
          profile = await this.ensureProfile(user, cleanName);
          this._currentUser = user;
          this._currentProfile = profile;
          this.syncStore(user, profile);
        }

        return {
          success: true,
          user,
          session,
          profile,
          isEmailConfirmationRequired: false,
          message: 'Registrasi berhasil dan Anda telah masuk otomatis!'
        };
      } catch (err) {
        console.error('❌ [AuthService] Unexpected error on signUp:', err);
        return {
          success: false,
          message: translateAuthError(err),
          rawError: err
        };
      }
    },

    /**
     * Masuk (Login) menggunakan email & password
     * Peran diambil dari tabel public.profiles di database, bukan input form!
     * @param {Object} params - { email, password }
     * @returns {Promise<{ success: boolean, user: Object|null, profile: Object|null, role: string, message: string }>}
     */
    async signIn({ email, password }) {
      try {
        const client = this.getClient();
        const trimmedEmail = (email || '').trim();

        if (!trimmedEmail || !password) {
          return {
            success: false,
            message: 'Email dan kata sandi wajib diisi.'
          };
        }

        console.log('📡 [AuthService] Mencoba login dengan:', trimmedEmail);
        const { data, error } = await client.auth.signInWithPassword({
          email: trimmedEmail,
          password: password
        });

        if (error) {
          console.error('❌ [AuthService] Login gagal:', error);
          return {
            success: false,
            message: translateAuthError(error),
            rawError: error
          };
        }

        const user = data.user;
        const session = data.session;

        if (!user) {
          return {
            success: false,
            message: 'Gagal mengambil data akun setelah autentikasi.'
          };
        }

        // Ambil profil resmi dari public.profiles berdasarkan auth.uid()
        let profile = null;
        const { profile: dbProfile, error: profError } = await this.fetchProfile(user.id);
        if (dbProfile) {
          profile = dbProfile;
        } else {
          // Buat profil default jika belum ada
          profile = await this.ensureProfile(user);
        }

        const role = (profile && profile.role) ? profile.role : 'user';
        this._currentUser = user;
        this._currentProfile = profile;
        this.syncStore(user, profile);

        console.log(`✅ [AuthService] Login sukses. ID: ${user.id}, Role Resmi DB: ${role}`);
        return {
          success: true,
          user,
          session,
          profile,
          role,
          message: `Berhasil masuk sebagai ${profile?.full_name || user.email} (${role === 'admin' ? 'Administrator' : 'Pengguna'})`
        };
      } catch (err) {
        console.error('❌ [AuthService] Unexpected error on signIn:', err);
        return {
          success: false,
          message: translateAuthError(err),
          rawError: err
        };
      }
    },

    /**
     * Logout pengguna dari sesi Supabase Auth
     */
    async signOut() {
      try {
        const client = this.getClient();
        console.log('📡 [AuthService] Melakukan proses signOut...');
        await client.auth.signOut();
      } catch (err) {
        console.warn('⚠️ [AuthService] Error saat signOut dari Supabase:', err);
      } finally {
        this._currentUser = null;
        this._currentProfile = null;
        this.clearStore();
        console.log('✅ [AuthService] Pengguna telah keluar.');
      }
      return { success: true };
    },

    /**
     * Mengirim email reset kata sandi melalui Supabase Auth
     * @param {string} email
     */
    async resetPassword(email) {
      try {
        const client = this.getClient();
        const trimmedEmail = String(email || '').trim();
        if (!trimmedEmail) {
          return { success: false, message: 'Masukkan alamat email akun Anda terlebih dahulu.' };
        }

        const redirectTo = (typeof window !== 'undefined' && window.location)
          ? (window.location.origin + window.location.pathname)
          : undefined;

        const { error } = await client.auth.resetPasswordForEmail(trimmedEmail, redirectTo ? { redirectTo } : undefined);
        if (error) {
          return { success: false, message: translateAuthError(error) };
        }

        return {
          success: true,
          message: `Tautan reset kata sandi telah dikirim ke ${trimmedEmail}. Periksa kotak masuk atau folder spam Anda.`
        };
      } catch (err) {
        return { success: false, message: translateAuthError(err) };
      }
    },

    /**
     * Memperbarui nama lengkap pengguna di Supabase Auth & tabel public.profiles
     * @param {string} fullName
     */
    async updateProfileName(fullName) {
      try {
        const client = this.getClient();
        const cleanName = String(fullName || '').trim();
        if (!cleanName || cleanName.length < 2) {
          return { success: false, message: 'Nama lengkap minimal 2 karakter.' };
        }
        if (!this._currentUser) {
          return { success: false, message: 'Sesi pengguna tidak ditemukan.' };
        }

        const { error: authErr } = await client.auth.updateUser({
          data: { full_name: cleanName }
        });
        if (authErr) {
          return { success: false, message: translateAuthError(authErr) };
        }

        const { data: updatedProf, error: profErr } = await client
          .from('profiles')
          .update({ full_name: cleanName })
          .eq('id', this._currentUser.id)
          .select('id, full_name, role')
          .maybeSingle();

        if (profErr) {
          return { success: false, message: profErr.message || 'Gagal memperbarui profil.' };
        }

        this._currentProfile = updatedProf || { ...(this._currentProfile || {}), full_name: cleanName };
        this.syncStore(this._currentUser, this._currentProfile);

        return { success: true, profile: this._currentProfile, message: 'Nama profil berhasil diperbarui.' };
      } catch (err) {
        return { success: false, message: translateAuthError(err) };
      }
    },

    /**
     * Memulihkan sesi saat halaman dimuat/direfresh
     * @returns {Promise<{ isAuthenticated: boolean, user: Object|null, profile: Object|null, role: string }>}
     */
    async restoreSession() {
      try {
        const client = this.getClient();
        console.log('🔍 [AuthService] Memeriksa sesi aktif di browser...');
        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
          console.warn('⚠️ [AuthService] Error membaca session:', error.message);
          this.clearStore();
          return { isAuthenticated: false, user: null, profile: null, role: 'user' };
        }

        if (!session || !session.user) {
          console.log('ℹ️ [AuthService] Tidak ada sesi aktif yang tersimpan.');
          this.clearStore();
          return { isAuthenticated: false, user: null, profile: null, role: 'user' };
        }

        const user = session.user;
        const { profile } = await this.fetchProfile(user.id);
        const resolvedProfile = profile || await this.ensureProfile(user);
        const role = (resolvedProfile && resolvedProfile.role) ? resolvedProfile.role : 'user';

        this._currentUser = user;
        this._currentProfile = resolvedProfile;
        this.syncStore(user, resolvedProfile);

        console.log(`✅ [AuthService] Sesi dipulihkan! User: ${user.email}, Role DB: ${role}`);
        return {
          isAuthenticated: true,
          user,
          profile: resolvedProfile,
          role
        };
      } catch (err) {
        console.error('❌ [AuthService] Error memulihkan sesi:', err);
        this.clearStore();
        return { isAuthenticated: false, user: null, profile: null, role: 'user' };
      }
    },

    /**
     * Menghubungkan sesi terautentikasi ke RoomBookStore global
     */
    syncStore(user, profile) {
      if (typeof window === 'undefined' || !window.RoomBookStore) return;
      const store = window.RoomBookStore;
      const role = (profile && profile.role) ? profile.role : 'user';
      const name = (profile && profile.full_name) || user.user_metadata?.full_name || user.email.split('@')[0];
      const initials = getInitials(name);

      store.currentUser = {
        id: user.id,
        name: name,
        role: role === 'admin' ? 'Administrator Fasilitas' : 'Pengguna Terdaftar',
        dept: role === 'admin' ? 'Biro Aset Operasional Kampus' : 'Civitas Akademika / Instansi',
        email: user.email,
        initials: initials,
        isAuthenticated: true,
        dbRole: role
      };

      store.currentRole = role;
      try {
        localStorage.setItem(store.STORAGE_KEY_CURRENT_USER, role);
      } catch (e) { }

      store.notify();
    },

    /**
     * Membersihkan status pengguna di RoomBookStore saat keluar
     */
    clearStore() {
      if (typeof window === 'undefined' || !window.RoomBookStore) return;
      const store = window.RoomBookStore;
      store.currentUser = {
        id: null,
        name: 'Tamu (Belum Masuk)',
        role: 'Tamu',
        dept: 'Instansi',
        email: '',
        initials: 'TM',
        isAuthenticated: false,
        dbRole: 'user'
      };
      store.currentRole = 'user';
      try {
        localStorage.removeItem(store.STORAGE_KEY_CURRENT_USER);
      } catch (e) { }
      store.notify();
    },

    /**
     * Memeriksa apakah pengguna aktif berhak sebagai administrator
     * Hanya bernilai true jika profile.role di database bernilai 'admin'
     */
    isAdmin() {
      return this._currentProfile && this._currentProfile.role === 'admin';
    },

    /**
     * Memeriksa apakah pengguna terautentikasi
     */
    isAuthenticated() {
      return !!this._currentUser;
    },

    getCurrentUser() {
      return this._currentUser;
    },

    getCurrentProfile() {
      return this._currentProfile;
    }
  };

  // Setup listener perubahan status auth (misal token refresh / signout lintas tab)
  if (typeof window !== 'undefined') {
    window.AuthService = AuthService;

    // Tunggu DOM dan inisialisasi onAuthStateChange
    window.addEventListener('DOMContentLoaded', () => {
      try {
        const client = window.supabaseClient;
        if (client && client.auth) {
          client.auth.onAuthStateChange(async (event, session) => {
            console.log(`🔔 [AuthService] onAuthStateChange event: ${event}`);
            if (event === 'SIGNED_OUT') {
              AuthService.clearStore();
              if (window.RoomBookApp && window.RoomBookApp.currentRoute !== 'login') {
                window.RoomBookApp.showToast('Sesi Anda telah berakhir. Silakan masuk kembali.', 'info');
                window.RoomBookApp.navigate('#login');
              }
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (session && session.user) {
                const { profile } = await AuthService.fetchProfile(session.user.id);
                AuthService.syncStore(session.user, profile);
              }
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ [AuthService] Tidak dapat mengaktifkan listener authStateChange:', e);
      }
    });
  }
})();
