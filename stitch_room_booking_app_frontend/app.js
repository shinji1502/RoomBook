// RoomBook Mobile App Router & Unified Controller
// Compliant with DESIGN.md and Google Stitch exported components

(function() {
  'use strict';

  const RoomBookStore = (typeof window !== 'undefined' && window.RoomBookStore) || (typeof globalThis !== 'undefined' && globalThis.RoomBookStore);

  const App = {
    currentRoute: '',
    params: {},
    activeAdminFilter: 'pending',
    activeUserHistoryFilter: 'all',
    authMode: 'login', // 'login' | 'register'
    _isRestoringSession: true,
    _hasCheckedInitialSession: false,
    detailReservationState: { id: null, status: 'idle', error: null, errorCode: null },
    adminDetailPengajuanState: { id: null, status: 'idle', error: null, errorCode: null },
    _riwayatInitialLoadDone: false,
    _fetchingHistoryResId: null,
    _pendingRoomPhotoFile: null,
    _pendingRoomPhotoPreview: null,
    _targetDeleteRoomId: null,
    _pendingCatalogFilter: 'all',
    _catalogSearchQuery: '',
    _liveRoomScheduleSlots: [],
    _editingRoomId: null,

    async init() {
      // Inisialisasi Supabase Realtime channel
      RoomBookStore.initRealtimeSubscription();

      // Listen to hash changes
      window.addEventListener('hashchange', () => this.handleRouting());
      
      // Subscribe to store updates
      RoomBookStore.subscribe(() => {
        this.updateSimulationControls();
        this.render();
      });

      // Bind modal reject confirmation
      const submitRejectBtn = document.getElementById('btn-submit-reject');
      if (submitRejectBtn) {
        submitRejectBtn.addEventListener('click', () => this.executeRejectReservation());
      }

      // Bind modal delete room confirmation
      const confirmDeleteRoomBtn = document.getElementById('btn-confirm-delete-room');
      if (confirmDeleteRoomBtn) {
        confirmDeleteRoomBtn.addEventListener('click', () => this.executeDeleteRoom());
      }

      // Bind modal forgot password, admin check-in, and edit profile
      const submitForgotPwdBtn = document.getElementById('btn-submit-forgot-pwd');
      if (submitForgotPwdBtn) {
        submitForgotPwdBtn.addEventListener('click', () => this.executeForgotPassword());
      }
      const submitCheckInBtn = document.getElementById('btn-submit-admin-checkin');
      if (submitCheckInBtn) {
        submitCheckInBtn.addEventListener('click', () => this.executeAdminCheckIn());
      }
      const submitEditProfileBtn = document.getElementById('btn-submit-edit-profile');
      if (submitEditProfileBtn) {
        submitEditProfileBtn.addEventListener('click', () => this.executeEditProfileName());
      }

      // Bind modal reject pills
      const rejectPills = document.querySelectorAll('#reject-reason-pills .quick-reason');
      const rejectNotes = document.getElementById('reject-admin-notes');
      rejectPills.forEach(pill => {
        pill.addEventListener('click', () => {
          rejectPills.forEach(p => {
            p.classList.remove('bg-primary', 'text-on-primary');
            p.classList.add('bg-surface-container', 'text-on-surface-variant');
          });
          pill.classList.remove('bg-surface-container', 'text-on-surface-variant');
          pill.classList.add('bg-primary', 'text-on-primary');
          if (rejectNotes) {
            rejectNotes.value = pill.dataset.reason;
          }
        });
      });

      // 1. Memulihkan sesi Supabase Auth saat start
      let sessionState = { isAuthenticated: false, user: null, role: 'user' };
      if (window.AuthService && typeof window.AuthService.restoreSession === 'function') {
        sessionState = await window.AuthService.restoreSession();
      }
      this._hasCheckedInitialSession = true;
      this._isRestoringSession = false;

      // 2. Initial route setup berdasarkan status autentikasi
      if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
        if (sessionState.isAuthenticated) {
          window.location.hash = sessionState.role === 'admin' ? '#admin/dashboard' : '#user/dashboard';
        } else {
          window.location.hash = '#login';
        }
      }
      this.handleRouting();

      // 3. Memuat data ruangan dari Supabase secara otomatis saat start
      if (RoomBookStore && typeof RoomBookStore.loadRoomsFromDatabase === 'function') {
        RoomBookStore.loadRoomsFromDatabase().then(async () => {
          // Sinkronkan status selesai (expired approved) lalu muat reservasi
          if (sessionState.isAuthenticated && typeof RoomBookStore.completeExpiredReservationsSupabase === 'function') {
            await RoomBookStore.completeExpiredReservationsSupabase();
          }
          if (RoomBookStore && typeof RoomBookStore.loadReservationsFromDatabase === 'function') {
            RoomBookStore.loadReservationsFromDatabase();
          }
        });
      }
    },

    showToast(message, icon = 'check_circle') {
      const toast = document.getElementById('global-toast');
      const toastText = document.getElementById('global-toast-text');
      const toastIcon = document.getElementById('global-toast-icon');
      if (!toast) return;

      toastText.textContent = message;
      toastIcon.textContent = icon;
      toast.classList.remove('opacity-0', '-translate-y-4');
      toast.classList.add('opacity-100', 'translate-y-0');

      clearTimeout(window._toastTimeout);
      window._toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4');
        toast.classList.remove('opacity-100', 'translate-y-0');
      }, 3000);
    },

    switchRole(role) {
      if (role === 'admin') {
        const isAdmin = window.AuthService ? window.AuthService.isAdmin() : (RoomBookStore.currentRole === 'admin');
        if (!isAdmin) {
          this.showToast('Akses ditolak: Akun database Anda tidak memiliki hak akses Administrator.', 'gpp_bad');
          return;
        }
        RoomBookStore.setRole('admin');
        this.updateSimulationControls();
        if (typeof RoomBookStore.loadRoomsFromDatabase === 'function') {
          RoomBookStore.loadRoomsFromDatabase();
        }
        this.showToast('Beralih ke Portal Administrator 🛡️', 'admin_panel_settings');
        this.navigate('#admin/dashboard');
      } else {
        RoomBookStore.setRole('user');
        this.updateSimulationControls();
        if (typeof RoomBookStore.loadRoomsFromDatabase === 'function') {
          RoomBookStore.loadRoomsFromDatabase();
        }
        this.showToast('Beralih ke Portal Pengguna 👤', 'person');
        this.navigate('#user/dashboard');
      }
    },

    updateSimulationControls() {
      const userBtn = document.getElementById('sim-role-user');
      const adminBtn = document.getElementById('sim-role-admin');
      if (userBtn && adminBtn) {
        if (RoomBookStore.currentRole === 'admin') {
          adminBtn.className = 'px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-1 bg-primary text-on-primary shadow-xs';
          userBtn.className = 'px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-1 text-on-surface-variant hover:text-primary';
        } else {
          userBtn.className = 'px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-1 bg-primary text-on-primary shadow-xs';
          adminBtn.className = 'px-2.5 py-1 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-1 text-on-surface-variant hover:text-primary';
        }
      }

      // Update badge dan toggle indikator Data Source
      const dsIndicator = document.getElementById('sim-datasource-indicator');
      const dsDot = document.getElementById('sim-ds-dot');
      const dsLabel = document.getElementById('sim-ds-label');
      const dsToggleText = document.getElementById('sim-ds-toggle-text');

      if (dsIndicator && dsDot && dsLabel && dsToggleText) {
        const count = RoomBookStore.getRooms().length;
        if (RoomBookStore.dataSource === 'supabase') {
          dsDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
          dsLabel.textContent = `Supabase DB (${count})`;
          dsToggleText.textContent = 'Pakai Fallback';
          dsIndicator.title = 'Data tersambung langsung ke tabel rooms di Supabase';
        } else {
          dsDot.className = 'w-2 h-2 rounded-full bg-amber-500';
          dsLabel.textContent = `Fallback Dummy (${count})`;
          dsToggleText.textContent = 'Pakai Supabase';
          dsIndicator.title = 'Data menggunakan fallback dummy local data.js';
        }
      }
    },

    toggleDataSource() {
      if (RoomBookStore.dataSource === 'supabase') {
        RoomBookStore.useFallbackData();
        this.showToast('Beralih ke Fallback Dummy Data 🟡', 'info');
      } else {
        this.showToast('Menghubungkan ke Supabase DB... ⏳', 'sync');
        RoomBookStore.useDatabaseData().then(res => {
          if (res.success) {
            this.showToast(`Supabase terhubung (${res.count} ruangan) 🟢`, 'check_circle');
          } else {
            this.showToast('Gagal memuat Supabase: ' + (res.error?.message || 'Error'), 'error');
          }
        });
      }
    },

    async resetDataDemo() {
      if (RoomBookStore.dataSource === 'supabase') {
        this.showToast('Menyinkronkan ulang data dari database Supabase...', 'sync');
        await RoomBookStore.loadReservationsFromDatabase();
        this.showToast('Data reservasi telah diperbarui dari database Supabase', 'check_circle');
      } else {
        RoomBookStore.resetToInitial();
        this.showToast('Data demo lokal berhasil dikembalikan ke status awal', 'restart_alt');
      }
      this.render();
    },

    navigate(hash) {
      window.location.hash = hash;
    },

    handleRouting() {
      const rawHash = window.location.hash.slice(1) || 'login';
      const parts = rawHash.split('/');
      this.currentRoute = parts[0] + (parts[1] ? `/${parts[1]}` : '');
      this.params = {
        id: parts[2] || null
      };
      if (this.currentRoute !== 'user/riwayat') {
        this._riwayatInitialLoadDone = false;
      }

      const isAuth = window.AuthService ? window.AuthService.isAuthenticated() : false;
      const isAdmin = window.AuthService ? window.AuthService.isAdmin() : (RoomBookStore.currentRole === 'admin');

      // Proteksi rute: jika belum login dan bukan di halaman login
      if (this.currentRoute !== 'login' && !isAuth && this._hasCheckedInitialSession) {
        this.showToast('Silakan masuk terlebih dahulu untuk mengakses RoomBook.', 'lock');
        this.navigate('#login');
        return;
      }

      // Proteksi rute: jika sudah login dan membuka #login
      if (this.currentRoute === 'login' && isAuth) {
        this.navigate(isAdmin ? '#admin/dashboard' : '#user/dashboard');
        return;
      }

      // Proteksi otorisasi admin: pengguna non-admin tidak boleh akses rute admin
      if (this.currentRoute.startsWith('admin/') && !isAdmin) {
        this.showToast('Akses ditolak: Akun Anda tidak memiliki hak akses Administrator.', 'gpp_bad');
        this.navigate('#user/dashboard');
        return;
      }
      
      // Auto-sync store selected IDs if given in URL
      if (parts[1] === 'detail-ruangan' && parts[2]) {
        RoomBookStore.selectedRoomId = decodeURIComponent(parts[2]);
      }
      if (parts[1] === 'form-reservasi' && parts[2]) {
        RoomBookStore.selectedRoomId = decodeURIComponent(parts[2]);
      }
      if ((parts[1] === 'detail-reservasi' || parts[1] === 'detail-pengajuan') && parts[2]) {
        RoomBookStore.selectedReservationId = decodeURIComponent(parts[2]);
      }

      if ((this.currentRoute === 'user/dashboard' || this.currentRoute === 'user/ketersediaan') && window.supabaseClient && typeof RoomBookStore.loadRoomsFromDatabase === 'function') {
        RoomBookStore.loadRoomsFromDatabase({ silent: true });
      }

      this.render();
      window.scrollTo(0, 0);
    },

    render() {
      const root = document.getElementById('view-root');
      if (!root) return;

      root.className = 'flex-1 flex flex-col w-full page-fade-in';
      root.innerHTML = '';

      switch (this.currentRoute) {
        case 'login':
          root.innerHTML = this.renderLoginView();
          this.bindLoginEvents();
          break;

        case 'user/dashboard':
          root.innerHTML = this.renderUserDashboardView();
          this.bindUserDashboardEvents();
          break;

        case 'user/ketersediaan':
          root.innerHTML = this.renderKetersediaanView();
          this.bindKetersediaanEvents();
          break;

        case 'user/detail-ruangan':
          root.innerHTML = this.renderDetailRuanganView();
          this.bindDetailRuanganEvents();
          break;

        case 'user/form-reservasi':
          root.innerHTML = this.renderFormReservasiView();
          this.bindFormReservasiEvents();
          break;

        case 'user/riwayat':
          root.innerHTML = this.renderRiwayatView();
          this.bindRiwayatEvents();
          break;

        case 'user/detail-reservasi':
          root.innerHTML = this.renderDetailReservasiView();
          this.bindDetailReservasiEvents();
          break;

        case 'admin/dashboard':
          root.innerHTML = this.renderAdminDashboardView();
          this.bindAdminDashboardEvents();
          break;

        case 'admin/approval':
          root.innerHTML = this.renderAdminApprovalView();
          this.bindAdminApprovalEvents();
          break;

        case 'admin/detail-pengajuan':
          root.innerHTML = this.renderAdminDetailPengajuanView();
          this.bindAdminDetailPengajuanEvents();
          break;

        case 'admin/tambah-ruangan':
          root.innerHTML = this.renderAdminTambahRuanganView();
          this.bindAdminTambahRuanganEvents();
          break;

        case 'user/profil':
        case 'admin/profil':
          root.innerHTML = this.renderProfilView();
          break;

        default:
          root.innerHTML = this.renderUserDashboardView();
          this.bindUserDashboardEvents();
          break;
      }
    },

    // ==========================================
    // 1. LOGIN & REGISTER VIEW
    // ==========================================
    setAuthMode(mode) {
      this.authMode = mode;
      const root = document.getElementById('view-root');
      if (root) {
        root.innerHTML = this.renderLoginView();
        this.bindLoginEvents();
      }
    },

    showAuthFeedback(message, type = 'error') {
      const feedbackEl = document.getElementById('auth-feedback');
      if (!feedbackEl) return;
      feedbackEl.classList.remove('hidden');
      if (type === 'error') {
        feedbackEl.className = 'p-3 rounded-xl bg-error-container text-on-error-container border border-error/30 text-xs flex items-start gap-2 leading-relaxed';
        feedbackEl.innerHTML = `<span class="material-symbols-outlined text-error text-base shrink-0">error</span><span>${message}</span>`;
      } else {
        feedbackEl.className = 'p-3 rounded-xl bg-primary-fixed text-on-primary-fixed border border-primary/30 text-xs flex items-start gap-2 leading-relaxed';
        feedbackEl.innerHTML = `<span class="material-symbols-outlined text-primary text-base shrink-0">info</span><span>${message}</span>`;
      }
    },

    renderLoginView() {
      const isRegister = this.authMode === 'register';

      return `
        <main class="flex-1 flex flex-col relative w-full bg-surface px-margin justify-center py-8">
          <div class="flex flex-col w-full select-none max-w-sm mx-auto">
            <!-- Brand / Header Section -->
            <div class="flex flex-col items-center text-center mb-5 relative">
              <div class="relative mb-3 group">
                <div class="w-16 h-16 rounded-2xl bg-primary-container flex items-center justify-center shadow-lg shadow-primary-container/20">
                  <span class="material-symbols-outlined text-primary-fixed text-3xl" style="font-variation-settings: 'FILL' 1;">meeting_room</span>
                </div>
                <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary shadow-md">
                  <span class="material-symbols-outlined text-xs">calendar_month</span>
                </div>
              </div>
              <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed mb-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                <span class="font-label-sm text-[11px] font-semibold tracking-wide uppercase">Workspace Portal</span>
              </div>
              <h1 class="font-headline-lg text-2xl text-on-surface tracking-tight font-bold">
                ${isRegister ? 'Daftar Akun RoomBook' : 'Selamat Datang di RoomBook'}
              </h1>
              <p class="font-body-md text-body-md text-on-surface-variant max-w-[280px] mt-1">
                ${isRegister ? 'Buat akun baru untuk peminjaman ruangan kampus & instansi' : 'Solusi cerdas peminjaman ruangan kampus & kantor'}
              </p>
            </div>

            <!-- Main Card Container -->
            <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <!-- Auth Mode Switcher Tabs (Masuk vs Daftar) -->
              <div class="flex bg-surface-container-low p-1 rounded-xl">
                <button type="button" onclick="RoomBookApp.setAuthMode('login')"
                  class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${!isRegister ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface cursor-pointer'}">
                  <span class="material-symbols-outlined text-sm">login</span>
                  <span>Masuk Akun</span>
                </button>
                <button type="button" onclick="RoomBookApp.setAuthMode('register')"
                  class="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${isRegister ? 'bg-primary text-on-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface cursor-pointer'}">
                  <span class="material-symbols-outlined text-sm">person_add</span>
                  <span>Daftar Akun Baru</span>
                </button>
              </div>

              <!-- Inline Auth Feedback Message Banner -->
              <div id="auth-feedback" class="hidden"></div>

              ${!isRegister ? `
                <!-- Form Masuk (Login) -->
                <form class="flex flex-col gap-3.5" id="loginForm" onsubmit="event.preventDefault(); RoomBookApp.handleLoginSubmit();">
                  <!-- Email / Identifier Input -->
                  <div class="flex flex-col gap-1">
                    <label class="font-label-md text-label-md text-on-surface font-semibold" for="login-identifier">
                      Alamat Email
                    </label>
                    <div class="relative flex items-center bg-surface-container-low rounded-xl px-3.5 py-2.5 transition-colors focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                      <span class="material-symbols-outlined text-on-surface-variant mr-3 text-lg">alternate_email</span>
                      <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none" id="login-identifier" value="" placeholder="nama@instansi.ac.id" required="" type="email"/>
                    </div>
                  </div>

                  <!-- Password Input -->
                  <div class="flex flex-col gap-1">
                    <div class="flex items-center justify-between">
                      <label class="font-label-md text-label-md text-on-surface font-semibold" for="login-password">
                        Kata Sandi
                      </label>
                      <button class="font-label-sm text-label-sm text-secondary hover:text-primary transition-colors cursor-pointer" onclick="RoomBookApp.openForgotPasswordModal()" type="button">
                        Lupa Password?
                      </button>
                    </div>
                    <div class="relative flex items-center bg-surface-container-low rounded-xl px-3.5 py-2.5 transition-colors focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                      <span class="material-symbols-outlined text-on-surface-variant mr-3 text-lg">lock</span>
                      <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none" id="login-password" value="" placeholder="••••••••" required="" type="password"/>
                      <button aria-label="Lihat kata sandi" class="text-on-surface-variant hover:text-on-surface ml-2 p-0.5 cursor-pointer" id="togglePasswordBtn" onclick="RoomBookApp.togglePasswordVisibility()" type="button">
                        <span class="material-symbols-outlined text-lg" id="pwdIcon">visibility</span>
                      </button>
                    </div>
                  </div>

                  <!-- Role Selection in Login (Visual UI dipelihara, otorisasi riil diverifikasi via DB) -->
                  <div class="pt-1">
                    <div class="flex items-center justify-between mb-1">
                      <label class="font-label-sm text-xs text-on-surface-variant block">Portal Tujuan:</label>
                      <span class="text-[10px] text-primary font-medium flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[12px]">verified_user</span>Otorisasi Supabase
                      </span>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <label class="flex items-center gap-2 p-2 rounded-xl bg-primary-fixed/40 border border-primary/20 cursor-pointer">
                        <input type="radio" name="loginRole" value="user" checked class="text-primary focus:ring-primary" id="role-radio-user"/>
                        <span class="text-xs font-semibold text-primary">Portal User</span>
                      </label>
                      <label class="flex items-center gap-2 p-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 cursor-pointer">
                        <input type="radio" name="loginRole" value="admin" class="text-primary focus:ring-primary" id="role-radio-admin"/>
                        <span class="text-xs font-semibold text-on-surface">Portal Admin</span>
                      </label>
                    </div>
                    <p class="text-[10px] text-outline mt-1 leading-tight">
                      *Akses administrator diverifikasi dari tabel <code class="bg-surface-container px-1 py-0.5 rounded text-[9px]">profiles</code> di Supabase.
                    </p>
                  </div>

                  <!-- Primary Submit Button -->
                  <button class="w-full mt-1 bg-primary text-on-primary py-3 px-4 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer" id="submitLoginBtn" type="submit">
                    <span>Masuk Aplikasi</span>
                    <span class="material-symbols-outlined text-lg">arrow_forward</span>
                  </button>
                </form>
              ` : `
                <!-- Form Registrasi (Sign Up) -->
                <form class="flex flex-col gap-3.5" id="registerForm" onsubmit="event.preventDefault(); RoomBookApp.handleRegisterSubmit();">
                  <!-- Nama Lengkap Input -->
                  <div class="flex flex-col gap-1">
                    <label class="font-label-md text-label-md text-on-surface font-semibold" for="register-fullname">
                      Nama Lengkap
                    </label>
                    <div class="relative flex items-center bg-surface-container-low rounded-xl px-3.5 py-2.5 transition-colors focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                      <span class="material-symbols-outlined text-on-surface-variant mr-3 text-lg">badge</span>
                      <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none" id="register-fullname" placeholder="Contoh: Ahmad Rizki" required="" type="text"/>
                    </div>
                  </div>

                  <!-- Email Input -->
                  <div class="flex flex-col gap-1">
                    <label class="font-label-md text-label-md text-on-surface font-semibold" for="register-email">
                      Alamat Email
                    </label>
                    <div class="relative flex items-center bg-surface-container-low rounded-xl px-3.5 py-2.5 transition-colors focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                      <span class="material-symbols-outlined text-on-surface-variant mr-3 text-lg">mail</span>
                      <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none" id="register-email" placeholder="nama@instansi.ac.id" required="" type="email"/>
                    </div>
                  </div>

                  <!-- Password Input -->
                  <div class="flex flex-col gap-1">
                    <label class="font-label-md text-label-md text-on-surface font-semibold" for="register-password">
                      Kata Sandi (Min. 6 Karakter)
                    </label>
                    <div class="relative flex items-center bg-surface-container-low rounded-xl px-3.5 py-2.5 transition-colors focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                      <span class="material-symbols-outlined text-on-surface-variant mr-3 text-lg">lock</span>
                      <input class="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-outline outline-none" id="register-password" placeholder="••••••••" required="" minlength="6" type="password"/>
                    </div>
                  </div>

                  <!-- Security Policy Notice (Role Enforcement) -->
                  <div class="p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-[11px] text-on-surface-variant flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-base shrink-0">shield</span>
                    <span>Pendaftaran akun baru otomatis berstatus <strong>Pengguna (Role: User)</strong> demi keamanan institusi.</span>
                  </div>

                  <!-- Primary Submit Button -->
                  <button class="w-full mt-1 bg-primary text-on-primary py-3 px-4 rounded-xl font-headline-sm text-headline-sm shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer" id="submitRegisterBtn" type="submit">
                    <span>Daftar Akun Pengguna</span>
                    <span class="material-symbols-outlined text-lg">person_add</span>
                  </button>
                </form>
              `}

              <!-- Divider -->
              <div class="flex items-center gap-3 my-0.5">
                <div class="h-px bg-surface-container-highest flex-1"></div>
                <span class="font-label-sm text-[11px] text-outline uppercase tracking-wider">atau opsi masuk</span>
                <div class="h-px bg-surface-container-highest flex-1"></div>
              </div>

              <!-- SSO Actions -->
              <div class="flex flex-col gap-2">
                <button class="w-full bg-surface-container-low text-on-surface py-2.5 px-4 rounded-xl font-label-md text-label-md hover:bg-surface-container transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs" onclick="RoomBookApp.triggerSSO('Kampus SSO')" type="button">
                  <span class="material-symbols-outlined text-primary text-lg">school</span>
                  <span>Masuk SSO Kampus</span>
                </button>
                <button class="w-full bg-surface-container-low text-on-surface py-2.5 px-4 rounded-xl font-label-md text-label-md hover:bg-surface-container transition-all flex items-center justify-center gap-3 cursor-pointer shadow-xs" onclick="RoomBookApp.triggerSSO('Google Workspace')" type="button">
                  <svg class="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"></path>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"></path>
                  </svg>
                  <span>Google Workspace Instansi</span>
                </button>
              </div>

              <!-- Quick Switcher to Administrator Portal -->
              <div class="pt-1">
                <button class="w-full bg-secondary-fixed text-on-secondary-fixed py-2 px-3 rounded-xl font-label-md text-label-md flex items-center justify-between hover:bg-secondary-fixed-dim transition-colors group cursor-pointer" onclick="RoomBookApp.switchRole('admin')" type="button">
                  <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-secondary text-base" style="font-variation-settings: 'FILL' 1;">shield</span>
                    <span class="font-semibold text-xs">Akses Khusus Administrator</span>
                  </div>
                  <span class="material-symbols-outlined text-sm transition-transform group-hover:translate-x-0.5">chevron_right</span>
                </button>
              </div>
            </div>

            <!-- Footer Info -->
            <div class="mt-4 flex flex-col items-center text-center gap-1">
              <div class="flex items-center gap-1.5 text-outline font-label-sm text-[11px]">
                <span class="material-symbols-outlined text-sm">lock_clock</span>
                <span>Terenkripsi 256-bit standar institusi • Supabase Auth</span>
              </div>
            </div>
          </div>
        </main>
      `;
    },

    bindLoginEvents() {
      // Dynamic role radio styling
      const roleUser = document.getElementById('role-radio-user');
      const roleAdmin = document.getElementById('role-radio-admin');
      if (roleUser && roleAdmin) {
        roleUser.addEventListener('change', () => {
          roleUser.parentElement.className = 'flex items-center gap-2 p-2 rounded-xl bg-primary-fixed/40 border border-primary/20 cursor-pointer';
          roleAdmin.parentElement.className = 'flex items-center gap-2 p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer';
        });
        roleAdmin.addEventListener('change', () => {
          roleAdmin.parentElement.className = 'flex items-center gap-2 p-2 rounded-xl bg-primary-fixed/40 border border-primary/20 cursor-pointer';
          roleUser.parentElement.className = 'flex items-center gap-2 p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 cursor-pointer';
        });
      }
    },

    async handleLoginSubmit() {
      const emailInput = document.getElementById('login-identifier');
      const passwordInput = document.getElementById('login-password');
      const feedbackEl = document.getElementById('auth-feedback');
      const btn = document.getElementById('submitLoginBtn');

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        this.showAuthFeedback('Email dan kata sandi wajib diisi.', 'error');
        return;
      }

      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-base">progress_activity</span><span>Memverifikasi akun...</span>`;
        btn.disabled = true;
      }

      if (feedbackEl) feedbackEl.classList.add('hidden');

      try {
        if (!window.AuthService) {
          throw new Error('Modul AuthService belum dimuat. Periksa file authService.js.');
        }

        const result = await window.AuthService.signIn({ email, password });
        if (!result.success) {
          this.showAuthFeedback(result.message, 'error');
          if (btn) {
            btn.innerHTML = `<span>Masuk Aplikasi</span><span class="material-symbols-outlined text-lg">arrow_forward</span>`;
            btn.disabled = false;
          }
          this.showToast(result.message, 'error');
          return;
        }

        // Login sukses!
        this.updateSimulationControls();
        const isAdmin = result.role === 'admin';
        const targetRoute = isAdmin ? '#admin/dashboard' : '#user/dashboard';
        
        const selectedRadioRole = document.querySelector('input[name="loginRole"]:checked')?.value;
        if (selectedRadioRole === 'admin' && !isAdmin) {
          this.showToast(`Login berhasil sebagai Pengguna biasa. Akun ini tidak memiliki peran Admin di database.`, 'info');
        } else {
          this.showToast(`Login berhasil sebagai ${result.profile?.full_name || email} (${isAdmin ? 'Admin' : 'User'})`, 'check_circle');
        }

        if (RoomBookStore && typeof RoomBookStore.loadRoomsFromDatabase === 'function') {
          RoomBookStore.loadRoomsFromDatabase().then(async () => {
            if (typeof RoomBookStore.completeExpiredReservationsSupabase === 'function') {
              await RoomBookStore.completeExpiredReservationsSupabase();
            }
            if (typeof RoomBookStore.loadReservationsFromDatabase === 'function') {
              RoomBookStore.loadReservationsFromDatabase();
            }
          });
        } else if (RoomBookStore && typeof RoomBookStore.loadReservationsFromDatabase === 'function') {
          RoomBookStore.loadReservationsFromDatabase();
        }

        this.navigate(targetRoute);
      } catch (err) {
        console.error('Error during login submit:', err);
        this.showAuthFeedback(err.message || 'Terjadi kendala saat menghubungkan ke Supabase.', 'error');
        if (btn) {
          btn.innerHTML = `<span>Masuk Aplikasi</span><span class="material-symbols-outlined text-lg">arrow_forward</span>`;
          btn.disabled = false;
        }
      }
    },

    async handleRegisterSubmit() {
      const nameInput = document.getElementById('register-fullname');
      const emailInput = document.getElementById('register-email');
      const passwordInput = document.getElementById('register-password');
      const feedbackEl = document.getElementById('auth-feedback');
      const btn = document.getElementById('submitRegisterBtn');

      const fullName = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!fullName || !email || !password) {
        this.showAuthFeedback('Nama lengkap, email, dan kata sandi wajib diisi.', 'error');
        return;
      }

      if (password.length < 6) {
        this.showAuthFeedback('Kata sandi minimal 6 karakter.', 'error');
        return;
      }

      if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-base">progress_activity</span><span>Mendaftarkan akun...</span>`;
        btn.disabled = true;
      }

      if (feedbackEl) feedbackEl.classList.add('hidden');

      try {
        if (!window.AuthService) {
          throw new Error('Modul AuthService belum dimuat.');
        }

        const result = await window.AuthService.signUp({ email, password, fullName });
        if (!result.success) {
          this.showAuthFeedback(result.message, 'error');
          if (btn) {
            btn.innerHTML = `<span>Daftar Akun Pengguna</span><span class="material-symbols-outlined text-lg">person_add</span>`;
            btn.disabled = false;
          }
          this.showToast(result.message, 'error');
          return;
        }

        if (result.isEmailConfirmationRequired) {
          this.showAuthFeedback(result.message, 'info');
          this.showToast('Pendaftaran akun berhasil!', 'mail');
          if (btn) {
            btn.innerHTML = `<span>Daftar Akun Pengguna</span><span class="material-symbols-outlined text-lg">person_add</span>`;
            btn.disabled = false;
          }
        } else {
          this.showToast(`Selamat datang, ${fullName}! Pendaftaran berhasil.`, 'check_circle');
          this.updateSimulationControls();
          this.navigate('#user/dashboard');
        }
      } catch (err) {
        console.error('Error during register submit:', err);
        this.showAuthFeedback(err.message || 'Terjadi kesalahan saat mendaftar.', 'error');
        if (btn) {
          btn.innerHTML = `<span>Daftar Akun Pengguna</span><span class="material-symbols-outlined text-lg">person_add</span>`;
          btn.disabled = false;
        }
      }
    },

    async handleLogout() {
      if (window.AuthService) {
        await window.AuthService.signOut();
      }
      this.updateSimulationControls();
      this.showToast('Anda telah keluar dari akun.', 'logout');
      this.navigate('#login');
    },

    togglePasswordVisibility() {
      const passwordInput = document.getElementById('login-password');
      const pwdIcon = document.getElementById('pwdIcon');
      if (!passwordInput || !pwdIcon) return;
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        pwdIcon.textContent = 'visibility_off';
      } else {
        passwordInput.type = 'password';
        pwdIcon.textContent = 'visibility';
      }
    },

    async triggerSSO(provider) {
      if (provider === 'Google Workspace') {
        const client = window.supabaseClient;
        if (client && client.auth) {
          try {
            this.showToast('Menghubungkan ke Google OAuth Supabase...', 'sync');
            const { data, error } = await client.auth.signInWithOAuth({
              provider: 'google',
              options: {
                redirectTo: window.location.origin + window.location.pathname
              }
            });
            if (error) {
              this.showToast('Google OAuth belum diaktifkan di Supabase Dashboard: ' + error.message, 'error');
            }
          } catch (err) {
            this.showToast('Gagal memproses OAuth: ' + err.message, 'error');
          }
          return;
        }
      }
      this.showToast(`Autentikasi ${provider} memerlukan konfigurasi OAuth provider pada project Supabase. Silakan masuk dengan Email & Password terdaftar.`, 'info');
    },

    // ==========================================
    // 2. USER DASHBOARD VIEW
    // ==========================================
    renderUserDashboardView() {
      const userBookings = RoomBookStore.getUserReservations();
      const latestBooking = userBookings[0] || null;
      const rooms = [...RoomBookStore.getRooms()].sort((a, b) => Number(b.dbId || 0) - Number(a.dbId || 0));
      const currentUser = RoomBookStore.currentUser || {};
      const userName = currentUser.name || 'Pengguna';
      const userDept = currentUser.dept || 'Civitas Akademika';
      const userInitials = currentUser.initials || 'US';

      // Status indicator details for highlight card
      let statusColor = 'amber-500';
      let statusBg = 'amber-50';
      let statusText = 'amber-700';
      let statusLabel = 'Menunggu Persetujuan';
      let statusIcon = 'hourglass_top';

      if (latestBooking) {
        if (latestBooking.status === 'approved') {
          statusColor = 'emerald-500';
          statusBg = 'emerald-50';
          statusText = 'emerald-700';
          statusLabel = 'Telah Disetujui';
          statusIcon = 'check_circle';
        } else if (latestBooking.status === 'rejected') {
          statusColor = 'rose-500';
          statusBg = 'rose-50';
          statusText = 'rose-700';
          statusLabel = 'Ditolak Admin';
          statusIcon = 'cancel';
        } else if (latestBooking.status === 'cancelled') {
          statusColor = 'slate-400';
          statusBg = 'slate-100';
          statusText = 'slate-700';
          statusLabel = 'Dibatalkan';
          statusIcon = 'block';
        } else if (latestBooking.status === 'completed') {
          statusColor = 'indigo-500';
          statusBg = 'indigo-50';
          statusText = 'indigo-700';
          statusLabel = 'Selesai Digunakan';
          statusIcon = 'task_alt';
        }
      }

      const pendingCount = userBookings.filter(b => b.status === 'pending').length;
      const approvedCount = userBookings.filter(b => b.status === 'approved').length;

      const indonesianMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const now = new Date();
      const todayLabel = `${now.getDate()} ${indonesianMonths[now.getMonth()]}`;
      const notifMsg = pendingCount > 0
        ? `${pendingCount} reservasi menunggu persetujuan & ${approvedCount} disetujui`
        : `${approvedCount} reservasi aktif telah disetujui`;

      return `
        <!-- Shell Header -->
        ${this.renderHeader('Beranda', false)}

        <!-- Main Content -->
        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-space-md">
            
            <!-- Header Sapaan & Status Identitas -->
            <div class="flex items-center justify-between pt-space-xs">
              <div class="flex flex-col">
                <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight flex items-center gap-1.5">
                  Halo, ${userName} <span class="text-[20px]">👋</span>
                </h1>
                <p class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                  ${userDept} • Hari ini, ${todayLabel}
                </p>
              </div>
              <div class="relative flex items-center gap-2">
                <button aria-label="Notifikasi penting" onclick="RoomBookApp.showToast('${notifMsg}', 'notifications')" class="relative w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary shadow-sm hover:bg-surface-container-high transition-transform active:scale-95" type="button">
                  <span class="material-symbols-outlined text-[20px]">notifications</span>
                  ${pendingCount > 0 ? '<span class="absolute top-2 right-2 w-2.5 h-2.5 bg-error rounded-full ring-2 ring-surface"></span>' : ''}
                </button>
                <div onclick="RoomBookApp.navigate('#user/profil')" class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-sm cursor-pointer" title="Lihat Profil Saya">
                  <span class="font-headline-sm text-headline-sm font-bold">${userInitials}</span>
                </div>
              </div>
            </div>

            <!-- Search & Filter Controls -->
            <div class="flex items-center gap-space-sm">
              <div class="relative flex-1 flex items-center">
                <span class="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">search</span>
                <input class="w-full h-12 pl-10 pr-4 bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline shadow-sm focus:outline-none focus:bg-surface-container-low transition-all" placeholder="Cari ruangan rapat, auditorium..." type="text" oninput="RoomBookApp.handleDashboardSearch(this.value)"/>
              </div>
              <button aria-label="Filter Pencarian Ruangan" onclick="RoomBookApp.openCatalogWithFilter('all')" class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95 transition-transform" type="button">
                <span class="material-symbols-outlined text-[22px]">tune</span>
              </button>
            </div>

            <!-- Quick Filter Pills -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-margin px-margin">
              <button onclick="RoomBookApp.openCatalogWithFilter('all')" class="px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm whitespace-nowrap shadow-sm cursor-pointer">
                Semua Ruang
              </button>
              <button onclick="RoomBookApp.openCatalogWithFilter('large')" class="px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:bg-surface-container-low cursor-pointer">
                Kapasitas ≥ 20
              </button>
              <button onclick="RoomBookApp.openCatalogWithFilter('floor3')" class="px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:bg-surface-container-low cursor-pointer">
                Lantai 3
              </button>
              <button onclick="RoomBookApp.openCatalogWithFilter('projector')" class="px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:bg-surface-container-low cursor-pointer">
                Proyektor / AV
              </button>
            </div>

            <!-- Card Highlight Ringkasan 'Booking Saya' -->
            ${latestBooking ? `
            <div class="relative overflow-hidden bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3">
              <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-${statusColor}"></div>
              <div class="flex items-center justify-between pl-1">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-${statusText} text-[18px]">${statusIcon}</span>
                  <span class="font-label-sm text-label-sm text-${statusText} bg-${statusBg} px-2.5 py-0.5 rounded-full font-semibold">
                    ${statusLabel}
                  </span>
                </div>
                <span class="font-label-sm text-label-sm text-on-surface-variant">Booking #${latestBooking.id}</span>
              </div>
              <div class="pl-1 flex flex-col gap-1">
                <h2 class="font-headline-sm text-headline-sm text-on-surface">${latestBooking.eventName}</h2>
                <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                  <span class="material-symbols-outlined text-[16px] text-primary">location_on</span>
                  <span>${latestBooking.roomName} (${latestBooking.roomFloor || 'Lt. 3'})</span>
                </div>
                <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
                  <span class="material-symbols-outlined text-[16px] text-primary">schedule</span>
                  <span class="font-semibold text-on-surface">${latestBooking.reservationDate} • ${latestBooking.timeString}</span>
                </div>
              </div>
              <!-- Mini Progress / Weekly Indicator Metrics -->
              <div class="mt-1 pt-2 bg-surface-container-low rounded-xl px-3 py-2 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                  <span class="font-label-sm text-label-sm text-on-surface">${pendingCount} Menunggu</span>
                </div>
                <div class="h-3 w-px bg-outline-variant"></div>
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span class="font-label-sm text-label-sm text-on-surface">${approvedCount} Disetujui</span>
                </div>
                <button onclick="RoomBookApp.openReservationDetail('${this.getReservationRouteId(latestBooking)}')" class="font-label-sm text-label-sm text-primary font-semibold flex items-center gap-0.5 hover:underline cursor-pointer">
                  Detail <span class="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </div>
            ` : ''}

            <!-- Helpful Context Tips Banner -->
            <div class="flex items-start gap-3 bg-secondary-fixed/50 p-3.5 rounded-xl shadow-xs">
              <div class="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-[18px]">lightbulb</span>
              </div>
              <div class="flex flex-col">
                <span class="font-headline-sm text-label-md text-on-secondary-fixed">Tips Reservasi</span>
                <p class="font-body-sm text-body-sm text-on-secondary-fixed-variant leading-snug">
                  Reservasi minimal 1 hari sebelumnya untuk verifikasi fasilitas dan penyiapan perangkat oleh admin operasional.
                </p>
              </div>
            </div>

            <!-- Section 'Ruangan Tersedia' -->
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h2 class="font-headline-md text-headline-md text-on-surface">Ruangan Tersedia</h2>
                  <span class="px-2 py-0.5 rounded-full bg-surface-container-high font-label-sm text-label-sm text-on-surface-variant font-semibold">
                    ${RoomBookStore.getRooms().length}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold ${RoomBookStore.dataSource === 'supabase' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                    ${RoomBookStore.dataSource === 'supabase' ? 'Supabase DB' : 'Data Lokal'}
                  </span>
                </div>
                <button onclick="RoomBookApp.navigate('#user/ketersediaan')" class="font-label-md text-label-md text-secondary font-semibold hover:underline flex items-center gap-0.5">
                  Lihat Semua
                  <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              </div>

              <!-- Room Cards Stack -->
              <div class="flex flex-col gap-3.5" id="dashboard-room-list">
                ${this.renderRoomsContent(rooms)}
              </div>
            </div>
          </div>
        </main>

        <!-- User Bottom Navigation -->
        ${this.renderUserBottomNav('beranda')}
      `;
    },

    renderRoomsContent(rooms) {
      if (RoomBookStore.isLoadingRooms) {
        return `
          <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-3 shadow-xs">
            <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p class="font-headline-sm text-on-surface font-semibold">Memuat Data Ruangan...</p>
            <p class="font-body-sm text-on-surface-variant">Menghubungkan ke tabel <code class="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[12px]">rooms</code> di Supabase.</p>
          </div>
        `;
      }

      if (RoomBookStore.roomsError) {
        return `
          <div class="p-5 bg-error-container/40 border border-error/20 rounded-2xl flex flex-col gap-2.5 text-on-surface">
            <div class="flex items-center gap-2 text-error">
              <span class="material-symbols-outlined text-[22px]">error</span>
              <h3 class="font-headline-sm font-semibold">Gagal Mengambil Data Supabase</h3>
            </div>
            <p class="font-body-sm text-on-surface-variant">${RoomBookStore.roomsError}</p>
            <div class="flex items-center gap-2 pt-1">
              <button onclick="RoomBookStore.loadRoomsFromDatabase()" class="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-sm font-semibold hover:bg-primary-container transition-all active:scale-95 shadow-sm">
                Coba Lagi
              </button>
            </div>
          </div>
        `;
      }

      if (!rooms || rooms.length === 0) {
        return `
          <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-3 border border-surface-container-high shadow-xs">
            <div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <span class="material-symbols-outlined text-3xl text-outline">meeting_room</span>
            </div>
            <div class="flex flex-col gap-1">
              <h3 class="font-headline-sm text-on-surface font-bold">Belum Ada Ruangan di Database</h3>
              <p class="font-body-sm text-on-surface-variant max-w-xs">
                Koneksi Supabase berhasil, namun tabel <code class="px-1.5 py-0.5 rounded bg-surface-container font-mono text-[12px] font-semibold">rooms</code> masih kosong (0 data).
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button onclick="RoomBookStore.loadRoomsFromDatabase()" class="px-3.5 py-2 rounded-xl bg-primary text-on-primary font-label-sm font-semibold flex items-center gap-1.5 shadow-sm hover:bg-primary-container active:scale-95 transition-all">
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                <span>Refresh Supabase</span>
              </button>
            </div>
          </div>
        `;
      }

      return rooms.map(room => this.renderRoomCard(room)).join('');
    },

    renderRoomCard(room) {
      return `
        <div class="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden p-3.5 flex flex-col gap-3 transition-shadow hover:shadow-md">
          <div class="relative w-full h-40 rounded-xl overflow-hidden cursor-pointer" onclick="RoomBookApp.openRoomDetail('${room.id}')">
            <img class="w-full h-full object-cover" src="${room.thumbnail || room.image}" alt="${room.name}"/>
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
            <!-- Availability Badge -->
            <div class="absolute top-2.5 left-2.5">
              <span class="bg-emerald-500/95 backdrop-blur-sm text-white px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold flex items-center gap-1 shadow-sm">
                <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                ${room.availabilityStatus}
              </span>
            </div>
            <!-- Capacity Badge -->
            <div class="absolute bottom-2.5 right-2.5 bg-tertiary/80 backdrop-blur-sm text-on-tertiary px-2.5 py-1 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[15px]">group</span>
              <span>${room.capacity} Orang</span>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <h3 class="font-headline-sm text-headline-sm text-on-surface hover:text-primary cursor-pointer" onclick="RoomBookApp.openRoomDetail('${room.id}')">${room.name}</h3>
              <span class="font-label-sm text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">${room.floor}</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant">${room.shortNote}</p>
          </div>
          <!-- Amenities Chips -->
          <div class="flex flex-wrap gap-1.5">
            ${(room.facilities || []).slice(0, 3).map(f => `
              <span class="px-2 py-1 rounded-md bg-surface-container font-label-sm text-body-sm text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">${f.icon}</span> ${f.name}
              </span>
            `).join('')}
          </div>
          <div class="pt-1 flex items-center justify-between">
            <div class="flex flex-col">
              <span class="font-label-sm text-label-sm text-outline">Jadwal Bebas</span>
              <span class="font-headline-sm text-label-md text-primary font-bold">${room.availableUntil}</span>
            </div>
            <button onclick="RoomBookApp.startBooking('${room.id}')" class="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-semibold shadow-sm hover:bg-primary-container active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer" type="button">
              <span>Pesan Cepat</span>
              <span class="material-symbols-outlined text-[16px]">bolt</span>
            </button>
          </div>
        </div>
      `;
    },

    bindUserDashboardEvents() {},

    handleDashboardSearch(query) {
      const q = String(query || '').toLowerCase().trim();
      const container = document.getElementById('dashboard-room-list');
      if (!container) return;
      const rooms = [...RoomBookStore.getRooms()].sort((a, b) => Number(b.dbId || 0) - Number(a.dbId || 0));
      const filtered = !q ? rooms : rooms.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.floor || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        String(r.capacity || '').includes(q) ||
        (r.facilities || []).some(f => (f.name || '').toLowerCase().includes(q))
      );
      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="p-6 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-outline text-3xl">search_off</span>
            <p class="font-headline-sm text-on-surface">Ruangan tidak ditemukan</p>
            <p class="font-body-sm text-on-surface-variant">Coba kata kunci lain atau lihat semua ketersediaan.</p>
          </div>
        `;
      } else {
        container.innerHTML = filtered.map(room => this.renderRoomCard(room)).join('');
      }
    },

    // ==========================================
    // 3. KETERSEDIAAN RUANGAN (CATALOG) VIEW
    // ==========================================
    openCatalogWithFilter(type = 'all') {
      this._pendingCatalogFilter = type || 'all';
      this._catalogSearchQuery = '';
      this.navigate('#user/ketersediaan');
    },

    applyRoomCategoryFilter(rooms, type) {
      const list = Array.isArray(rooms) ? rooms : [];
      if (type === 'large') {
        return list.filter(r => Number(r.capacity || 0) >= 20);
      }
      if (type === 'small') {
        return list.filter(r => Number(r.capacity || 0) <= 10);
      }
      if (type === 'floor3') {
        return list.filter(r => `${r.floor || ''} ${r.name || ''}`.toLowerCase().includes('lantai 3'));
      }
      if (type === 'projector') {
        return list.filter(r => {
          const text = `${(r.facilities || []).map(f => f.name || f).join(' ')} ${r.description || ''}`.toLowerCase();
          return text.includes('proyektor') || text.includes('projector') || text.includes('lcd') || text.includes('video') || text.includes('led') || text.includes('sound');
        });
      }
      return list;
    },

    renderKetersediaanView() {
      const rooms = [...RoomBookStore.getRooms()].sort((a, b) => Number(b.dbId || 0) - Number(a.dbId || 0));
      const activeType = this._pendingCatalogFilter || 'all';
      const searchQ = (this._catalogSearchQuery || '').toLowerCase().trim();
      let filtered = this.applyRoomCategoryFilter(rooms, activeType);
      if (searchQ) {
        filtered = filtered.filter(r =>
          (r.name || '').toLowerCase().includes(searchQ) ||
          (r.description || '').toLowerCase().includes(searchQ) ||
          (r.floor || '').toLowerCase().includes(searchQ) ||
          String(r.capacity || '').includes(searchQ)
        );
      }
      const pillClass = (t) => activeType === t
        ? 'filter-pill px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm whitespace-nowrap shadow-sm cursor-pointer'
        : 'filter-pill px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:bg-surface-container-low cursor-pointer';

      return `
        <!-- Shell Header with Back Button -->
        ${this.renderHeader('Ketersediaan Ruangan', true)}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-space-md pt-2">
            <div class="flex items-start justify-between">
              <div>
                <h1 class="font-headline-lg text-headline-lg text-on-surface">Cek Ketersediaan</h1>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Pilih ruangan yang sesuai kebutuhan tim &amp; agenda</p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-semibold ${RoomBookStore.dataSource === 'supabase' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                ${RoomBookStore.dataSource === 'supabase' ? 'Supabase DB' : 'Data Lokal'}
              </span>
            </div>

            <!-- Search Field -->
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-3.5 text-on-surface-variant text-[20px] pointer-events-none">search</span>
              <input id="room-search-input" value="${this._catalogSearchQuery || ''}" oninput="RoomBookApp.filterRoomsList(this.value)" class="w-full h-11 pl-10 pr-4 bg-surface-container-lowest rounded-xl font-body-md text-body-md text-on-surface placeholder:text-outline shadow-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Cari nama ruangan atau kapasitas..." type="text"/>
            </div>

            <!-- Filter Pills -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-margin px-margin" id="catalog-filter-pills">
              <button onclick="RoomBookApp.filterRoomsCategory('all', this)" class="${pillClass('all')}">
                Semua Ruang (${rooms.length})
              </button>
              <button onclick="RoomBookApp.filterRoomsCategory('large', this)" class="${pillClass('large')}">
                Kapasitas Besar (≥20)
              </button>
              <button onclick="RoomBookApp.filterRoomsCategory('small', this)" class="${pillClass('small')}">
                Diskusi Tim (≤10)
              </button>
              <button onclick="RoomBookApp.filterRoomsCategory('floor3', this)" class="${pillClass('floor3')}">
                Lantai 3
              </button>
              <button onclick="RoomBookApp.filterRoomsCategory('projector', this)" class="${pillClass('projector')}">
                Proyektor / AV
              </button>
            </div>

            <!-- Room List -->
            <div class="flex flex-col gap-4" id="catalog-room-list">
              ${filtered.length === 0 ? `
                <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
                  <span class="material-symbols-outlined text-outline text-4xl">search_off</span>
                  <p class="font-headline-sm text-on-surface">Tidak ada ruangan sesuai filter</p>
                  <p class="font-body-sm text-on-surface-variant">Pilih kategori lain atau ubah kata kunci pencarian.</p>
                </div>
              ` : this.renderRoomsContent(filtered)}
            </div>
          </div>
        </main>

        ${this.renderUserBottomNav('ketersediaan')}
      `;
    },

    bindKetersediaanEvents() {},

    filterRoomsList(query) {
      this._catalogSearchQuery = String(query || '');
      const q = this._catalogSearchQuery.toLowerCase().trim();
      const baseRooms = this.applyRoomCategoryFilter(RoomBookStore.getRooms(), this._pendingCatalogFilter || 'all');
      const container = document.getElementById('catalog-room-list');
      if (!container) return;

      const filtered = !q ? baseRooms : baseRooms.filter(r => 
        (r.name || '').toLowerCase().includes(q) || 
        (r.description || '').toLowerCase().includes(q) ||
        (r.floor || '').toLowerCase().includes(q) ||
        String(r.capacity || '').includes(q)
      );

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-outline text-4xl">search_off</span>
            <p class="font-headline-sm text-on-surface">Tidak ada ruangan ditemukan</p>
            <p class="font-body-sm text-on-surface-variant">Coba gunakan kata kunci pencarian yang lain.</p>
          </div>
        `;
      } else {
        container.innerHTML = filtered.map(room => this.renderRoomCard(room)).join('');
      }
    },

    filterRoomsCategory(type, btn) {
      this._pendingCatalogFilter = type || 'all';
      document.querySelectorAll('#catalog-filter-pills .filter-pill').forEach(p => {
        p.className = 'filter-pill px-3.5 py-1.5 rounded-full bg-surface-container-lowest text-on-surface-variant font-label-sm text-label-sm whitespace-nowrap shadow-sm hover:bg-surface-container-low cursor-pointer';
      });
      if (btn) {
        btn.className = 'filter-pill px-3.5 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm whitespace-nowrap shadow-sm cursor-pointer';
      }

      const rooms = this.applyRoomCategoryFilter(RoomBookStore.getRooms(), this._pendingCatalogFilter);
      const q = (this._catalogSearchQuery || '').toLowerCase().trim();
      const filtered = !q ? rooms : rooms.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.floor || '').toLowerCase().includes(q) ||
        String(r.capacity || '').includes(q)
      );
      const container = document.getElementById('catalog-room-list');
      if (!container) return;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-outline text-4xl">search_off</span>
            <p class="font-headline-sm text-on-surface">Tidak ada ruangan sesuai kategori ini</p>
            <p class="font-body-sm text-on-surface-variant">Silakan pilih filter kategori ruangan lainnya.</p>
          </div>
        `;
      } else {
        container.innerHTML = filtered.map(room => this.renderRoomCard(room)).join('');
      }
    },

    // ==========================================
    // 4. DETAIL RUANGAN VIEW
    // ==========================================
    renderDetailRuanganView() {
      const roomId = RoomBookStore.selectedRoomId;
      const room = RoomBookStore.getRoomById(roomId);

      if (!room) {
        return `
          ${this.renderHeader('Detail Ruangan', true)}
          <main class="flex-1 flex flex-col items-center justify-center pt-24 px-margin text-center">
            <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-3 text-outline">
              <span class="material-symbols-outlined text-[32px]">meeting_room</span>
            </div>
            <h2 class="font-headline-md text-on-surface font-bold">Ruangan Tidak Ditemukan</h2>
            <p class="font-body-md text-on-surface-variant mt-1">Ruangan dengan ID "${roomId || '-'}" tidak tersedia atau belum dimuat dari database.</p>
            <button onclick="RoomBookApp.navigate('#user/ketersediaan')" class="mt-5 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md shadow-sm hover:bg-primary-container transition-colors cursor-pointer" type="button">
              Lihat Daftar Ruangan
            </button>
          </main>
        `;
      }

      return `
        <!-- Shell Header with Back -->
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between gap-space-sm">
            <div class="flex items-center gap-space-xs">
              <button aria-label="Kembali" onclick="history.back()" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 class="font-headline-md text-headline-md text-on-surface truncate">Detail Ruangan</h1>
            </div>
            <div class="flex items-center gap-space-xs">
              <div onclick="RoomBookApp.navigate('#user/profil')" class="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-safe bg-surface px-margin">
          <div class="flex flex-col w-full pb-24">
            
            <!-- Top Utility Bar (Share & Bookmark Action Subheader) -->
            <div class="flex items-center justify-between py-space-sm mb-space-sm">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-semibold">
                <span class="material-symbols-outlined text-[16px]">apartment</span>
                ${room.type || 'Tipe Eksekutif'}
              </span>
              <div class="flex items-center gap-2">
                <button aria-label="Bagikan Ruangan" onclick="RoomBookApp.showToast('Tautan informasi ruangan berhasil disalin', 'share')" class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shadow-sm" type="button">
                  <span class="material-symbols-outlined text-[20px]">share</span>
                </button>
                <button aria-label="Simpan Favorit" id="bookmarkBtn" onclick="this.classList.toggle('text-primary'); RoomBookApp.showToast('Ruangan ditandai favorit', 'bookmark')" class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors shadow-sm" type="button">
                  <span class="material-symbols-outlined text-[20px]">bookmark</span>
                </button>
              </div>
            </div>

            <!-- Hero Image Carousel Container -->
            <div class="relative w-full rounded-xl overflow-hidden shadow-md bg-surface-container-low mb-space-md">
              <div class="w-full h-64 relative">
                <img class="w-full h-full object-cover" src="${room.image}" alt="${room.name}"/>
                <div class="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-black/20"></div>
                <!-- Floating Badges Top Row -->
                <div class="absolute top-space-md left-space-md right-space-md flex items-center justify-between pointer-events-none">
                  <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-sm text-on-surface font-label-sm text-label-sm">
                    <span class="material-symbols-outlined text-primary text-[16px]">groups</span>
                    <span>Kapasitas ${room.capacity} Orang</span>
                  </div>
                  <div class="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600 text-white font-label-sm text-label-sm shadow-sm">
                    <span class="w-2 h-2 rounded-full bg-emerald-200 animate-pulse"></span>
                    <span>${room.availabilityStatus}</span>
                  </div>
                </div>
                <!-- Carousel Pagination Indicator -->
                <div class="absolute bottom-space-md left-0 right-0 flex justify-center items-center gap-1.5">
                  <span class="w-6 h-1.5 rounded-full bg-surface-container-lowest"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-surface-container-lowest/60"></span>
                  <span class="w-1.5 h-1.5 rounded-full bg-surface-container-lowest/60"></span>
                </div>
              </div>
            </div>

            <!-- Room Info Section -->
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md">
              <div class="flex items-start justify-between gap-space-xs mb-1">
                <h2 class="font-headline-lg text-headline-lg text-on-surface font-bold">${room.name}</h2>
                <div class="flex items-center gap-1 text-primary bg-primary-fixed px-2 py-0.5 rounded-full font-label-sm text-label-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">star</span>
                  <span>${room.rating}</span>
                </div>
              </div>
              <div class="flex items-center gap-1.5 text-on-surface-variant font-body-sm text-body-sm mb-space-md">
                <span class="material-symbols-outlined text-primary text-[18px]">location_on</span>
                <span>${room.location}</span>
              </div>
              <p class="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                ${room.description}
              </p>
            </div>

            <!-- Key Facilities Grid -->
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md">
              <div class="flex items-center justify-between mb-space-md">
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Fasilitas Unggulan</h3>
                <span class="font-label-sm text-label-sm text-primary font-semibold">${(room.facilities || []).length} Fasilitas Siap Pakai</span>
              </div>
              <div class="grid grid-cols-2 gap-space-sm">
                ${(room.facilities || []).map(f => `
                  <div class="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors">
                    <div class="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                      <span class="material-symbols-outlined text-[20px]">${f.icon}</span>
                    </div>
                    <div class="min-w-0">
                      <p class="font-label-md text-label-md text-on-surface font-semibold truncate">${f.name}</p>
                      <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${f.desc}</p>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Today's Booking Schedule Timeline -->
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md">
              <div class="flex items-center justify-between mb-space-sm">
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Jadwal Penggunaan Hari Ini</h3>
                <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px]">calendar_today</span>
                  Hari Ini
                </span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant mb-space-md">
                Pilih waktu yang tersedia untuk memastikan reservasi tidak bentrok.
              </p>
              <div class="space-y-space-sm" id="room-today-schedule-list">
                <div class="flex items-center justify-between p-3 rounded-lg bg-surface-container text-on-surface-variant">
                  <div class="flex items-center gap-2.5">
                    <span class="material-symbols-outlined text-[18px] animate-spin text-primary">progress_activity</span>
                    <span class="font-body-sm text-body-sm">Memuat jadwal terpakai hari ini dari server...</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Terms & Guidelines Section -->
            <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-lg">
              <div class="flex items-center gap-2 mb-space-sm">
                <span class="material-symbols-outlined text-secondary text-[20px]">policy</span>
                <h3 class="font-headline-sm text-headline-sm text-on-surface">Syarat &amp; Ketentuan Peminjaman</h3>
              </div>
              <ul class="space-y-2 font-body-sm text-body-sm text-on-surface-variant">
                <li class="flex items-start gap-2">
                  <span class="material-symbols-outlined text-secondary text-[16px] mt-0.5">check</span>
                  <span>Pengajuan reservasi wajib dilakukan minimal 1 jam sebelum penggunaan.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="material-symbols-outlined text-secondary text-[16px] mt-0.5">check</span>
                  <span>Wajib menjaga kebersihan dan mematikan AC serta display panel sebelum meninggalkan ruangan.</span>
                </li>
                <li class="flex items-start gap-2">
                  <span class="material-symbols-outlined text-secondary text-[16px] mt-0.5">check</span>
                  <span>Pembatalan peminjaman maksimal 30 menit sebelum jadwal reservasi dimulai.</span>
                </li>
              </ul>
            </div>
          </div>
        </main>

        <!-- Sticky Bottom Action Bar -->
        <div class="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl shadow-xl px-margin py-3 pb-safe">
          <div class="max-w-md mx-auto">
            <button onclick="RoomBookApp.startBooking('${room.id}')" class="w-full bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm py-3.5 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer" type="button">
              <span class="material-symbols-outlined text-[22px]">calendar_add_on</span>
              <span>Booking Ruangan Ini</span>
            </button>
          </div>
        </div>
      `;
    },

    bindDetailRuanganEvents() {
      const roomId = RoomBookStore.selectedRoomId;
      const room = RoomBookStore.getRoomById(roomId);
      if (room) {
        this.loadDetailRoomSchedule(room);
      }
    },

    async loadDetailRoomSchedule(room) {
      const container = document.getElementById('room-today-schedule-list');
      if (!container) return;

      const dbRoomId = this.resolveRoomDatabaseId(room.id) || room.dbId;
      const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const todayIso = nowWib.toISOString().split('T')[0];

      let slots = [];
      if (dbRoomId && typeof window !== 'undefined' && window.RoomService && typeof window.RoomService.fetchRoomSchedule === 'function') {
        const res = await window.RoomService.fetchRoomSchedule(dbRoomId, todayIso);
        if (Array.isArray(res.data)) slots = res.data;
      }

      if (slots.length === 0) {
        const localBooked = (RoomBookStore.getReservations() || []).filter(r => {
          if (r.status !== 'approved' && r.status !== 'pending') return false;
          const matches = String(r.roomId) === String(room.id) || (dbRoomId && Number(this.resolveRoomDatabaseId(r.roomId)) === Number(dbRoomId));
          if (!matches || !r.startTime) return false;
          const rWib = new Date(new Date(r.startTime).getTime() + 7 * 60 * 60 * 1000);
          return rWib.toISOString().split('T')[0] === todayIso;
        });
        slots = localBooked.map(r => ({
          event_name: r.eventName,
          start_time: r.startTime,
          end_time: r.endTime,
          status: r.status
        }));
      }

      if (slots.length === 0) {
        container.innerHTML = `
          <div class="flex items-center justify-between p-3 rounded-lg bg-emerald-50 text-emerald-950">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">check_circle</span>
              </div>
              <div>
                <p class="font-label-md text-label-md font-semibold text-emerald-900">08:00 - 17:00 WIB</p>
                <p class="font-body-sm text-body-sm text-emerald-700">Ruangan kosong &amp; tersedia sepanjang hari ini</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900 font-label-sm text-label-sm font-semibold">Tersedia</span>
          </div>
        `;
        return;
      }

      const fTime = (iso) => {
        const d = new Date(iso);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      container.innerHTML = slots.map(slot => {
        const isApproved = slot.status === 'approved';
        return `
          <div class="flex items-center justify-between p-3 rounded-lg ${isApproved ? 'bg-primary-fixed/40 text-on-primary-fixed' : 'bg-amber-50 text-amber-950'}">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full ${isApproved ? 'bg-primary text-on-primary' : 'bg-amber-200 text-amber-800'} flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px]">${isApproved ? 'event_busy' : 'hourglass_top'}</span>
              </div>
              <div>
                <p class="font-label-md text-label-md font-semibold ${isApproved ? 'text-primary' : 'text-amber-900'}">${fTime(slot.start_time)} - ${fTime(slot.end_time)} WIB</p>
                <p class="font-body-sm text-body-sm ${isApproved ? 'text-on-primary-fixed-variant' : 'text-amber-800'}">${slot.event_name || 'Jadwal Ruangan'}</p>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-full ${isApproved ? 'bg-primary text-on-primary' : 'bg-amber-200 text-amber-900'} font-label-sm text-label-sm font-medium">
              ${isApproved ? 'Terisi' : 'Pending'}
            </span>
          </div>
        `;
      }).join('');
    },

    openRoomDetail(roomId) {
      RoomBookStore.selectedRoomId = roomId;
      this.navigate(`#user/detail-ruangan/${roomId}`);
    },

    startBooking(roomId) {
      RoomBookStore.selectedRoomId = roomId;
      this.navigate(`#user/form-reservasi/${roomId}`);
    },

    // ==========================================
    // 5. FORM RESERVASI VIEW
    // ==========================================
    renderFormReservasiView() {
      const roomId = RoomBookStore.selectedRoomId;
      const room = RoomBookStore.getRoomById(roomId);
      const currentUser = RoomBookStore.currentUser || {};
      const userName = currentUser.name || 'Pengguna RoomBook';
      const userDept = currentUser.dept || 'Civitas Akademika';

      if (!room) {
        return `
          ${this.renderHeader('Formulir Booking', true)}
          <main class="flex-1 flex flex-col items-center justify-center pt-24 px-margin text-center">
            <div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-3 text-outline">
              <span class="material-symbols-outlined text-[32px]">event_busy</span>
            </div>
            <h2 class="font-headline-md text-on-surface font-bold">Ruangan Tidak Ditemukan</h2>
            <p class="font-body-md text-on-surface-variant mt-1">Silakan pilih ruangan yang valid dari daftar ketersediaan untuk melakukan pemesanan.</p>
            <button onclick="RoomBookApp.navigate('#user/ketersediaan')" class="mt-5 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md shadow-sm hover:bg-primary-container transition-colors cursor-pointer" type="button">
              Pilih Ruangan
            </button>
          </main>
        `;
      }

      // Format tanggal hari ini dan jam default secara dinamis dalam zona waktu WIB (UTC+7)
      const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);

      const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

      // Tentukan default tanggal & jam agar selalu berada di waktu mendatang yang valid
      let formDate = new Date(Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate()));
      let defaultStartHour = 9;
      let defaultEndHour = 11;

      const currentWibHour = nowWib.getUTCHours();
      const currentWibMinute = nowWib.getUTCMinutes();

      if (currentWibHour >= 8 && currentWibHour < 18) {
        // Tawarkan slot jam berikutnya hari ini (misal sekarang 10:15 -> mulai 11:00, sekarang 17:40 -> mulai 18:00)
        defaultStartHour = currentWibMinute > 40 ? currentWibHour + 2 : currentWibHour + 1;
        defaultEndHour = defaultStartHour + 2;
      } else if (currentWibHour >= 18) {
        // Hari kerja/operasional sudah malam, defaultkan ke besok pagi jam 09:00 - 11:00 WIB
        formDate.setUTCDate(formDate.getUTCDate() + 1);
        defaultStartHour = 9;
        defaultEndHour = 11;
      } else {
        // Pagi sebelum jam 08:00
        defaultStartHour = 9;
        defaultEndHour = 11;
      }

      const pad = (n) => String(n).padStart(2, '0');
      const defaultDateFormatted = `${indonesianDays[formDate.getUTCDay()]}, ${formDate.getUTCDate()} ${indonesianMonths[formDate.getUTCMonth()]} ${formDate.getUTCFullYear()}`;
      const defaultIsoDate = `${formDate.getUTCFullYear()}-${pad(formDate.getUTCMonth() + 1)}-${pad(formDate.getUTCDate())}`;
      const minIsoDate = `${nowWib.getUTCFullYear()}-${pad(nowWib.getUTCMonth() + 1)}-${pad(nowWib.getUTCDate())}`;

      const defaultTimeStart = `${pad(defaultStartHour)}:00 WIB`;
      const defaultTimeEnd = `${pad(defaultEndHour)}:00 WIB`;

      const defaultParticipants = Math.min(room.capacity || 10, 10);
      const remainingQuota = Math.max(0, (room.capacity || 10) - defaultParticipants);

      return `
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between gap-space-sm">
            <div class="flex items-center gap-space-xs">
              <button aria-label="Kembali" onclick="history.back()" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 class="font-headline-md text-headline-md text-on-surface truncate">Formulir Booking</h1>
            </div>
            <div class="flex items-center gap-space-xs">
              <div onclick="RoomBookApp.navigate('#user/profil')" class="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-safe bg-surface px-margin">
          <div class="flex flex-col w-full pb-8 space-y-space-md">
            
            <!-- Card Info Ruangan Terpilih -->
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm relative overflow-hidden">
              <div class="flex items-center gap-space-md">
                <div class="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 shadow-sm">
                  <img class="w-full h-full object-cover" src="${room.thumbnail || room.image}" alt="${room.name}"/>
                  <div class="absolute inset-0 bg-primary/10"></div>
                </div>
                <div class="flex flex-col min-w-0 flex-1 justify-center">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="inline-block w-2 h-2 rounded-full bg-secondary-container"></span>
                    <span class="font-label-sm text-label-sm text-secondary truncate uppercase tracking-wider font-semibold">${room.floor} • ${room.location}</span>
                  </div>
                  <h2 class="font-headline-sm text-headline-sm text-on-surface truncate font-bold">${room.name}</h2>
                  <div class="flex items-center gap-space-xs mt-1 text-on-surface-variant">
                    <span class="material-symbols-outlined text-[16px]">group</span>
                    <span class="font-body-sm text-body-sm">Kapasitas Maks. ${room.capacity} Orang</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Interactive Conflict Warning Callout (Tersembunyi jika tidak ada jadwal bentrok) -->
            <div class="w-full bg-error-container text-on-error-container rounded-xl p-space-md shadow-sm transition-all duration-300 hidden" id="conflict-banner">
              <div class="flex items-start gap-space-sm">
                <span class="material-symbols-outlined text-error text-[22px] shrink-0 mt-0.5" style="font-variation-settings: 'FILL' 1;">warning</span>
                <div class="flex flex-col space-y-1">
                  <span class="font-headline-sm text-headline-sm text-error leading-tight font-bold">Peringatan Jadwal Bertabrakan</span>
                  <p class="font-body-sm text-body-sm leading-relaxed text-on-error-container">
                    Slot <strong class="font-semibold" id="conflict-time-indicator">10:00 - 12:00 WIB</strong> bertabrakan dengan reservasi lain pada ruangan ini. Silakan pilih jam atau ruangan alternatif.
                  </p>
                </div>
              </div>
            </div>

            <!-- Booking Form Container -->
            <form class="flex flex-col space-y-space-md" id="reservation-form" onsubmit="event.preventDefault(); RoomBookApp.handleReservationSubmit();">
              
              <!-- Field: Peminjam -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-1.5">
                <label class="font-label-sm text-label-sm text-on-surface-variant flex items-center justify-between">
                  <span>Nama Peminjam</span>
                  <span class="text-secondary font-medium">Terisi Otomatis</span>
                </label>
                <div class="flex items-center gap-space-sm bg-surface-container-low px-space-md py-2.5 rounded-lg">
                  <div class="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shrink-0 font-bold">
                    <span class="material-symbols-outlined text-[18px]">badge</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="font-label-md text-label-md text-on-surface font-semibold truncate">${userName}</span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${userDept}</span>
                  </div>
                </div>
              </div>

              <!-- Field: Nama Kegiatan -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-1.5">
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="form-event-name">Nama Agenda / Kegiatan</label>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">event_note</span>
                  <input class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-space-md py-3 rounded-lg focus:outline-none focus:bg-surface-container transition-colors" id="form-event-name" placeholder="Tuliskan nama kegiatan..." type="text" value="Rapat Koordinasi &amp; Pembahasan Program" required/>
                </div>
              </div>

              <!-- Field: Tanggal & Waktu -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-space-sm">
                <label class="font-label-sm text-label-sm text-on-surface-variant">Jadwal Penggunaan Ruangan</label>
                
                <!-- Date Picker Input dengan sinkronisasi native date picker -->
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">calendar_today</span>
                  <input class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-10 py-3 rounded-lg cursor-pointer" id="form-reservation-date" type="text" value="${defaultDateFormatted}" data-iso="${defaultIsoDate}" readonly onclick="RoomBookApp.openDatePicker()"/>
                  <input type="date" id="native-date-picker" class="sr-only" min="${minIsoDate}" value="${defaultIsoDate}" onchange="RoomBookApp.handleDateChange(this.value)"/>
                  <span class="material-symbols-outlined absolute right-3 text-outline text-[20px] pointer-events-none">expand_more</span>
                </div>

                <!-- Time Range (2 Columns) -->
                <div class="grid grid-cols-2 gap-space-sm pt-1">
                  <div class="flex flex-col space-y-1">
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Jam Mulai</span>
                    <div class="relative flex items-center">
                      <span class="material-symbols-outlined absolute left-2.5 text-outline text-[18px] pointer-events-none">schedule</span>
                      <input class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-8 pr-2 py-2.5 rounded-lg focus:outline-none" id="form-time-start" type="text" value="${defaultTimeStart}" oninput="RoomBookApp.checkFormConflict()" onchange="RoomBookApp.checkFormConflict()"/>
                    </div>
                  </div>
                  <div class="flex flex-col space-y-1">
                    <span class="font-label-sm text-label-sm text-on-surface-variant">Jam Selesai</span>
                    <div class="relative flex items-center">
                      <span class="material-symbols-outlined absolute left-2.5 text-outline text-[18px] pointer-events-none">schedule</span>
                      <input class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-8 pr-2 py-2.5 rounded-lg focus:outline-none" id="form-time-end" type="text" value="${defaultTimeEnd}" oninput="RoomBookApp.checkFormConflict()" onchange="RoomBookApp.checkFormConflict()"/>
                    </div>
                  </div>
                </div>

                <!-- Live Schedule Preview Box from get_room_schedule RPC -->
                <div id="form-live-schedule-box" class="mt-2 pt-2.5 border-t border-surface-container text-xs text-on-surface-variant">
                  Memeriksa jadwal ruangan pada tanggal ini...
                </div>
              </div>

              <!-- Field: Jumlah Peserta dengan Micro-validation -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-2">
                <div class="flex items-center justify-between">
                  <label class="font-label-sm text-label-sm text-on-surface-variant" for="capacity-input">Jumlah Peserta</label>
                  <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant" id="capacity-badge">
                    Maksimal: ${room.capacity}
                  </span>
                </div>
                <div class="flex items-center gap-space-sm">
                  <button class="w-11 h-11 rounded-lg bg-surface-container-low text-on-surface flex items-center justify-center active:scale-95 transition-transform cursor-pointer" id="btn-decrement" type="button" onclick="RoomBookApp.changeCapacity(-1, ${room.capacity})">
                    <span class="material-symbols-outlined text-[20px]">remove</span>
                  </button>
                  <div class="relative flex-1">
                    <input class="w-full text-center bg-surface-container-low text-on-surface font-headline-sm text-headline-sm py-2.5 rounded-lg focus:outline-none font-bold" id="capacity-input" max="${room.capacity}" min="1" type="number" value="${defaultParticipants}" oninput="RoomBookApp.validateCapacity(${room.capacity})"/>
                  </div>
                  <button class="w-11 h-11 rounded-lg bg-surface-container-low text-on-surface flex items-center justify-center active:scale-95 transition-transform cursor-pointer" id="btn-increment" type="button" onclick="RoomBookApp.changeCapacity(1, ${room.capacity})">
                    <span class="material-symbols-outlined text-[20px]">add</span>
                  </button>
                </div>
                <div class="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant pt-1" id="capacity-feedback">
                  <span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                  <span>Kapasitas mencukupi (Tersisa kuota ${remainingQuota} kursi)</span>
                </div>
              </div>

              <!-- Field: Keperluan Rapat -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-1.5">
                <label class="font-label-sm text-label-sm text-on-surface-variant" for="form-purpose">Keperluan Rapat / Agenda Detail</label>
                <textarea class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md p-space-md rounded-lg focus:outline-none focus:bg-surface-container resize-none leading-relaxed" id="form-purpose" placeholder="Deskripsikan tujuan pertemuan..." rows="3">Koordinasi perencanaan kegiatan, penyelarasan jadwal tim, dan evaluasi capaian kerja.</textarea>
              </div>

              <!-- Field: Fasilitas Tambahan (Chips Checklist) -->
              <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col space-y-space-sm">
                <div class="flex items-center justify-between">
                  <span class="font-label-sm text-label-sm text-on-surface-variant">Fasilitas Tambahan</span>
                  <span class="font-label-sm text-label-sm text-secondary font-medium" id="checked-count">2 Terpilih</span>
                </div>
                <div class="flex flex-col gap-2" id="facility-chips-group">
                  
                  <label class="facility-chip flex items-center justify-between p-3 rounded-lg bg-secondary-fixed text-on-secondary-fixed cursor-pointer transition-colors" data-label="Proyektor & Kabel HDMI">
                    <div class="flex items-center gap-space-sm">
                      <span class="material-symbols-outlined text-[20px]">videocam</span>
                      <span class="font-label-md text-label-md font-semibold">Proyektor &amp; Kabel HDMI</span>
                    </div>
                    <input checked class="hidden facility-toggle" type="checkbox"/>
                    <span class="material-symbols-outlined checkbox-icon text-primary text-[20px]" style="font-variation-settings: 'FILL' 1;">check_box</span>
                  </label>

                  <label class="facility-chip flex items-center justify-between p-3 rounded-lg bg-secondary-fixed text-on-secondary-fixed cursor-pointer transition-colors" data-label="Microfon Wireless (2 unit)">
                    <div class="flex items-center gap-space-sm">
                      <span class="material-symbols-outlined text-[20px]">mic</span>
                      <span class="font-label-md text-label-md font-semibold">Microfon Wireless (2 unit)</span>
                    </div>
                    <input checked class="hidden facility-toggle" type="checkbox"/>
                    <span class="material-symbols-outlined checkbox-icon text-primary text-[20px]" style="font-variation-settings: 'FILL' 1;">check_box</span>
                  </label>

                  <label class="facility-chip flex items-center justify-between p-3 rounded-lg bg-surface-container-low text-on-surface cursor-pointer transition-colors" data-label="Pointer Presentasi">
                    <div class="flex items-center gap-space-sm">
                      <span class="material-symbols-outlined text-[20px]">mouse</span>
                      <span class="font-label-md text-label-md font-medium">Pointer Presentasi</span>
                    </div>
                    <input class="hidden facility-toggle" type="checkbox"/>
                    <span class="material-symbols-outlined checkbox-icon text-outline text-[20px]">check_box_outline_blank</span>
                  </label>

                  <label class="facility-chip flex items-center justify-between p-3 rounded-lg bg-surface-container-low text-on-surface cursor-pointer transition-colors" data-label="Layanan Kebersihan Ekstra">
                    <div class="flex items-center gap-space-sm">
                      <span class="material-symbols-outlined text-[20px]">cleaning_services</span>
                      <span class="font-label-md text-label-md font-medium">Layanan Kebersihan Ekstra</span>
                    </div>
                    <input class="hidden facility-toggle" type="checkbox"/>
                    <span class="material-symbols-outlined checkbox-icon text-outline text-[20px]">check_box_outline_blank</span>
                  </label>
                </div>
              </div>

              <!-- Actions Call to Action -->
              <div class="flex flex-col space-y-space-sm pt-2">
                <button class="w-full bg-primary text-on-primary py-3.5 rounded-xl font-headline-sm text-headline-sm shadow-md active:scale-[0.98] transition-transform flex items-center justify-center gap-space-xs cursor-pointer hover:bg-primary-container" id="submit-btn" type="submit">
                  <span>Ajukan Reservasi</span>
                  <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
                <button class="w-full bg-surface-container-low text-on-surface-variant py-3 rounded-xl font-label-md text-label-md active:bg-surface-container-high transition-colors text-center cursor-pointer" onclick="history.back()" type="button">
                  Batalkan Pengajuan
                </button>
              </div>
            </form>
          </div>
        </main>
      `;
    },

    bindFormReservasiEvents() {
      // Toggle facility chip checkbox logic
      const chips = document.querySelectorAll('.facility-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const checkbox = chip.querySelector('.facility-toggle');
          const icon = chip.querySelector('.checkbox-icon');
          checkbox.checked = !checkbox.checked;

          if (checkbox.checked) {
            chip.classList.remove('bg-surface-container-low', 'text-on-surface');
            chip.classList.add('bg-secondary-fixed', 'text-on-secondary-fixed');
            icon.textContent = 'check_box';
            icon.classList.remove('text-outline');
            icon.classList.add('text-primary');
            icon.style.fontVariationSettings = "'FILL' 1";
          } else {
            chip.classList.remove('bg-secondary-fixed', 'text-on-secondary-fixed');
            chip.classList.add('bg-surface-container-low', 'text-on-surface');
            icon.textContent = 'check_box_outline_blank';
            icon.classList.remove('text-primary');
            icon.classList.add('text-outline');
            icon.style.fontVariationSettings = "'FILL' 0";
          }

          const count = document.querySelectorAll('.facility-toggle:checked').length;
          const countEl = document.getElementById('checked-count');
          if (countEl) countEl.textContent = `${count} Terpilih`;
        });
      });

      // Jalankan pengecekan bentrok awal saat form dimuat + muat slot jadwal RPC
      const initialIsoDate = document.getElementById('native-date-picker')?.value || new Date().toISOString().split('T')[0];
      this.checkFormConflict();
      this.loadFormRoomSchedule(initialIsoDate);
    },

    openDatePicker() {
      const picker = document.getElementById('native-date-picker');
      if (picker) {
        if (typeof picker.showPicker === 'function') {
          picker.showPicker();
        } else {
          picker.click();
        }
      }
    },

    handleDateChange(isoVal) {
      if (!isoVal) return;
      const [y, m, d] = isoVal.split('-').map(Number);
      const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const formatted = `${indonesianDays[noonUtc.getUTCDay()]}, ${d} ${indonesianMonths[m - 1]} ${y}`;

      const dateInput = document.getElementById('form-reservation-date');
      if (dateInput) {
        dateInput.value = formatted;
        dateInput.dataset.iso = isoVal;
      }
      const nativePicker = document.getElementById('native-date-picker');
      if (nativePicker && nativePicker.value !== isoVal) {
        nativePicker.value = isoVal;
      }
      this.loadFormRoomSchedule(isoVal);
      this.checkFormConflict();
    },

    async loadFormRoomSchedule(isoDateStr) {
      const box = document.getElementById('form-live-schedule-box');
      const selectedRoomId = RoomBookStore.selectedRoomId;
      const dbRoomId = this.resolveRoomDatabaseId(selectedRoomId);
      const isoDate = isoDateStr || new Date().toISOString().split('T')[0];

      if (!dbRoomId || typeof window === 'undefined' || !window.RoomService || typeof window.RoomService.fetchRoomSchedule !== 'function') {
        this._liveRoomScheduleSlots = [];
        if (box) {
          box.innerHTML = '<span class="text-emerald-700 font-medium flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px]">event_available</span>Slot waktu masih kosong pada tanggal ini.</span>';
        }
        this.checkFormConflict();
        return;
      }

      if (box) {
        box.innerHTML = '<span class="text-on-surface-variant flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>Memuat jadwal terpakai...</span>';
      }

      const { data } = await window.RoomService.fetchRoomSchedule(dbRoomId, isoDate);
      this._liveRoomScheduleSlots = Array.isArray(data) ? data : [];

      if (box) {
        if (this._liveRoomScheduleSlots.length === 0) {
          box.innerHTML = '<span class="text-emerald-700 font-medium flex items-center gap-1.5"><span class="material-symbols-outlined text-[15px]">event_available</span>Belum ada jadwal bentrok pada tanggal ini.</span>';
        } else {
          const badges = this._liveRoomScheduleSlots.map(s => {
            const st = new Date(s.start_time);
            const et = new Date(s.end_time);
            const fTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            const statusText = s.status === 'approved' ? 'Disetujui' : 'Pending';
            return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-medium">${fTime(st)}–${fTime(et)} (${statusText})</span>`;
          }).join(' ');
          box.innerHTML = `<div class="space-y-1"><p class="text-[11px] font-semibold text-on-surface">Slot Terjadwal Pada Tanggal Ini:</p><div class="flex flex-wrap gap-1.5">${badges}</div></div>`;
        }
      }
      this.checkFormConflict();
    },

    changeCapacity(delta, max) {
      const input = document.getElementById('capacity-input');
      if (!input) return;
      let val = parseInt(input.value, 10) || 1;
      val = Math.max(1, Math.min(val + delta, max));
      input.value = val;
      this.validateCapacity(max);
    },

    validateCapacity(max) {
      const input = document.getElementById('capacity-input');
      const feedback = document.getElementById('capacity-feedback');
      if (!input || !feedback) return;
      const val = parseInt(input.value, 10) || 1;

      if (val > max) {
        feedback.innerHTML = `<span class="material-symbols-outlined text-[16px] text-error">error</span><span class="text-error font-medium">Melebihi batas maksimal kapasitas (${max} org)</span>`;
      } else if (val <= 0) {
        feedback.innerHTML = `<span class="material-symbols-outlined text-[16px] text-error">error</span><span class="text-error font-medium">Jumlah peserta minimal 1 orang</span>`;
      } else {
        const remaining = max - val;
        feedback.innerHTML = `<span class="material-symbols-outlined text-[16px] text-secondary">check_circle</span><span>Kapasitas mencukupi (Tersisa kuota ${remaining} kursi)</span>`;
      }
    },

    /**
     * Memeriksa potensi konflik jadwal secara riil berdasarkan data reservasi aktual di database/store
     */
    checkFormConflict() {
      const dateInput = document.getElementById('form-reservation-date');
      const nativePicker = document.getElementById('native-date-picker');
      const startInput = document.getElementById('form-time-start');
      const endInput = document.getElementById('form-time-end');
      const conflictBanner = document.getElementById('conflict-banner');
      const conflictIndicator = document.getElementById('conflict-time-indicator');

      if (!dateInput || !startInput || !endInput || !conflictBanner) return;

      const dateStr = dateInput.value;
      const isoHint = (nativePicker && nativePicker.value) || dateInput.dataset.iso || null;
      const timeStart = startInput.value;
      const timeEnd = endInput.value;

      const startParsed = this.parseScheduleToISO(dateStr, timeStart, isoHint);
      const endParsed = this.parseScheduleToISO(dateStr, timeEnd, isoHint);

      if (!startParsed.isValid || !endParsed.isValid || endParsed.date <= startParsed.date) {
        conflictBanner.classList.add('hidden');
        return;
      }

      const selectedRoomId = RoomBookStore.selectedRoomId;
      const dbRoomId = this.resolveRoomDatabaseId(selectedRoomId);

      const startMs = startParsed.date.getTime();
      const endMs = endParsed.date.getTime();

      const conflictingLocal = (RoomBookStore.reservations || []).find(r => {
        if (r.status !== 'pending' && r.status !== 'approved') return false;
        const rRoomDbId = this.resolveRoomDatabaseId(r.roomId);
        const matchesRoom = (String(r.roomId) === String(selectedRoomId)) || (rRoomDbId && dbRoomId && Number(rRoomDbId) === Number(dbRoomId));
        if (!matchesRoom) return false;

        const resStart = r.startTime ? new Date(r.startTime).getTime() : 0;
        const resEnd = r.endTime ? new Date(r.endTime).getTime() : 0;

        // Jadwal bertabrakan jika startA < endB DAN endA > startB
        return resStart && resEnd && startMs < resEnd && endMs > resStart;
      });

      const conflictingRpc = (this._liveRoomScheduleSlots || []).find(s => {
        if (s.status !== 'pending' && s.status !== 'approved') return false;
        const resStart = s.start_time ? new Date(s.start_time).getTime() : 0;
        const resEnd = s.end_time ? new Date(s.end_time).getTime() : 0;
        return resStart && resEnd && startMs < resEnd && endMs > resStart;
      });

      if (conflictingLocal || conflictingRpc) {
        if (conflictIndicator) {
          if (conflictingRpc) {
            const st = new Date(conflictingRpc.start_time);
            const et = new Date(conflictingRpc.end_time);
            const fTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            conflictIndicator.textContent = `${fTime(st)} - ${fTime(et)} (${conflictingRpc.event_name || 'Jadwal Ruangan'})`;
          } else {
            conflictIndicator.textContent = `${conflictingLocal.timeString} (${conflictingLocal.applicantName})`;
          }
        }
        conflictBanner.classList.remove('hidden');
      } else {
        conflictBanner.classList.add('hidden');
      }
    },

    /**
     * Mengonversi tanggal & jam dari form RoomBook ke format objek Date dan ISO 8601 timestamptz (WIB UTC+7)
     * Prioritas:
     * 1. Nilai ISO YYYY-MM-DD dari date picker / state (isoDateHint atau value native-date-picker)
     * 2. Format YYYY-MM-DD dari dateStr
     * 3. Fallback parsing teks tanggal bahasa Indonesia (misal "Sabtu, 24 Oktober 2026" atau "24 Oktober 2026")
     * 4. Jam diparsing secara numerik (mendukung "09:00 WIB", "09.00 WIB", "09:00", "9:00", dll)
     * 5. Selalu digabungkan sebagai waktu lokal WIB (+07:00) yang konsisten dan anti-offset skew.
     */
    parseScheduleToISO(dateStr, timeStr, isoDateHint = null) {
      const pad = (n) => String(n).padStart(2, '0');

      // 1. Ambil nilai tanggal numerik (year, month, day)
      let year = null;
      let month = null; // 1 - 12
      let day = null;   // 1 - 31

      // Coba dari isoDateHint jika berupa YYYY-MM-DD
      if (isoDateHint && /^\d{4}-\d{2}-\d{2}$/.test(String(isoDateHint).trim())) {
        const parts = String(isoDateHint).trim().split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
      }

      // Coba jika dateStr berupa YYYY-MM-DD
      if (!year && dateStr && /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim())) {
        const parts = String(dateStr).trim().split('-').map(Number);
        year = parts[0];
        month = parts[1];
        day = parts[2];
      }

      // Coba baca dari elemen native-date-picker jika ada di DOM
      if (!year && typeof document !== 'undefined') {
        const nativePicker = document.getElementById('native-date-picker');
        if (nativePicker && nativePicker.value && /^\d{4}-\d{2}-\d{2}$/.test(nativePicker.value)) {
          const parts = nativePicker.value.split('-').map(Number);
          year = parts[0];
          month = parts[1];
          day = parts[2];
        }
      }

      // Fallback: Parsing teks tanggal bahasa Indonesia (misal: "Sabtu, 24 Oktober 2026" atau "24/10/2026")
      if (!year && dateStr) {
        const strClean = String(dateStr).trim();
        // Cek format DD/MM/YYYY atau DD-MM-YYYY
        const dmyMatch = strClean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dmyMatch) {
          day = parseInt(dmyMatch[1], 10);
          month = parseInt(dmyMatch[2], 10);
          year = parseInt(dmyMatch[3], 10);
        } else {
          // Format teks Indonesia: "Sabtu, 24 Oktober 2026" atau "24 Okt 2026"
          const monthsMap = {
            'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
            'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12,
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'agu': 8, 'ags': 8, 'sep': 9, 'okt': 10, 'nov': 11, 'des': 12
          };
          const textMatch = strClean.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
          if (textMatch) {
            day = parseInt(textMatch[1], 10);
            const mKey = textMatch[2];
            month = monthsMap[mKey] || null;
            year = parseInt(textMatch[3], 10);
          }
        }
      }

      // Jika tanggal sama sekali tidak terdeteksi, gunakan tanggal hari ini dalam WIB
      if (!year || !month || !day) {
        const wibDate = new Date(Date.now() + 7 * 3600000);
        year = wibDate.getUTCFullYear();
        month = wibDate.getUTCMonth() + 1;
        day = wibDate.getUTCDate();
      }

      // 2. Ambil nilai jam & menit secara numerik
      // Mendukung format "09:00 WIB", "09.00 WIB", "09:00", "09.00", "9:00", "9"
      let hours = 0;
      let minutes = 0;
      let timeValid = false;

      const rawTime = String(timeStr || '').trim();
      const timeMatch = rawTime.match(/(\d{1,2})[:.](\d{1,2})/);
      if (timeMatch) {
        hours = parseInt(timeMatch[1], 10);
        minutes = parseInt(timeMatch[2], 10);
        timeValid = (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59);
      } else {
        const singleHourMatch = rawTime.match(/\b(\d{1,2})\b/);
        if (singleHourMatch) {
          hours = parseInt(singleHourMatch[1], 10);
          minutes = 0;
          timeValid = (hours >= 0 && hours <= 23);
        }
      }

      if (!timeValid) {
        hours = 9;
        minutes = 0;
      }

      // 3. Gabungkan sebagai waktu lokal WIB dengan offset eksplisit +07:00
      // Format: YYYY-MM-DDTHH:mm:00+07:00
      const isoWithOffset = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+07:00`;
      const calendarDate = new Date(0);
      calendarDate.setUTCFullYear(year, month - 1, day);
      calendarDate.setUTCHours(0, 0, 0, 0);
      const dateValid = Number.isInteger(year) && Number.isInteger(month) && Number.isInteger(day) &&
        month >= 1 && month <= 12 && day >= 1 &&
        calendarDate.getUTCFullYear() === year &&
        calendarDate.getUTCMonth() === month - 1 &&
        calendarDate.getUTCDate() === day;
      const dateObj = dateValid ? new Date(isoWithOffset) : new Date(NaN);
      const isValid = !isNaN(dateObj.getTime()) && dateValid && timeValid;

      return {
        iso: isValid ? isoWithOffset : null,
        isoUtc: isValid ? dateObj.toISOString() : null,
        date: dateObj,
        year,
        month,
        day,
        hours,
        minutes,
        isValid: isValid
      };
    },

    /**
     * Memetakan ID atau slug ruangan ke ID numerik tabel rooms di database Supabase
     * Tidak menggunakan fallback statis 2; mengembalikan null jika ruangan tidak ditemukan.
     */
    resolveRoomDatabaseId(selectedId) {
      if (!selectedId) return null;
      const room = RoomBookStore.getRoomById(selectedId);
      if (room && room.dbId) return Number(room.dbId);

      const parsed = parseInt(String(selectedId), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;

      if (room && room.name) {
        const dbRoom = (RoomBookStore.rooms || []).find(r => r.name && r.name.toLowerCase() === room.name.toLowerCase());
        if (dbRoom && dbRoom.dbId) return Number(dbRoom.dbId);
      }

      return null;
    },

    /**
     * Menerjemahkan error Supabase RPC menjadi pesan ramah pengguna
     */
    formatRpcError(err, defaultAction = 'memproses permintaan') {
      if (!err) return `Gagal ${defaultAction}.`;
      const msg = String(err.message || '');
      const code = String(err.code || '');

      if (code === 'PGRST202' || msg.includes('Could not find the function')) {
        return 'Fungsi RPC belum aktif di database Supabase. Jalankan skrip migrasi SQL (supabase_migration_v4.sql) di Supabase SQL Editor terlebih dahulu.';
      }
      if (msg.includes('floor') && msg.includes('does not exist')) {
        return 'Kolom "floor" belum tersedia di tabel rooms. Jalankan skrip supabase_migration_v4.sql di Supabase SQL Editor terlebih dahulu.';
      }
      if (code === '23P01' || msg.includes('sudah dipesan') || msg.includes('bentrok') || msg.includes('conflict')) {
        return msg || 'Jadwal ruangan bentrok: Ruangan sudah dipesan atau memiliki jadwal yang disetujui pada jam tersebut.';
      }
      if (code === '42501' || msg.includes('Akses ditolak') || msg.includes('login') || msg.includes('permission denied')) {
        return msg || 'Akses ditolak: Anda harus login untuk melakukan aksi ini.';
      }
      if (code === '23503' || msg.includes('Tidak dapat menghapus ruangan')) {
        return msg || 'Tidak dapat menghapus ruangan karena masih memiliki jadwal reservasi aktif atau riwayat terkait. Jalankan skrip supabase_migration_v4.sql jika error berlanjut.';
      }
      if (code === '22023') {
        return msg || 'Parameter data tidak valid. Periksa kembali input Anda.';
      }
      return msg || `Terjadi kesalahan saat ${defaultAction} ke database.`;
    },

    async handleReservationSubmit() {
      const room = RoomBookStore.getRoomById(RoomBookStore.selectedRoomId);
      if (!room) {
        this.showToast('Ruangan yang dipilih tidak ditemukan. Silakan pilih ruangan dari daftar.', 'warning');
        return;
      }

      const dbRoomId = this.resolveRoomDatabaseId(RoomBookStore.selectedRoomId);
      if (!dbRoomId) {
        this.showToast('ID ruangan database tidak valid. Pastikan data ruangan telah dimuat dari Supabase.', 'error');
        return;
      }

      const eventName = document.getElementById('form-event-name')?.value || 'Agenda Rapat Tim';
      const purpose = document.getElementById('form-purpose')?.value || '';
      const dateInput = document.getElementById('form-reservation-date');
      const nativePicker = document.getElementById('native-date-picker');
      const reservationDate = dateInput?.value || '';
      const isoHint = (nativePicker && nativePicker.value) || dateInput?.dataset.iso || null;
      const timeStart = document.getElementById('form-time-start')?.value || '09:00 WIB';
      const timeEnd = document.getElementById('form-time-end')?.value || '11:00 WIB';
      const participantsInput = document.getElementById('capacity-input')?.value;
      const participants = (participantsInput !== undefined && participantsInput !== null && String(participantsInput).trim() !== '') ? parseInt(participantsInput, 10) : null;

      // Validasi tujuan peminjaman
      if (!purpose || !purpose.trim()) {
        this.showToast('Tujuan atau agenda peminjaman ruangan wajib diisi.', 'warning');
        const purposeEl = document.getElementById('form-purpose');
        if (purposeEl) {
          purposeEl.focus();
          purposeEl.classList.add('border', 'border-error');
        }
        return;
      }

      // Validasi jumlah peserta
      if (participants === null || isNaN(participants)) {
        this.showToast('Jumlah peserta wajib diisi dan tidak boleh kosong.', 'warning');
        return;
      }
      if (participants <= 0) {
        this.showToast('Jumlah peserta harus lebih dari 0 orang.', 'warning');
        return;
      }
      if (room.capacity && participants > room.capacity) {
        this.showToast(`Jumlah peserta (${participants} orang) melebihi kapasitas maksimal ruangan "${room.name}" (${room.capacity} orang).`, 'warning');
        return;
      }

      // Validasi parsing tanggal & jam (waktu lokal WIB UTC+7 konsisten)
      const startParsed = this.parseScheduleToISO(reservationDate, timeStart, isoHint);
      const endParsed = this.parseScheduleToISO(reservationDate, timeEnd, isoHint);

      if (!startParsed.isValid || !endParsed.isValid) {
        this.showToast('Format tanggal atau jam reservasi tidak valid. Periksa kembali input Anda.', 'warning');
        return;
      }

      // Validasi tanggal lampau (toleransi 10 menit sesuai aturan database Supabase create_reservation_safe)
      const now = new Date();
      if (startParsed.date.getTime() < now.getTime() - 10 * 60 * 1000) {
        this.showToast('Tanggal atau jam mulai tidak boleh berada di masa lalu. Silakan pilih waktu yang akan datang.', 'warning');
        return;
      }

      // Validasi jam selesai > jam mulai
      if (endParsed.date.getTime() <= startParsed.date.getTime()) {
        this.showToast('Jam selesai harus lebih besar daripada jam mulai.', 'warning');
        return;
      }

      // Extract checked facilities
      const facilities = [];
      document.querySelectorAll('.facility-chip').forEach(chip => {
        const cb = chip.querySelector('.facility-toggle');
        if (cb && cb.checked) {
          facilities.push(chip.dataset.label);
        }
      });

      const submitBtn = document.getElementById('submit-btn');
      const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.innerHTML = `<span class="material-symbols-outlined animate-spin text-lg">progress_activity</span><span>Memproses ke Server...</span>`;
        submitBtn.disabled = true;
      }

      try {
        // Panggil Supabase RPC create_reservation_safe dengan parameter lengkap
        const rpcResult = await RoomBookStore.createReservationSupabase({
          roomId: dbRoomId,
          eventName: eventName.trim(),
          purpose: purpose.trim(),
          startTime: startParsed.iso,
          endTime: endParsed.iso,
          participants: participants,
          facilities: facilities
        });

        const createdDatabaseId = rpcResult && rpcResult.reservation_id;
        if (createdDatabaseId === undefined || createdDatabaseId === null || String(createdDatabaseId).trim() === '') {
          await RoomBookStore.loadReservationsFromDatabase();
          this.showToast('Reservasi tersimpan, tetapi server tidak mengembalikan primary key. Buka riwayat untuk memuat data terbaru.', 'warning');
          this.navigate('#user/riwayat');
          return;
        }

        const createdDisplayId = `RB-${createdDatabaseId}`;
        const targetRoom = room || RoomBookStore.getRoomById(dbRoomId) || {};
        const roomCapacity = Number(targetRoom.capacity) || 20;
        const roomFloor = targetRoom.floor || (roomCapacity >= 50 ? 'Lantai 2' : (roomCapacity >= 20 ? 'Lantai 3 • Sayap Barat' : 'Lantai 1'));

        const now = new Date();
        const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        const pad = (n) => String(n).padStart(2, '0');
        const submittedAt = `${now.getDate()} ${indonesianMonths[now.getMonth()].slice(0, 3)} ${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())} WIB`;

        const newReservationObj = {
          id: createdDisplayId,
          dbId: createdDatabaseId,
          userId: RoomBookStore.currentUser?.id || null,
          roomId: String(dbRoomId),
          roomName: rpcResult.room_name || targetRoom.name || 'Ruang Rapat Utama',
          roomFloor: roomFloor,
          roomCapacity: roomCapacity,
          roomImage: targetRoom.image_url || targetRoom.image || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80',
          applicantName: RoomBookStore.currentUser?.name || 'Pemohon Terdaftar',
          applicantRole: RoomBookStore.currentUser?.role || 'Pengguna Terdaftar',
          applicantDept: RoomBookStore.currentUser?.dept || 'Civitas Akademika / Instansi',
          applicantEmail: RoomBookStore.currentUser?.email || 'user@kampus.ac.id',
          applicantInitials: RoomBookStore.currentUser?.initials || 'U',
          applicantAvatar: RoomBookStore.currentUser?.avatar || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrCqTjcXPxtgzjHZQVILzD1Aj5wgZ7vso-pY0YUCBoZoPi7SET9BchUYQ8KyHada-yrUE5debG3PUGGHCMYYqEpGy9mZ99oCeQKarZM70jCi0Kx6_32uRG5pZIEQQJHi5C9xb-wQxOyIbhN42hteHxy9nvQ86Ako3Zqh165Pr8Peq1sgawXaUMzPBccHz8AyYJqQjBfDYMAwcjBmVfcBWRZyCjJtUX543_bNVfCkae',
          eventName: eventName.trim() || purpose.trim(),
          purpose: purpose.trim(),
          reservationDate: reservationDate,
          timeStart: timeStart,
          timeEnd: timeEnd,
          timeString: `${timeStart} - ${timeEnd}`,
          startTime: startParsed.iso,
          endTime: endParsed.iso,
          rawStartTime: startParsed.iso,
          rawEndTime: endParsed.iso,
          duration: `${Math.round(Math.max(1, (new Date(endParsed.iso) - new Date(startParsed.iso)) / 3600000))} Jam`,
          participants: participants,
          facilities: facilities,
          status: 'pending',
          hasConflict: false,
          conflictOverlap: '',
          conflictingBooking: null,
          submittedAt: submittedAt,
          rejectionReason: '',
          qrCodeUnlocked: false,
          isFromDatabase: true,
          syncPending: true,
          history: [
            {
              action: 'CREATED',
              notes: 'Pengajuan reservasi baru diajukan oleh pemohon dengan status awal pending.',
              created_at: now.toISOString()
            }
          ],
          historyLoaded: true
        };

        if (typeof RoomBookStore.addOrUpdateReservation === 'function') {
          RoomBookStore.addOrUpdateReservation(newReservationObj);
        }

        // Coba sinkronisasi daftar dari database
        try {
          await RoomBookStore.loadReservationsFromDatabase();
        } catch (reloadErr) {
          console.warn('⚠️ [RoomBookApp] Reload database setelah create_reservation_safe tertunda:', reloadErr);
        }

        this.showToast(`Pengajuan #${createdDisplayId} berhasil tersimpan di Supabase! Menunggu persetujuan admin.`, 'send');
        this.navigate(`#user/detail-reservasi/${encodeURIComponent(String(createdDatabaseId))}`);
      } catch (err) {
        console.error('❌ [RoomBookApp] Supabase RPC create_reservation_safe failed:', err);

        const isAuthError = err.message && (err.message.includes('login') || err.code === '42501');
        if (isAuthError) {
          this.showToast('Silakan login terlebih dahulu untuk mengajukan reservasi ke database.', 'lock');
          setTimeout(() => this.navigate('#login'), 1200);
          return;
        }

        const errorMsg = this.formatRpcError(err, 'mengajukan reservasi');
        this.showToast(errorMsg, 'error');
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = originalBtnHTML;
          submitBtn.disabled = false;
        }
      }
    },

    // ==========================================
    // 6. RIWAYAT RESERVASI VIEW
    // ==========================================
    renderRiwayatView() {
      // Pastikan data riwayat terbaru dimuat dari database jika belum ada
      if (RoomBookStore && RoomBookStore.dataSource === 'supabase' && !RoomBookStore.isLoadingReservations && !this._riwayatInitialLoadDone) {
        this._riwayatInitialLoadDone = true;
        RoomBookStore.loadReservationsFromDatabase();
      }

      const userBookings = RoomBookStore.getUserReservations();
      const currentTab = this.activeUserHistoryFilter;

      let filtered = userBookings;
      if (currentTab === 'pending') {
        filtered = userBookings.filter(b => b.status === 'pending');
      } else if (currentTab === 'approved') {
        filtered = userBookings.filter(b => b.status === 'approved');
      } else if (currentTab === 'completed') {
        filtered = userBookings.filter(b => b.status === 'completed');
      } else if (currentTab === 'rejected') {
        filtered = userBookings.filter(b => b.status === 'rejected');
      } else if (currentTab === 'cancelled') {
        filtered = userBookings.filter(b => b.status === 'cancelled');
      }

      return `
        ${this.renderHeader('Riwayat Reservasi', false)}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-space-md pt-2">
            
            <div class="flex items-center justify-between">
              <div>
                <h1 class="font-headline-lg text-headline-lg text-on-surface">Riwayat Booking</h1>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Daftar pengajuan ruangan Anda</p>
              </div>
              <button onclick="RoomBookApp.navigate('#user/ketersediaan')" class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md active:scale-95" title="Booking Baru">
                <span class="material-symbols-outlined text-[20px]">add</span>
              </button>
            </div>

            <!-- Status Tabs Selector -->
            <div class="flex items-center gap-1.5 p-1 bg-surface-container rounded-xl overflow-x-auto">
              <button onclick="RoomBookApp.setUserHistoryTab('all')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Semua (${userBookings.length})
              </button>
              <button onclick="RoomBookApp.setUserHistoryTab('pending')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'pending' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Menunggu
              </button>
              <button onclick="RoomBookApp.setUserHistoryTab('approved')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'approved' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Disetujui
              </button>
              <button onclick="RoomBookApp.setUserHistoryTab('completed')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'completed' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Selesai
              </button>
              <button onclick="RoomBookApp.setUserHistoryTab('rejected')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'rejected' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Ditolak
              </button>
              <button onclick="RoomBookApp.setUserHistoryTab('cancelled')" class="px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${currentTab === 'cancelled' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
                Dibatalkan
              </button>
            </div>

            <!-- List of History Cards -->
            <div class="flex flex-col gap-3.5">
              ${filtered.length === 0 ? `
                <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
                  <span class="material-symbols-outlined text-outline text-4xl">event_busy</span>
                  <p class="font-headline-sm text-on-surface">Tidak ada riwayat pada kategori ini</p>
                  <p class="font-body-sm text-on-surface-variant">Belum ada pengajuan ruangan dengan status ini.</p>
                </div>
              ` : filtered.map(item => this.renderHistoryCard(item)).join('')}
            </div>

          </div>
        </main>

        ${this.renderUserBottomNav('riwayat')}
      `;
    },

    renderHistoryCard(item) {
      let statusColor = 'amber-500';
      let statusBg = 'amber-50';
      let statusText = 'amber-700';
      let statusLabel = 'Menunggu Persetujuan';
      let statusIcon = 'hourglass_top';

      if (item.status === 'approved') {
        statusColor = 'emerald-500';
        statusBg = 'emerald-50';
        statusText = 'emerald-700';
        statusLabel = 'Disetujui';
        statusIcon = 'check_circle';
      } else if (item.status === 'rejected') {
        statusColor = 'rose-500';
        statusBg = 'rose-50';
        statusText = 'rose-700';
        statusLabel = 'Ditolak';
        statusIcon = 'cancel';
      } else if (item.status === 'cancelled') {
        statusColor = 'slate-400';
        statusBg = 'slate-100';
        statusText = 'slate-700';
        statusLabel = 'Dibatalkan';
        statusIcon = 'block';
      } else if (item.status === 'completed') {
        statusColor = 'indigo-500';
        statusBg = 'indigo-50';
        statusText = 'indigo-700';
        statusLabel = 'Selesai';
        statusIcon = 'task_alt';
      }

      return `
        <div class="relative overflow-hidden bg-surface-container-lowest rounded-2xl shadow-sm p-4 flex flex-col gap-3 transition-shadow hover:shadow-md cursor-pointer" onclick="RoomBookApp.openReservationDetail('${this.getReservationRouteId(item)}')">
          <!-- Colored Status Indicator Accent Bar from DESIGN.md -->
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-${statusColor}"></div>
          
          <div class="flex items-center justify-between pl-1">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-${statusText} text-[18px]">${statusIcon}</span>
              <span class="font-label-sm text-label-sm text-${statusText} bg-${statusBg} px-2.5 py-0.5 rounded-full font-semibold">
                ${statusLabel}
              </span>
            </div>
            <span class="font-label-sm text-label-sm text-on-surface-variant">#${item.id}</span>
          </div>

          <div class="pl-1 flex flex-col gap-1">
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">${item.eventName}</h3>
            <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span class="material-symbols-outlined text-[16px] text-primary">location_on</span>
              <span>${item.roomName} (${item.roomFloor || 'Lt. 3'})</span>
            </div>
            <div class="flex items-center gap-2 text-on-surface-variant font-body-sm text-body-sm">
              <span class="material-symbols-outlined text-[16px] text-primary">schedule</span>
              <span class="font-semibold text-on-surface">${item.reservationDate} • ${item.timeString}</span>
            </div>
          </div>

          ${item.rejectionReason ? `
            <div class="pl-1 p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-xs">
              <strong>Catatan Admin:</strong> "${item.rejectionReason}"
            </div>
          ` : ''}

          <div class="pl-1 pt-1 border-t border-surface-container-high flex items-center justify-between text-xs text-on-surface-variant">
            <span>Diajukan: ${item.submittedAt}</span>
            <span class="text-primary font-semibold flex items-center gap-0.5">
              Lihat Detail <span class="material-symbols-outlined text-sm">chevron_right</span>
            </span>
          </div>
        </div>
      `;
    },

    bindRiwayatEvents() {},

    setUserHistoryTab(tab) {
      this.activeUserHistoryFilter = tab;
      this.render();
    },

    getReservationRouteId(item) {
      if (!item) return '';
      const routeId = item.dbId !== undefined && item.dbId !== null ? item.dbId : item.id;
      return routeId === undefined || routeId === null ? '' : String(routeId);
    },

    openReservationDetail(resId) {
      if (!resId) {
        this.showToast('Primary key reservasi tidak tersedia pada data yang dipilih.', 'error');
        return;
      }
      RoomBookStore.selectedReservationId = resId;
      this.navigate(`#user/detail-reservasi/${encodeURIComponent(String(resId))}`);
    },

    renderDetailLoadingView(resId) {
      return `
        ${this.renderHeader('Detail Reservasi', true)}
        <main class="flex-1 flex flex-col relative w-full pt-16 pb-safe bg-surface px-margin page-fade-in">
          <div class="flex flex-col w-full pb-space-xl gap-space-md pt-4">
            <!-- Loading Status Indicator Skeleton -->
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm animate-pulse flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="h-4 bg-surface-container rounded w-1/3"></div>
                <div class="h-6 bg-surface-container rounded-full w-24"></div>
              </div>
              <div class="h-7 bg-surface-container rounded w-1/2"></div>
              <div class="h-4 bg-surface-container rounded w-2/3"></div>
            </div>

            <!-- Loading Room Card Skeleton -->
            <div class="w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm animate-pulse">
              <div class="h-32 bg-surface-container w-full"></div>
              <div class="p-space-md grid grid-cols-2 gap-space-sm">
                <div class="h-12 bg-surface-container-low rounded-lg"></div>
                <div class="h-12 bg-surface-container-low rounded-lg"></div>
              </div>
            </div>

            <!-- Loading Spinner & Message -->
            <div class="flex flex-col items-center justify-center p-6 text-center">
              <span class="material-symbols-outlined text-primary text-4xl animate-spin mb-2">progress_activity</span>
              <p class="font-headline-sm font-semibold text-on-surface">Memuat Detail Reservasi...</p>
              <p class="font-body-sm text-on-surface-variant">Mengambil data tiket reservasi #${resId || '-'} dari server database Supabase.</p>
            </div>
          </div>
        </main>
      `;
    },

    renderDetailNotFoundView(resId) {
      return `
        ${this.renderHeader('Detail Reservasi', true)}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-outline text-5xl mb-3">search_off</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Reservasi Tidak Ditemukan</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs">Data reservasi dengan ID "${resId || '-'}" tidak ditemukan di database.</p>
          <button onclick="RoomBookApp.navigate('#user/riwayat')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Riwayat</button>
        </main>
      `;
    },

    renderDetailAccessDeniedView(resId) {
      return `
        ${this.renderHeader('Detail Reservasi', true)}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-error text-5xl mb-3">gpp_bad</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Akses Ditolak</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs leading-relaxed">
            Anda tidak memiliki izin untuk melihat data reservasi dengan ID "${resId || '-'}". Berdasarkan kebijakan keamanan Row Level Security (RLS), hanya pemohon terdaftar atau administrator yang berhak mengakses tiket ini.
          </p>
          <button onclick="RoomBookApp.navigate('#user/riwayat')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Riwayat</button>
        </main>
      `;
    },

    renderDetailSessionExpiredView(resId) {
      return `
        ${this.renderHeader('Detail Reservasi', true)}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-amber-500 text-5xl mb-3">lock_clock</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Sesi Login Berakhir</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs">Masuk kembali untuk memuat reservasi #${resId || '-'}.</p>
          <button onclick="RoomBookApp.navigate('#login')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer" type="button">Masuk Kembali</button>
        </main>
      `;
    },

    renderDetailConnectionErrorView(resId, errorMsg) {
      return `
        ${this.renderHeader('Detail Reservasi', true)}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-amber-500 text-5xl mb-3">cloud_off</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Koneksi Database Gagal</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs leading-relaxed">
            Terjadi kendala saat menghubungi server database Supabase untuk memuat tiket "${resId || '-'}".
            ${errorMsg ? `<br><span class="text-xs text-outline mt-1 block font-mono">(${errorMsg})</span>` : ''}
          </p>
          <div class="flex items-center gap-2">
            <button onclick="RoomBookApp.reloadDetailReservation('${resId}')" class="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5" type="button">
              <span class="material-symbols-outlined text-[18px]">refresh</span>
              <span>Coba Lagi</span>
            </button>
            <button onclick="RoomBookApp.navigate('#user/riwayat')" class="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-label-md font-semibold cursor-pointer hover:bg-surface-container-high transition-colors" type="button">Kembali ke Riwayat</button>
          </div>
        </main>
      `;
    },

    async loadDetailReservation(resId) {
      this.detailReservationState = { id: resId, status: 'loading', error: null, errorCode: null };
      try {
        const result = await RoomBookStore.fetchReservationById(resId);
        if (result.success && result.data) {
          this.detailReservationState = { id: resId, status: 'success', error: null, errorCode: null };
        } else if (result.accessDenied) {
          this.detailReservationState = { id: resId, status: 'access_denied', error: result.error?.message, errorCode: result.error?.code };
        } else if (result.authRequired) {
          this.detailReservationState = { id: resId, status: 'auth_required', error: result.error?.message, errorCode: result.error?.code };
        } else if (result.notFound) {
          this.detailReservationState = { id: resId, status: 'not_found', error: result.error?.message, errorCode: result.error?.code };
        } else {
          this.detailReservationState = { id: resId, status: 'error', error: result.error?.message || 'Gagal memuat reservasi dari database.', errorCode: result.error?.code };
        }
      } catch (err) {
        this.detailReservationState = { id: resId, status: 'error', error: err.message, errorCode: err.code };
      }
      this.render();
    },

    reloadDetailReservation(resId) {
      this.detailReservationState = { id: null, status: 'idle', error: null, errorCode: null };
      this.loadDetailReservation(resId);
    },

    // ==========================================
    // 7. DETAIL RESERVASI & LINIMASA STATUS VIEW
    // ==========================================
    renderDetailReservasiView() {
      const resId = (this.params && this.params.id) || RoomBookStore.selectedReservationId || null;
      const state = this.detailReservationState || { id: null, status: 'idle' };
      if (resId && RoomBookStore.dataSource === 'supabase' && (state.id !== resId || state.status === 'idle')) {
        this.loadDetailReservation(resId);
        return this.renderDetailLoadingView(resId);
      }

      if (resId && RoomBookStore.dataSource === 'supabase') {
        if (state.status === 'loading') return this.renderDetailLoadingView(resId);
        if (state.status === 'access_denied') return this.renderDetailAccessDeniedView(resId);
        if (state.status === 'auth_required') return this.renderDetailSessionExpiredView(resId);
        if (state.status === 'error') return this.renderDetailConnectionErrorView(resId, state.error);
        if (state.status === 'not_found') return this.renderDetailNotFoundView(resId);
      }

      let item = resId ? RoomBookStore.getCachedReservationById(resId) : null;

      if (!item) {
        if (!resId) {
          return `
            ${this.renderHeader('Detail Reservasi', true)}
            <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
              <span class="material-symbols-outlined text-outline text-5xl mb-3">search_off</span>
              <h2 class="font-headline-sm font-bold text-on-surface mb-1">ID Reservasi Kosong</h2>
              <p class="font-body-sm text-on-surface-variant mb-4">Parameter ID reservasi tidak ditemukan di URL.</p>
              <button onclick="RoomBookApp.navigate('#user/riwayat')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Riwayat</button>
            </main>
          `;
        }

        const currentState = this.detailReservationState || { id: null, status: 'idle' };

        // Jika belum mulai memuat untuk resId ini, picu pemanggilan async ke Supabase
        if (currentState.id !== resId) {
          this.loadDetailReservation(resId);
          return this.renderDetailLoadingView(resId);
        }

        if (currentState.status === 'loading') {
          return this.renderDetailLoadingView(resId);
        }

        if (currentState.status === 'access_denied') {
          return this.renderDetailAccessDeniedView(resId);
        }

        if (currentState.status === 'auth_required') {
          return this.renderDetailSessionExpiredView(resId);
        }

        if (currentState.status === 'error') {
          return this.renderDetailConnectionErrorView(resId, currentState.error);
        }

        if (currentState.status === 'not_found') {
          return this.renderDetailNotFoundView(resId);
        }

        return this.renderDetailLoadingView(resId);
      }

      // Jika data sudah ditemukan, sinkronkan status state
      if (this.detailReservationState && this.detailReservationState.id !== resId) {
        this.detailReservationState = { id: resId, status: 'success', error: null, errorCode: null };
      }

      // Muat linimasa audit jika belum dimuat dan sumber data adalah Supabase
      if (!item.historyLoaded && RoomBookStore.dataSource === 'supabase' && !this._fetchingHistoryResId) {
        this._fetchingHistoryResId = resId;
        RoomBookStore.fetchReservationById(resId).then(() => {
          this._fetchingHistoryResId = null;
        }).catch(() => {
          this._fetchingHistoryResId = null;
        });
      }

      const isApproved = item.status === 'approved';
      const isRejected = item.status === 'rejected';
      const isPending = item.status === 'pending';
      const isCancelled = item.status === 'cancelled';
      const isCompleted = item.status === 'completed';

      const currentUserId = RoomBookStore.currentUser?.id;
      const isAdmin = RoomBookStore.currentRole === 'admin';
      const isOwner = !item.userId || !currentUserId || item.userId === currentUserId;
      const canCancel = isPending && (isAdmin || isOwner);

      let statusBadge = `
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm shadow-xs">
          <span class="w-2 h-2 rounded-full bg-secondary-container animate-pulse"></span>
          <span class="font-semibold text-primary">Menunggu Persetujuan</span>
        </span>
      `;
      if (isApproved) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-label-sm text-label-sm shadow-xs">
            <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span class="font-semibold text-emerald-800">${item.checkedInAt ? 'Check-In Berhasil' : 'Telah Disetujui'}</span>
          </span>
        `;
      } else if (isCompleted) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 font-label-sm text-label-sm shadow-xs">
            <span class="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span class="font-semibold text-indigo-800">Selesai Digunakan</span>
          </span>
        `;
      } else if (isCancelled) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-200 text-slate-800 font-label-sm text-label-sm shadow-xs">
            <span class="w-2 h-2 rounded-full bg-slate-500"></span>
            <span class="font-semibold text-slate-700">Dibatalkan</span>
          </span>
        `;
      } else if (isRejected) {
        statusBadge = `
          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-900 font-label-sm text-label-sm shadow-xs">
            <span class="w-2 h-2 rounded-full bg-rose-600"></span>
            <span class="font-semibold text-rose-800">Pengajuan Ditolak</span>
          </span>
        `;
      }

      return `
        <!-- Shell Header -->
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between gap-space-sm">
            <div class="flex items-center gap-space-xs">
              <button aria-label="Kembali" onclick="if (window.history.length > 1) { history.back(); } else { RoomBookApp.navigate('#user/riwayat'); }" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 class="font-headline-md text-headline-md text-on-surface truncate">Detail Reservasi</h1>
            </div>
            <div class="flex items-center gap-space-xs">
              <div onclick="RoomBookApp.navigate('#user/profil')" class="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>
        </header>

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-safe bg-surface px-margin">
          <div class="flex flex-col w-full pb-space-xl">
            
            <!-- Top Utility Bar -->
            <div class="flex items-center justify-between py-space-sm mb-space-sm">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-secondary text-[20px]">verified</span>
                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Tiket Reservasi Resmi</span>
              </div>
              <div class="flex items-center gap-space-xs">
                <button aria-label="Bagikan Reservasi" onclick="RoomBookApp.shareReservation('${item.id}')" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 shadow-sm cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[18px]">share</span>
                </button>
                <button aria-label="Cetak atau Simpan PDF" onclick="RoomBookApp.printReservation()" class="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors active:scale-95 shadow-sm cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[18px]">print</span>
                </button>
              </div>
            </div>

            <!-- 1. Status Card Utama -->
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md relative overflow-hidden">
              <div class="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-secondary-fixed/30 pointer-events-none blur-xl"></div>
              <div class="flex items-start justify-between gap-space-sm">
                <div class="flex flex-col gap-space-xs">
                  <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Nomor Booking</span>
                  <div class="flex items-center gap-space-xs">
                    <span class="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">#${item.id}</span>
                    <button class="material-symbols-outlined text-[16px] text-outline hover:text-primary transition-colors cursor-pointer" onclick="navigator.clipboard.writeText('${item.id}'); RoomBookApp.showToast('Nomor booking disalin ke clipboard')" title="Salin Kode" type="button">content_copy</button>
                  </div>
                </div>
                ${statusBadge}
              </div>
              <div class="mt-space-md pt-space-sm flex items-center gap-space-xs text-on-surface-variant">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                <span class="font-body-sm text-body-sm">Diajukan pada <strong>${item.submittedAt}</strong></span>
              </div>
            </div>

            <!-- 2. Linimasa / Timeline Proses -->
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md">
              <div class="flex items-center justify-between mb-space-md">
                <h2 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs font-bold">
                  <span class="material-symbols-outlined text-primary text-[20px]">alt_route</span>
                  Status Verifikasi
                </h2>
                <span class="font-label-sm text-label-sm text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full font-semibold">
                  ${isCompleted ? 'Selesai (3/3)' : isApproved ? 'Tahap 3 dari 3 (Disetujui)' : isRejected ? 'Ditolak' : isCancelled ? 'Dibatalkan' : 'Tahap 2 dari 3'}
                </span>
              </div>
              <div class="relative flex flex-col space-y-space-md">
                
                <!-- Step 1: Selesai -->
                <div class="flex items-start gap-space-md relative">
                  <div class="absolute left-3.5 top-8 w-0.5 h-10 bg-primary"></div>
                  <div class="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0 z-10 shadow-xs">
                    <span class="material-symbols-outlined text-[16px]">check</span>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 pt-0.5">
                    <div class="flex items-center justify-between">
                      <p class="font-label-md text-label-md text-on-surface font-semibold">Pengajuan Dibuat</p>
                      <span class="font-body-sm text-body-sm text-on-surface-variant">${item.submittedAt.split(',')[1] || 'Selesai'}</span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Oleh <span class="font-medium text-on-surface">${item.applicantName}</span> (${item.applicantDept})</p>
                  </div>
                </div>

                <!-- Step 2: Persetujuan Admin -->
                <div class="flex items-start gap-space-md relative">
                  <div class="absolute left-3.5 top-8 w-0.5 h-12 ${(isApproved || isCompleted) ? 'bg-primary' : 'bg-surface-container-highest'}"></div>
                  <div class="w-7 h-7 rounded-full ${(isApproved || isCompleted) ? 'bg-emerald-600 text-white' : isRejected ? 'bg-error text-on-error' : isCancelled ? 'bg-slate-500 text-white' : 'bg-secondary-container text-on-secondary-container ring-4 ring-secondary-fixed animate-pulse'} flex items-center justify-center shrink-0 z-10 shadow-xs">
                    <span class="material-symbols-outlined text-[16px]">${(isApproved || isCompleted) ? 'check' : isRejected ? 'close' : isCancelled ? 'block' : 'hourglass_top'}</span>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 pt-0.5">
                    <div class="flex items-center justify-between">
                      <p class="font-label-md text-label-md ${(isApproved || isCompleted) ? 'text-emerald-800' : isRejected ? 'text-error' : isCancelled ? 'text-slate-700' : 'text-primary'} font-bold">
                        ${(isApproved || isCompleted) ? 'Disetujui oleh Admin' : isRejected ? 'Ditolak oleh Admin' : isCancelled ? 'Dibatalkan' : 'Menunggu Persetujuan Admin'}
                      </p>
                      <span class="font-label-sm text-label-sm ${(isApproved || isCompleted) ? 'text-emerald-700' : isRejected ? 'text-error' : isCancelled ? 'text-slate-600' : 'text-secondary'} font-medium">
                        ${isCompleted ? 'Selesai' : isApproved ? 'Terverifikasi' : isRejected ? 'Ditolak' : isCancelled ? 'Batal' : 'Dalam Proses'}
                      </span>
                    </div>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      ${(isApproved || isCompleted) ? 'Permohonan telah disetujui oleh Admin Fasilitas Kampus.' : (isRejected || isCancelled) ? `Catatan: ${item.rejectionReason || 'Dibatalkan.'}` : 'Dalam antrean verifikasi Admin Fasilitas Gedung.'}
                    </p>
                    ${isPending ? `
                      <div class="mt-space-xs inline-flex items-center gap-1 text-on-surface bg-surface-container-low px-2 py-1 rounded-lg w-fit">
                        <span class="material-symbols-outlined text-[14px] text-secondary">update</span>
                        <span class="font-label-sm text-label-sm font-medium">Estimasi respon &lt; 2 jam</span>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Step 3: Tiket Selesai / QR -->
                <div class="flex items-start gap-space-md relative">
                  <div class="w-7 h-7 rounded-full ${isCompleted ? 'bg-indigo-600 text-white' : isApproved ? 'bg-emerald-600 text-white' : 'bg-surface-container-highest text-on-surface-variant'} flex items-center justify-center shrink-0 z-10">
                    <span class="material-symbols-outlined text-[16px]">${isCompleted ? 'task_alt' : 'qr_code_2'}</span>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 pt-0.5 ${(isApproved || isCompleted) ? '' : 'opacity-60'}">
                    <p class="font-label-md text-label-md text-on-surface font-semibold">${isCompleted ? 'Reservasi Selesai Digunakan' : isApproved ? (item.checkedInAt ? 'Check-In Berhasil • Tiket Aktif' : 'Tiket QR Aktif & Siap Digunakan') : 'Disetujui / Selesai'}</p>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                      ${isCompleted ? 'Sesi penggunaan ruangan telah berakhir.' : isApproved ? 'Tunjukkan QR Ticket di bawah untuk verifikasi check-in Admin.' : 'Akses QR Ticket akan otomatis aktif setelah pengajuan disetujui.'}
                    </p>
                  </div>
                </div>

                ${Array.isArray(item.history) && item.history.length > 0 ? `
                  <div class="pt-3 mt-1 border-t border-surface-container space-y-2">
                    <span class="font-label-sm text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Riwayat Audit Aktivitas</span>
                    <div class="space-y-1.5">
                      ${item.history.map(h => `
                        <div class="flex items-start justify-between gap-2 text-xs bg-surface-container-low px-3 py-2 rounded-lg">
                          <div class="min-w-0">
                            <span class="font-semibold text-on-surface block">${h.action || h.status || 'Pembaruan Status'}</span>
                            ${h.notes ? `<span class="text-on-surface-variant block text-[11px]">${h.notes}</span>` : ''}
                          </div>
                          <span class="text-[11px] text-on-surface-variant shrink-0">${h.timestamp || ''}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

              </div>
            </div>

            <!-- 3. Card Informasi Ruangan & Jadwal -->
            <div class="w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm mb-space-md">
              <div class="relative h-32 w-full bg-surface-container">
                <img class="w-full h-full object-cover" src="${item.roomImage}" alt="${item.roomName}"/>
                <div class="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>
                <div class="absolute bottom-space-sm left-space-md right-space-md flex items-end justify-between">
                  <div>
                    <span class="font-label-sm text-label-sm text-secondary-fixed bg-primary-container/80 px-2 py-0.5 rounded backdrop-blur-xs font-medium">${item.roomFloor}</span>
                    <h3 class="font-headline-md text-headline-md text-on-primary font-bold drop-shadow-sm">${item.roomName}</h3>
                  </div>
                  <div class="flex items-center gap-1 bg-surface-container-lowest/90 px-2 py-1 rounded-lg text-primary shadow-xs">
                    <span class="material-symbols-outlined text-[16px]">groups</span>
                    <span class="font-label-sm text-label-sm font-bold">${item.participants} / ${item.roomCapacity}</span>
                  </div>
                </div>
              </div>
              <div class="p-space-md grid grid-cols-2 gap-space-sm">
                <div class="flex items-start gap-space-xs p-2 rounded-lg bg-surface-container-low">
                  <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">calendar_today</span>
                  <div>
                    <p class="font-label-sm text-label-sm text-on-surface-variant">Tanggal Reservasi</p>
                    <p class="font-label-md text-label-md text-on-surface font-semibold">${item.reservationDate}</p>
                  </div>
                </div>
                <div class="flex items-start gap-space-xs p-2 rounded-lg bg-surface-container-low">
                  <span class="material-symbols-outlined text-primary text-[20px] mt-0.5">schedule</span>
                  <div>
                    <p class="font-label-sm text-label-sm text-on-surface-variant">Durasi Pemakaian</p>
                    <p class="font-label-md text-label-md text-on-surface font-semibold">${item.timeString}</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Card Rincian Kegiatan & Pemohon -->
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm mb-space-md flex flex-col gap-space-md">
              <h3 class="font-headline-sm text-headline-sm text-on-surface flex items-center gap-space-xs font-bold">
                <span class="material-symbols-outlined text-primary text-[20px]">assignment</span>
                Rincian Kegiatan
              </h3>
              <div class="flex flex-col gap-space-xs bg-surface-container-low p-space-md rounded-lg">
                <div class="flex items-center justify-between">
                  <span class="font-label-sm text-label-sm text-on-surface-variant">Agenda Utama</span>
                  <span class="font-label-sm text-label-sm font-semibold text-secondary bg-secondary-fixed/50 px-2 py-0.5 rounded-full">${item.applicantDept}</span>
                </div>
                <p class="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">${item.eventName}</p>
                <p class="font-body-md text-body-md text-on-surface-variant mt-1 leading-relaxed">
                  ${item.purpose}
                </p>
              </div>

              <div>
                <span class="font-label-sm text-label-sm text-on-surface-variant font-medium block mb-space-xs">Fasilitas Tambahan Terpilih:</span>
                <div class="flex flex-wrap gap-space-xs">
                  ${(item.facilities || []).map(f => `
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface font-label-sm text-label-sm">
                      <span class="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      ${f}
                    </span>
                  `).join('')}
                </div>
              </div>

              <div class="flex items-center gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
                <div class="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold font-headline-sm text-headline-sm shrink-0">
                  ${item.applicantInitials || 'BS'}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="font-label-md text-label-md text-on-surface font-bold truncate">${item.applicantName}</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant truncate">${item.applicantRole} • ${item.applicantEmail}</span>
                </div>
              </div>
            </div>

            <!-- 5. Action Button Section -->
            <div class="flex flex-col gap-space-sm w-full mt-auto">
              ${isApproved ? `
                <button onclick="RoomBookApp.openQRPassModal('${item.id}')" class="w-full py-3.5 px-space-md rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-xs shadow-md active:scale-98 transition-all cursor-pointer hover:bg-primary-container" type="button">
                  <span class="material-symbols-outlined text-[20px]">qr_code_2</span>
                  <span>Buka Tiket QR Masuk Ruangan</span>
                </button>
              ` : `
                <button class="w-full py-3.5 px-space-md rounded-xl bg-surface-container text-outline font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-xs cursor-not-allowed opacity-75" disabled type="button">
                  <span class="material-symbols-outlined text-[20px]">lock</span>
                  <span>Tiket QR (Terkunci Menunggu Approval)</span>
                </button>
              `}

              ${canCancel ? `
                <button onclick="RoomBookApp.confirmCancelBooking('${item.id}')" class="w-full py-3 px-space-md rounded-xl bg-error-container text-on-error-container font-headline-sm text-headline-sm font-semibold flex items-center justify-center gap-space-xs hover:opacity-90 active:scale-98 transition-all cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[18px]">cancel</span>
                  <span>Batalkan Pengajuan</span>
                </button>
              ` : ''}

              <button onclick="RoomBookApp.navigate('#user/riwayat')" class="w-full py-2.5 text-center font-label-md text-label-md text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center gap-1 cursor-pointer" type="button">
                <span class="material-symbols-outlined text-[16px]">history</span>
                <span>Kembali ke Riwayat Reservasi</span>
              </button>
            </div>

          </div>
        </main>
      `;
    },

    bindDetailReservasiEvents() {},

    async shareReservation(id) {
      const item = RoomBookStore.getCachedReservationById(id);
      const summary = item
        ? `Tiket RoomBook #${item.id} — ${item.roomName}\nAgenda: ${item.eventName}\nWaktu: ${item.reservationDate} (${item.timeString})\nStatus: ${item.status}`
        : `Tiket RoomBook #${id}`;
      const shareUrl = typeof window !== 'undefined' && window.location ? window.location.href : '';

      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: `Tiket Reservasi #${id}`, text: summary, url: shareUrl });
          this.showToast(`Tiket #${id} dibagikan`, 'share');
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
          await navigator.clipboard.writeText(`${summary}\n${shareUrl}`.trim());
          this.showToast(`Rincian tiket #${id} disalin ke clipboard`, 'content_copy');
          return;
        } catch (_) {}
      }
      this.showToast(`Kode tiket: #${id}`, 'share');
    },

    printReservation() {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      } else {
        this.showToast('Fitur cetak tersedia pada browser desktop/mobile.', 'print');
      }
    },

    buildFallbackQrSvg(payload) {
      let hash = 2166136261;
      for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const cells = [];
      const size = 21;
      const isFinder = (r, c) =>
        (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
      const drawFinder = (ox, oy) => `
        <rect x="${ox}" y="${oy}" width="7" height="7" fill="#1a146b"/>
        <rect x="${ox + 1}" y="${oy + 1}" width="5" height="5" fill="#ffffff"/>
        <rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" fill="#1a146b"/>
      `;
      let seed = hash >>> 0;
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (isFinder(r, c)) continue;
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          if ((seed & 1) === 1 || ((r + c) % 5 === 0 && (seed & 2) === 2)) {
            cells.push(`<rect x="${c}" y="${r}" width="1" height="1" fill="#1a146b"/>`);
          }
        }
      }
      return `<svg class="w-44 h-44" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${drawFinder(0, 0)}${drawFinder(size - 7, 0)}${drawFinder(0, size - 7)}${cells.join('')}</svg>`;
    },

    async openQRPassModal(id) {
      let item;
      try {
        item = await RoomBookStore.getReservationById(id);
      } catch (err) {
        console.error('❌ Gagal memuat detail reservasi untuk QR Pass:', err);
        this.showToast(err.message || 'Gagal memuat data reservasi.', 'error');
        return;
      }
      if (!item) return;
      const modal = document.getElementById('qr-code-modal');
      const codeEl = document.getElementById('modal-qr-code');
      const payloadEl = document.getElementById('modal-qr-payload');
      const canvasBox = document.getElementById('modal-qr-canvas-box');
      const roomEl = document.getElementById('modal-qr-room');
      const timeEl = document.getElementById('modal-qr-time');

      const qrPayload = item.qrCode || `ROOMBOOK-${item.dbId || item.id}-${item.roomId}`;

      if (codeEl) codeEl.textContent = `#${item.id}`;
      if (payloadEl) payloadEl.textContent = qrPayload;
      if (roomEl) roomEl.textContent = item.roomName;
      if (timeEl) timeEl.textContent = `${item.reservationDate} (${item.timeString})`;

      if (canvasBox) {
        canvasBox.innerHTML = '';
        if (typeof window !== 'undefined' && typeof window.QRCode === 'function') {
          try {
            new window.QRCode(canvasBox, {
              text: qrPayload,
              width: 176,
              height: 176,
              colorDark: '#1a146b',
              colorLight: '#ffffff'
            });
          } catch (_) {
            canvasBox.innerHTML = this.buildFallbackQrSvg(qrPayload);
          }
        } else {
          canvasBox.innerHTML = this.buildFallbackQrSvg(qrPayload);
        }
      }

      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    },

    async confirmCancelBooking(id) {
      let item;
      try {
        item = await RoomBookStore.getReservationById(id);
      } catch (err) {
        console.error('❌ Gagal memuat reservasi sebelum pembatalan:', err);
        this.showToast(err.message || 'Gagal memuat data reservasi.', 'error');
        return;
      }
      if (!item) {
        this.showToast('Reservasi tidak ditemukan', 'error');
        return;
      }
      if (item.status !== 'pending') {
        this.showToast('Hanya reservasi berstatus Pending yang dapat dibatalkan', 'warning');
        return;
      }

      const currentUserId = RoomBookStore.currentUser?.id;
      const isAdmin = RoomBookStore.currentRole === 'admin';
      if (!isAdmin && item.userId && currentUserId && item.userId !== currentUserId) {
        this.showToast('Akses ditolak: Anda tidak memiliki izin membatalkan reservasi ini', 'gpp_bad');
        return;
      }

      if (!confirm(`Apakah Anda yakin ingin membatalkan pengajuan #${id}?`)) return;

      try {
        this.showToast(`Membatalkan pengajuan #${id}...`, 'hourglass_empty');
        await RoomBookStore.updateReservationStatusSupabase(id, 'cancelled', 'Dibatalkan oleh pemohon.');
        await RoomBookStore.loadReservationsFromDatabase();
        this.showToast(`Pengajuan #${id} berhasil dibatalkan di database.`, 'cancel');
        this.render();
      } catch (err) {
        console.error('❌ Gagal membatalkan via RPC Supabase:', err);
        const errorMsg = this.formatRpcError(err, `membatalkan pengajuan #${id}`);
        this.showToast(errorMsg, 'error');
      }
    },

    // ==========================================
    // 8. ADMIN DASHBOARD VIEW
    // ==========================================
    computeWeeklyOccupancy() {
      const reservations = RoomBookStore.getReservations() || [];
      const totalRooms = Math.max(1, (RoomBookStore.getRooms() || []).length);
      const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum'];
      const counts = [0, 0, 0, 0, 0];

      // Hitung rentang Senin - Jumat minggu berjalan (WIB UTC+7)
      const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const jsDay = nowWib.getUTCDay(); // 0=Min, 1=Sen ... 6=Sab
      const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
      const mondayStart = Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate() + diffToMonday) - 7 * 60 * 60 * 1000;
      const dayMs = 24 * 60 * 60 * 1000;

      reservations.forEach(r => {
        if (r.status !== 'approved' && r.status !== 'completed') return;
        const stMs = r.startTime ? new Date(r.startTime).getTime() : NaN;
        if (!stMs || isNaN(stMs)) return;
        const dayIndex = Math.floor((stMs - mondayStart) / dayMs);
        if (dayIndex >= 0 && dayIndex < 5) {
          counts[dayIndex] += 1;
        }
      });

      // Normalisasi terhadap kapasitas harian dasar (asumsi 3 sesi utama/ruangan/hari)
      const dailyCapacitySlots = Math.max(1, totalRooms * 3);
      const bars = dayLabels.map((label, idx) => {
        const pct = Math.min(100, Math.round((counts[idx] / dailyCapacitySlots) * 100));
        return { label, pct, count: counts[idx] };
      });
      const avgPct = Math.round(bars.reduce((s, b) => s + b.pct, 0) / bars.length);
      const peakBar = bars.reduce((best, b) => (b.pct > best.pct ? b : best), bars[0]);
      return { bars, avgPct, peakBar };
    },

    renderAdminDashboardView() {
      const pendingReservations = RoomBookStore.getPendingReservations();
      const approvedCount = RoomBookStore.getApprovedReservations().length;
      const rejectedCount = RoomBookStore.getRejectedReservations().length;
      const totalRooms = RoomBookStore.getRooms().length;

      const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const currentMonthLabel = indonesianMonths[new Date().getMonth()];
      const occupancy = this.computeWeeklyOccupancy();

      return `
        <!-- Admin Shell Header -->
        ${this.renderAdminHeader('Sentra Fasilitas')}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-space-lg pb-6">
            
            <!-- Admin Welcome & Header Banner -->
            <div class="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary-container to-secondary p-space-md text-on-primary shadow-md">
              <div class="relative z-10 flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-space-xs">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary font-label-sm text-label-sm backdrop-blur-sm">
                      <span class="w-1.5 h-1.5 rounded-full bg-secondary-fixed animate-pulse"></span>
                      Fasilitas &amp; Aset
                    </span>
                    <span class="text-primary-fixed-dim font-label-sm text-label-sm">• Sentra Operasional</span>
                  </div>
                  <button onclick="RoomBookApp.openAdminCheckInModal()" type="button" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold backdrop-blur-sm transition-colors cursor-pointer">
                    <span class="material-symbols-outlined text-[15px]">qr_code_scanner</span>
                    <span>Check-In Tiket</span>
                  </button>
                </div>
                <h1 class="font-headline-md text-headline-md tracking-tight mt-1 text-on-primary font-bold">
                  Dashboard Admin
                </h1>
                <p class="font-body-sm text-body-sm text-primary-fixed-dim">
                  Kelola persetujuan, check-in tiket, &amp; ketersediaan ruangan secara real-time.
                </p>
              </div>
              <div class="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-secondary-container/30 blur-2xl pointer-events-none"></div>
            </div>

            <!-- 4-Grid Metric Cards -->
            <section class="flex flex-col gap-space-sm">
              <div class="flex items-center justify-between">
                <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Ringkasan Status</h2>
                <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px] text-secondary">update</span>
                  Hari Ini
                </span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                
                <!-- Card 1: Menunggu Persetujuan -->
                <div onclick="RoomBookApp.navigate('#admin/approval')" class="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div class="flex items-center justify-between">
                    <div class="w-8 h-8 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                      <span class="material-symbols-outlined text-[20px]">pending_actions</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant font-semibold">
                      ${pendingReservations.length > 0 ? 'Urgent' : 'Aman'}
                    </span>
                  </div>
                  <div class="mt-3">
                    <span class="font-headline-xl text-headline-xl text-primary leading-none font-bold">${pendingReservations.length}</span>
                    <p class="font-label-md text-label-md text-on-surface font-semibold mt-1">Menunggu</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant leading-tight">Perlu Review</p>
                  </div>
                </div>

                <!-- Card 2: Disetujui Hari Ini -->
                <div class="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
                  <div class="flex items-center justify-between">
                    <div class="w-8 h-8 rounded-lg bg-secondary-fixed/50 flex items-center justify-center text-primary">
                      <span class="material-symbols-outlined text-[20px]">verified</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-fixed text-on-secondary-fixed font-semibold">
                      Aktif
                    </span>
                  </div>
                  <div class="mt-3">
                    <span class="font-headline-xl text-headline-xl text-primary leading-none font-bold">${approvedCount}</span>
                    <p class="font-label-md text-label-md text-on-surface font-semibold mt-1">Disetujui</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant leading-tight">Jadwal Aktif</p>
                  </div>
                </div>

                <!-- Card 3: Ditolak Bulan Ini -->
                <div class="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow">
                  <div class="flex items-center justify-between">
                    <div class="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center text-on-error-container">
                      <span class="material-symbols-outlined text-[20px]">cancel</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-error-container text-on-error-container font-semibold">
                      Log
                    </span>
                  </div>
                  <div class="mt-3">
                    <span class="font-headline-xl text-headline-xl text-error leading-none font-bold">${rejectedCount}</span>
                    <p class="font-label-md text-label-md text-on-surface font-semibold mt-1">Ditolak</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant leading-tight">Bulan ${currentMonthLabel} Ini</p>
                  </div>
                </div>

                <!-- Card 4: Total Ruangan -->
                <div onclick="RoomBookApp.navigate('#admin/tambah-ruangan')" class="flex flex-col justify-between p-space-md rounded-xl bg-surface-container-lowest shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div class="flex items-center justify-between">
                    <div class="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed">
                      <span class="material-symbols-outlined text-[20px]">add_business</span>
                    </div>
                    <span class="px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-primary-fixed text-on-primary-fixed font-semibold">
                      Kelola
                    </span>
                  </div>
                  <div class="mt-3">
                    <span class="font-headline-xl text-headline-xl text-primary leading-none font-bold">${totalRooms}</span>
                    <p class="font-label-md text-label-md text-on-surface font-semibold mt-1">Total Ruang</p>
                    <p class="font-label-sm text-label-sm text-on-surface-variant leading-tight">Tambah / Edit / Hapus</p>
                  </div>
                </div>

              </div>
            </section>

            <!-- Statistik Okupansi Ruangan Mingguan (Data Aktual Store) -->
            <section class="flex flex-col gap-space-sm p-space-md rounded-xl bg-surface-container-lowest shadow-sm">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm text-secondary font-semibold">Statistik Fasilitas</span>
                  <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Tingkat Okupansi Ruangan</h2>
                </div>
                <div class="flex flex-col items-end">
                  <span class="font-headline-md text-headline-md text-primary font-bold">${occupancy.avgPct}%</span>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">Rata-rata Minggu Ini</span>
                </div>
              </div>
              
              <!-- Visual Bar Chart Minimalis -->
              <div class="pt-4 pb-2">
                <div class="flex items-end justify-between h-36 px-2 gap-3">
                  ${occupancy.bars.map(b => {
                    const isPeak = occupancy.peakBar && b.label === occupancy.peakBar.label && b.pct > 0;
                    const barHeight = b.pct > 0 ? Math.max(8, b.pct) : 4;
                    return `
                      <div class="flex-1 flex flex-col items-center h-full justify-end group">
                        <span class="font-label-sm text-label-sm ${isPeak ? 'text-primary font-bold' : 'text-on-surface-variant font-medium'} mb-1">${b.pct}%</span>
                        <div class="w-full bg-surface-container-high rounded-t-lg overflow-hidden flex flex-col justify-end h-full">
                          <div class="w-full ${isPeak ? 'bg-primary shadow-sm' : b.pct > 0 ? 'bg-secondary' : 'bg-outline-variant/40'} rounded-t-lg transition-all duration-500" style="height: ${barHeight}%;"></div>
                        </div>
                        <span class="font-label-sm text-label-sm ${isPeak ? 'text-primary font-bold' : 'text-on-surface-variant font-medium'} mt-2">${b.label}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Chart Insight Footer -->
              <div class="flex items-center gap-space-xs p-2.5 rounded-lg bg-surface-container-low text-on-surface-variant">
                <span class="material-symbols-outlined text-[18px] text-secondary">insights</span>
                <p class="font-body-sm text-body-sm leading-tight">
                  ${occupancy.peakBar && occupancy.peakBar.count > 0
                    ? `Puncak pemakaian minggu ini pada <strong class="text-primary font-semibold">${occupancy.peakBar.label} (${occupancy.peakBar.pct}%)</strong> dengan ${occupancy.peakBar.count} reservasi disetujui/selesai.`
                    : 'Belum ada jadwal terpakai yang disetujui pada minggu kerja berjalan.'}
                </p>
              </div>
            </section>

            <!-- Section Pengajuan Terbaru (Perlu Review) -->
            <section class="flex flex-col gap-space-sm">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Pengajuan Booking Terbaru</h2>
                  <p class="font-body-sm text-body-sm text-on-surface-variant">Perlu konfirmasi persetujuan admin</p>
                </div>
                <button onclick="RoomBookApp.navigate('#admin/approval')" class="font-label-md text-label-md text-secondary hover:text-primary font-semibold flex items-center cursor-pointer">
                  Lihat Semua (${pendingReservations.length})
                  <span class="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>

              <!-- Request Cards -->
              <div class="flex flex-col gap-3">
                ${pendingReservations.length === 0 ? `
                  <div class="p-6 text-center bg-surface-container-lowest rounded-xl flex flex-col items-center gap-2">
                    <span class="material-symbols-outlined text-emerald-600 text-3xl">task_alt</span>
                    <p class="font-headline-sm text-on-surface">Semua antrean telah diproses</p>
                    <p class="font-body-sm text-on-surface-variant">Tidak ada pengajuan yang membutuhkan persetujuan.</p>
                  </div>
                ` : pendingReservations.map(res => this.renderAdminRequestCard(res)).join('')}
              </div>
            </section>

          </div>
        </main>

        <!-- Admin Bottom Nav -->
        ${this.renderAdminBottomNav('dashboard')}
      `;
    },

    renderAdminRequestCard(res) {
      return `
        <div class="flex flex-col p-space-md rounded-xl bg-surface-container-lowest shadow-sm gap-3">
          ${res.hasConflict ? `
            <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-error-container text-on-error-container">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[18px]">warning</span>
                <span class="font-label-sm text-label-sm font-bold">Konflik Jadwal Terdeteksi</span>
              </div>
              <span class="font-label-sm text-label-sm opacity-80">${res.conflictOverlap || 'Overlap 15m'}</span>
            </div>
          ` : `
            <div class="flex items-center justify-between px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <div class="flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-secondary"></span>
                <span class="font-label-sm text-label-sm font-semibold text-secondary">Slot Tersedia • Tanpa Konflik</span>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Siap Disetujui</span>
            </div>
          `}

          <!-- Applicant & Room Info -->
          <div class="flex items-start gap-3">
            <div class="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-bold font-headline-md text-base shrink-0">
              ${res.applicantInitials || 'BS'}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between">
                <h3 class="font-headline-sm text-headline-sm text-on-surface truncate font-bold">${res.applicantName}</h3>
                <span class="font-label-sm text-label-sm text-on-surface-variant">${res.submittedAt}</span>
              </div>
              <p class="font-body-sm text-body-sm text-on-surface-variant truncate">${res.applicantDept}</p>
              <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-container-low text-primary font-label-sm text-label-sm font-semibold">
                <span class="material-symbols-outlined text-[16px]">meeting_room</span>
                ${res.roomName} (${res.roomFloor || 'Lt. 3'})
              </div>
            </div>
          </div>

          <!-- Details & Agenda -->
          <div class="rounded-lg bg-surface-container-low p-3 flex flex-col gap-1.5 text-on-surface">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant">event</span>
              <span class="font-body-sm text-body-sm font-semibold">${res.reservationDate} • ${res.timeString}</span>
            </div>
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[18px] text-on-surface-variant mt-0.5">topic</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">${res.eventName}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-2.5 pt-1">
            <button onclick="RoomBookApp.openAdminRejectModal('${res.id}')" class="w-full py-2.5 px-3 rounded-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-variant font-label-md text-label-md font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer" type="button">
              <span class="material-symbols-outlined text-[18px]">close</span>
              <span>Tolak</span>
            </button>
            <button onclick="RoomBookApp.quickApproveReservation('${res.id}')" class="w-full py-2.5 px-3 rounded-lg bg-primary text-on-primary hover:bg-primary-container font-label-md text-label-md font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors cursor-pointer" type="button">
              <span class="material-symbols-outlined text-[18px]">rule</span>
              <span>${res.hasConflict ? 'Review & Setujui' : 'Setujui Cepat'}</span>
            </button>
          </div>
        </div>
      `;
    },

    bindAdminDashboardEvents() {},

    // ==========================================
    // 9. ADMIN APPROVAL VIEW
    // ==========================================
    renderAdminApprovalView() {
      const allReservations = RoomBookStore.getReservations();
      const currentTab = this.activeAdminFilter;

      let filtered = allReservations;
      if (currentTab === 'pending') {
        filtered = allReservations.filter(r => r.status === 'pending');
      } else if (currentTab === 'approved') {
        filtered = allReservations.filter(r => r.status === 'approved');
      } else if (currentTab === 'rejected') {
        filtered = allReservations.filter(r => r.status === 'rejected' || r.status === 'cancelled');
      } else if (currentTab === 'completed') {
        filtered = allReservations.filter(r => r.status === 'completed');
      }

      const pendingCount = RoomBookStore.getPendingReservations().length;
      const completedCount = allReservations.filter(r => r.status === 'completed').length;
      const rejectedOrCancelledCount = allReservations.filter(r => r.status === 'rejected' || r.status === 'cancelled').length;
      const conflictingItems = filtered.filter(r => r.hasConflict && r.status === 'pending');
      const hasConflict = conflictingItems.length > 0;
      const conflictSummaryRoom = hasConflict ? conflictingItems.map(c => c.roomName).filter((v, i, a) => a.indexOf(v) === i).join(', ') : '';

      return `
        <!-- Admin Shell Header -->
        ${this.renderAdminHeader('Approval Reservasi')}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full pb-6 space-y-space-md pt-1">
            
            <!-- Header Section with Counter -->
            <section class="flex items-center justify-between pt-1">
              <div>
                <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">Persetujuan Reservasi</h1>
                <p class="font-body-sm text-body-sm text-on-surface-variant">Tinjau &amp; kelola akses ruang rapat kampus</p>
              </div>
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-on-secondary shadow-sm">
                <span class="w-2 h-2 rounded-full bg-surface animate-pulse"></span>
                <span class="font-label-sm text-label-sm font-semibold">${pendingCount} Pending</span>
              </div>
            </section>

            <!-- Filter Status Tabs -->
            <section class="flex items-center gap-space-xs p-1 bg-surface-container rounded-xl overflow-x-auto">
              <button onclick="RoomBookApp.setAdminApprovalTab('pending')" class="px-3 py-2 rounded-lg whitespace-nowrap ${currentTab === 'pending' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'} font-label-md text-label-md text-center transition-all" type="button">
                Pending (${pendingCount})
              </button>
              <button onclick="RoomBookApp.setAdminApprovalTab('approved')" class="px-3 py-2 rounded-lg whitespace-nowrap ${currentTab === 'approved' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'} font-label-md text-label-md text-center transition-all" type="button">
                Disetujui (${RoomBookStore.getApprovedReservations().length})
              </button>
              <button onclick="RoomBookApp.setAdminApprovalTab('completed')" class="px-3 py-2 rounded-lg whitespace-nowrap ${currentTab === 'completed' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'} font-label-md text-label-md text-center transition-all" type="button">
                Selesai (${completedCount})
              </button>
              <button onclick="RoomBookApp.setAdminApprovalTab('rejected')" class="px-3 py-2 rounded-lg whitespace-nowrap ${currentTab === 'rejected' ? 'bg-primary text-on-primary shadow-sm font-bold' : 'text-on-surface-variant hover:text-on-surface'} font-label-md text-label-md text-center transition-all" type="button">
                Ditolak/Batal (${rejectedOrCancelledCount})
              </button>
            </section>

            <!-- Alert Banner: Conflict Slot if applicable -->
            ${hasConflict ? `
              <section class="p-space-md bg-error-container text-on-error-container rounded-xl shadow-sm flex items-start gap-3">
                <div class="w-8 h-8 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0 shadow-sm">
                  <span class="material-symbols-outlined text-[20px]">warning</span>
                </div>
                <div class="flex-1">
                  <h2 class="font-headline-sm text-headline-sm leading-tight font-bold">Terdeteksi ${conflictingItems.length} Pengajuan Berpotensi Konflik</h2>
                  <p class="font-body-sm text-body-sm mt-1 leading-snug">
                    Ruangan terkait: <span class="font-semibold">${conflictSummaryRoom}</span>. Tinjau detail jadwal sebelum menyetujui.
                  </p>
                </div>
              </section>
            ` : ''}

            <!-- Booking Cards List -->
            <div class="flex flex-col gap-4">
              ${filtered.length === 0 ? `
                <div class="p-8 text-center bg-surface-container-lowest rounded-2xl flex flex-col items-center gap-2">
                  <span class="material-symbols-outlined text-outline text-4xl">inbox</span>
                  <p class="font-headline-sm text-on-surface">Tidak ada data reservasi</p>
                  <p class="font-body-sm text-on-surface-variant">Kategori ${currentTab} saat ini kosong.</p>
                </div>
              ` : filtered.map(item => this.renderApprovalCard(item)).join('')}
            </div>

          </div>
        </main>

        <!-- Admin Bottom Nav -->
        ${this.renderAdminBottomNav('approval')}
      `;
    },

    renderApprovalCard(item) {
      const isPending = item.status === 'pending';
      const isApproved = item.status === 'approved';
      const isRejected = item.status === 'rejected';
      const isCancelled = item.status === 'cancelled';
      const isCompleted = item.status === 'completed';

      return `
        <article class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
          <!-- Visual Image Preview -->
          <div class="relative w-full h-36 bg-surface-container">
            <img class="w-full h-full object-cover" src="${item.roomImage}" alt="${item.roomName}"/>
            <div class="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/20 to-transparent"></div>
            <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between text-on-primary">
              <div>
                <span class="font-label-sm text-label-sm opacity-90">Lokasi</span>
                <p class="font-headline-sm text-headline-sm leading-none font-bold">${item.roomName}</p>
              </div>
              ${item.hasConflict && isPending ? `
                <span class="px-2.5 py-1 rounded-full bg-error text-on-error font-label-sm text-label-sm flex items-center gap-1 shadow-sm font-bold">
                  <span class="material-symbols-outlined text-[14px]">sync_problem</span> Bentrok
                </span>
              ` : isApproved ? `
                <span class="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-label-sm text-label-sm flex items-center gap-1 shadow-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">check</span> Disetujui
                </span>
              ` : isCompleted ? `
                <span class="px-2.5 py-1 rounded-full bg-indigo-600 text-white font-label-sm text-label-sm flex items-center gap-1 shadow-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">task_alt</span> Selesai
                </span>
              ` : isCancelled ? `
                <span class="px-2.5 py-1 rounded-full bg-slate-600 text-white font-label-sm text-label-sm flex items-center gap-1 shadow-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">block</span> Dibatalkan
                </span>
              ` : isRejected ? `
                <span class="px-2.5 py-1 rounded-full bg-rose-600 text-white font-label-sm text-label-sm flex items-center gap-1 shadow-sm font-semibold">
                  <span class="material-symbols-outlined text-[14px]">close</span> Ditolak
                </span>
              ` : `
                <span class="px-2.5 py-1 rounded-full bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold">
                  Siap Review
                </span>
              `}
            </div>
          </div>

          <!-- Details Section -->
          <div class="p-space-md flex flex-col space-y-space-md">
            
            <!-- Applicant Info -->
            <div class="flex items-center justify-between pb-space-sm border-b-0">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-on-primary-fixed shadow-sm font-bold">
                  ${item.applicantInitials || 'BS'}
                </div>
                <div>
                  <h3 class="font-headline-sm text-headline-sm text-on-surface leading-tight font-bold">${item.applicantName}</h3>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">${item.applicantDept}</span>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm">
                Peserta: ${item.participants} / ${item.roomCapacity}
              </span>
            </div>

            <!-- Schedule & Agenda -->
            <div class="bg-surface-container-low p-space-sm rounded-lg flex flex-col space-y-2">
              <div class="flex items-center gap-2 text-on-surface">
                <span class="material-symbols-outlined text-secondary text-[20px]">calendar_today</span>
                <span class="font-label-md text-label-md font-semibold">${item.reservationDate} • ${item.timeString}</span>
              </div>
              <div class="flex items-center gap-2 text-on-surface-variant">
                <span class="material-symbols-outlined text-[20px]">topic</span>
                <span class="font-body-sm text-body-sm text-on-surface font-medium">${item.eventName}</span>
              </div>
            </div>

            <!-- Purpose & Equipment -->
            <div class="space-y-1.5">
              <span class="font-label-sm text-label-sm text-on-surface-variant">Keperluan:</span>
              <p class="font-body-md text-body-md text-on-surface bg-surface-container-lowest p-2.5 rounded-lg shadow-inner">
                "${item.purpose}"
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="font-label-sm text-label-sm text-on-surface-variant mr-1">Fasilitas:</span>
              ${(item.facilities || []).map(f => `
                <span class="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm flex items-center gap-1">
                  <span class="material-symbols-outlined text-[14px]">check</span> ${f}
                </span>
              `).join('')}
            </div>

            ${item.rejectionReason ? `
              <div class="p-2.5 rounded-lg bg-rose-50 border border-rose-100 text-rose-800 text-xs">
                <strong>Alasan Penolakan:</strong> "${item.rejectionReason}"
              </div>
            ` : ''}

            <!-- Action Buttons for Pending State -->
            ${isPending ? `
              <div class="flex items-center gap-2 pt-2">
                <button onclick="RoomBookApp.openAdminRejectModal('${this.getReservationRouteId(item)}')" class="flex-1 py-3 px-3 rounded-xl bg-error-container text-on-error-container hover:bg-error hover:text-on-error font-headline-sm text-headline-sm transition-colors text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[18px]">close</span> Tolak
                </button>
                <button onclick="RoomBookApp.quickApproveReservation('${this.getReservationRouteId(item)}')" class="flex-1 py-3 px-3 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-headline-sm text-headline-sm transition-colors text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[18px]">check</span> Setujui
                </button>
              </div>
              ${item.hasConflict ? `
                <button onclick="RoomBookApp.navigate('#admin/detail-pengajuan/${this.getReservationRouteId(item)}')" class="w-full py-2 rounded-lg bg-surface-container text-primary font-label-md text-label-md font-semibold text-center hover:bg-surface-container-high transition-colors cursor-pointer flex items-center justify-center gap-1">
                  <span class="material-symbols-outlined text-base">compare_arrows</span>
                  Buka Analisis Konflik Detail
                </button>
              ` : ''}
            ` : ''}

          </div>
        </article>
      `;
    },

    bindAdminApprovalEvents() {},

    setAdminApprovalTab(tab) {
      this.activeAdminFilter = tab;
      this.render();
    },

    openAdminRejectModal(id) {
      this.targetRejectId = id;
      const modal = document.getElementById('admin-reject-modal');
      if (modal) {
        modal.showModal();
      }
    },

    async executeRejectReservation() {
      const id = this.targetRejectId || 'RB-892';
      const reasonNotes = document.getElementById('reject-admin-notes')?.value || 'Ruangan sudah dialokasikan untuk kegiatan pimpinan.';
      
      try {
        document.getElementById('admin-reject-modal')?.close();
        this.showToast(`Memproses penolakan pengajuan #${id}...`, 'hourglass_empty');
        await RoomBookStore.updateReservationStatusSupabase(id, 'rejected', reasonNotes);
        await RoomBookStore.loadReservationsFromDatabase();
        this.showToast(`Pengajuan #${id} berhasil ditolak di database. Pemohon telah dinotifikasi.`, 'cancel');
        this.render();
      } catch (err) {
        console.error('❌ Gagal menolak reservasi via RPC Supabase:', err);
        const errorMsg = this.formatRpcError(err, `menolak pengajuan #${id}`);
        this.showToast(errorMsg, 'error');
      }
    },

    async quickApproveReservation(id) {
      try {
        this.showToast(`Memproses persetujuan pengajuan #${id}...`, 'hourglass_empty');
        await RoomBookStore.updateReservationStatusSupabase(id, 'approved', 'Disetujui oleh Administrator.');
        await RoomBookStore.loadReservationsFromDatabase();
        this.showToast(`Pengajuan #${id} disetujui di database! QR Digital Key aktif.`, 'verified');
        this.render();
      } catch (err) {
        console.error('❌ Gagal menyetujui reservasi via RPC Supabase:', err);
        const errorMsg = this.formatRpcError(err, `menyetujui pengajuan #${id}`);
        this.showToast(errorMsg, 'error');
      }
    },

    prioritizeCandidate(name, room) {
      this.showToast(`Kandidat ${name} diprioritaskan untuk ${room}`, 'priority_high');
    },

    renderAdminDetailLoadingView(resId) {
      return `
        ${this.renderAdminHeader('Analisis Konflik')}
        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin page-fade-in">
          <div class="flex flex-col w-full gap-space-md pt-4">
            <div class="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm animate-pulse flex flex-col gap-3">
              <div class="h-4 bg-surface-container rounded w-1/3"></div>
              <div class="h-6 bg-surface-container rounded-full w-24"></div>
            </div>
            <div class="flex flex-col items-center justify-center p-8 text-center">
              <span class="material-symbols-outlined text-primary text-4xl animate-spin mb-2">progress_activity</span>
              <p class="font-headline-sm font-semibold text-on-surface">Memuat Detail Pengajuan...</p>
              <p class="font-body-sm text-on-surface-variant">Mengambil data pengajuan #${resId || '-'} dari database Supabase.</p>
            </div>
          </div>
        </main>
        ${this.renderAdminBottomNav('approval')}
      `;
    },

    renderAdminDetailAccessDeniedView(resId) {
      return `
        ${this.renderAdminHeader('Analisis Konflik')}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-error text-5xl mb-3">gpp_bad</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Akses Ditolak</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs leading-relaxed">
            Anda tidak memiliki izin Administrator untuk melihat data pengajuan #${resId || '-'}.
          </p>
          <button onclick="RoomBookApp.navigate('#admin/approval')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Daftar Approval</button>
        </main>
        ${this.renderAdminBottomNav('approval')}
      `;
    },

    renderAdminDetailSessionExpiredView(resId) {
      return `
        ${this.renderAdminHeader('Analisis Konflik')}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-amber-500 text-5xl mb-3">lock_clock</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Sesi Login Berakhir</h2>
          <p class="font-body-sm text-on-surface-variant mb-4">Masuk kembali untuk memuat pengajuan #${resId || '-'}.</p>
          <button onclick="RoomBookApp.navigate('#login')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer" type="button">Masuk Kembali</button>
        </main>
        ${this.renderAdminBottomNav('approval')}
      `;
    },

    renderAdminDetailConnectionErrorView(resId, errorMsg) {
      return `
        ${this.renderAdminHeader('Analisis Konflik')}
        <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
          <span class="material-symbols-outlined text-amber-500 text-5xl mb-3">cloud_off</span>
          <h2 class="font-headline-sm font-bold text-on-surface mb-1">Koneksi Database Gagal</h2>
          <p class="font-body-sm text-on-surface-variant mb-4 max-w-xs leading-relaxed">
            Terjadi kendala saat memuat data pengajuan #${resId || '-'} dari database Supabase.
            ${errorMsg ? `<br><span class="text-xs text-outline mt-1 block font-mono">(${errorMsg})</span>` : ''}
          </p>
          <div class="flex items-center gap-2">
            <button onclick="RoomBookApp.reloadAdminDetailPengajuan('${resId}')" class="px-4 py-2 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm flex items-center gap-1.5" type="button">
              <span class="material-symbols-outlined text-[18px]">refresh</span>
              <span>Coba Lagi</span>
            </button>
            <button onclick="RoomBookApp.navigate('#admin/approval')" class="px-4 py-2 bg-surface-container text-on-surface rounded-xl font-label-md font-semibold cursor-pointer hover:bg-surface-container-high transition-colors" type="button">Kembali ke Daftar Approval</button>
          </div>
        </main>
        ${this.renderAdminBottomNav('approval')}
      `;
    },

    async loadAdminDetailPengajuan(resId) {
      this.adminDetailPengajuanState = { id: resId, status: 'loading', error: null };
      try {
        const result = await RoomBookStore.fetchReservationById(resId);
        if (result.success && result.data) {
          this.adminDetailPengajuanState = { id: resId, status: 'success', error: null };
        } else if (result.accessDenied) {
          this.adminDetailPengajuanState = { id: resId, status: 'access_denied', error: result.error?.message };
        } else if (result.authRequired) {
          this.adminDetailPengajuanState = { id: resId, status: 'auth_required', error: result.error?.message };
        } else if (result.notFound) {
          this.adminDetailPengajuanState = { id: resId, status: 'not_found', error: result.error?.message };
        } else {
          this.adminDetailPengajuanState = { id: resId, status: 'error', error: result.error?.message || 'Gagal memuat pengajuan dari database.' };
        }
      } catch (err) {
        this.adminDetailPengajuanState = { id: resId, status: 'error', error: err.message };
      }
      this.render();
    },

    reloadAdminDetailPengajuan(resId) {
      this.adminDetailPengajuanState = { id: null, status: 'idle', error: null };
      this.loadAdminDetailPengajuan(resId);
    },

    // ==========================================
    // 10. ADMIN DETAIL PENGAJUAN & KONFLIK VIEW
    // ==========================================
    renderAdminDetailPengajuanView() {
      const resId = (this.params && this.params.id) || RoomBookStore.selectedReservationId || null;
      const state = this.adminDetailPengajuanState || { id: null, status: 'idle' };
      if (resId && RoomBookStore.dataSource === 'supabase' && (state.id !== resId || state.status === 'idle')) {
        this.loadAdminDetailPengajuan(resId);
        return this.renderAdminDetailLoadingView(resId);
      }

      if (resId && RoomBookStore.dataSource === 'supabase') {
        if (state.status === 'loading') return this.renderAdminDetailLoadingView(resId);
        if (state.status === 'access_denied') return this.renderAdminDetailAccessDeniedView(resId);
        if (state.status === 'auth_required') return this.renderAdminDetailSessionExpiredView(resId);
        if (state.status === 'error') return this.renderAdminDetailConnectionErrorView(resId, state.error);
        if (state.status === 'not_found') {
          return `
            ${this.renderAdminHeader('Analisis Konflik')}
            <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
              <span class="material-symbols-outlined text-outline text-5xl mb-3">search_off</span>
              <h2 class="font-headline-sm font-bold text-on-surface mb-1">Pengajuan Tidak Ditemukan</h2>
              <p class="font-body-sm text-on-surface-variant mb-4">Data pengajuan reservasi dengan ID "${resId || '-'}" tidak ditemukan di database.</p>
              <button onclick="RoomBookApp.navigate('#admin/approval')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Daftar Approval</button>
            </main>
            ${this.renderAdminBottomNav('approval')}
          `;
        }
      }

      let booking = resId ? RoomBookStore.getCachedReservationById(resId) : null;

      if (!booking) {
        if (!resId) {
          return `
            ${this.renderAdminHeader('Analisis Konflik')}
            <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
              <span class="material-symbols-outlined text-outline text-5xl mb-3">search_off</span>
              <h2 class="font-headline-sm font-bold text-on-surface mb-1">ID Pengajuan Kosong</h2>
              <p class="font-body-sm text-on-surface-variant mb-4">Parameter ID pengajuan tidak ditemukan di URL.</p>
              <button onclick="RoomBookApp.navigate('#admin/approval')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Daftar Approval</button>
            </main>
            ${this.renderAdminBottomNav('approval')}
          `;
        }

        const currentState = this.adminDetailPengajuanState || { id: null, status: 'idle' };

        if (currentState.id !== resId) {
          this.loadAdminDetailPengajuan(resId);
          return this.renderAdminDetailLoadingView(resId);
        }

        if (currentState.status === 'loading') {
          return this.renderAdminDetailLoadingView(resId);
        }

        if (currentState.status === 'access_denied') {
          return this.renderAdminDetailAccessDeniedView(resId);
        }

        if (currentState.status === 'auth_required') {
          return this.renderAdminDetailSessionExpiredView(resId);
        }

        if (currentState.status === 'error') {
          return this.renderAdminDetailConnectionErrorView(resId, currentState.error);
        }

        if (currentState.status === 'not_found') {
          return `
            ${this.renderAdminHeader('Analisis Konflik')}
            <main class="flex-1 flex flex-col items-center justify-center p-6 text-center page-fade-in">
              <span class="material-symbols-outlined text-outline text-5xl mb-3">search_off</span>
              <h2 class="font-headline-sm font-bold text-on-surface mb-1">Pengajuan Tidak Ditemukan</h2>
              <p class="font-body-sm text-on-surface-variant mb-4">Data pengajuan reservasi dengan ID "${resId || '-'}" tidak ditemukan di database.</p>
              <button onclick="RoomBookApp.navigate('#admin/approval')" class="px-5 py-2.5 bg-primary text-on-primary rounded-xl font-label-md font-semibold cursor-pointer hover:bg-primary-container transition-colors shadow-sm" type="button">Kembali ke Daftar Approval</button>
            </main>
            ${this.renderAdminBottomNav('approval')}
          `;
        }

        return this.renderAdminDetailLoadingView(resId);
      }

      if (this.adminDetailPengajuanState && this.adminDetailPengajuanState.id !== resId) {
        this.adminDetailPengajuanState = { id: resId, status: 'success', error: null };
      }

      // Cari reservasi yang bentrok aktual di ruangan yang sama
      const allRes = RoomBookStore.getReservations();
      const conflictingBooking = allRes.find(r => 
        r.id !== booking.id && 
        String(r.roomId) === String(booking.roomId) &&
        r.status !== 'rejected' &&
        r.rawStartTime && r.rawEndTime && booking.rawStartTime && booking.rawEndTime &&
        new Date(r.rawStartTime) < new Date(booking.rawEndTime) &&
        new Date(r.rawEndTime) > new Date(booking.rawStartTime)
      ) || (booking.conflictingReservationId ? RoomBookStore.getCachedReservationById(booking.conflictingReservationId) : null);

      const hasConflict = Boolean(conflictingBooking);

      return `
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between gap-space-sm">
            <div class="flex items-center gap-space-xs">
              <button aria-label="Kembali" onclick="if (window.history.length > 1) { history.back(); } else { RoomBookApp.navigate('#admin/approval'); }" class="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[24px]">arrow_back</span>
              </button>
              <h1 class="font-headline-md text-headline-md text-on-surface truncate">Analisis Jadwal Pengajuan</h1>
            </div>
            ${hasConflict ? `
              <span class="px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-sm text-label-sm font-bold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">warning</span> Bentrok Terdeteksi
              </span>
            ` : `
              <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-label-sm text-label-sm font-semibold flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">check_circle</span> Slot Aman
              </span>
            `}
          </div>
        </header>

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-4 pt-2 pb-6">
            
            <!-- Conflict Diagnosis Header -->
            ${hasConflict ? `
              <div class="p-4 bg-error-container text-on-error-container rounded-2xl shadow-sm flex flex-col gap-2">
                <div class="flex items-center gap-2 font-bold text-base">
                  <span class="material-symbols-outlined text-error">sync_problem</span>
                  <span>Overlap Waktu Pemakaian Terdeteksi</span>
                </div>
                <p class="text-xs text-on-error-container leading-relaxed">
                  Terdapat jadwal yang saling bertabrakan pada <strong>${booking.roomName} (${booking.roomFloor || 'Lt. 3'})</strong> untuk tanggal <strong>${booking.reservationDate}</strong>. Tinjau permohonan sebelum mengambil keputusan.
                </p>
              </div>
            ` : `
              <div class="p-4 bg-surface-container-lowest rounded-2xl shadow-sm flex flex-col gap-2 border border-surface-container-high">
                <div class="flex items-center gap-2 font-bold text-base text-primary">
                  <span class="material-symbols-outlined text-emerald-600">verified</span>
                  <span>Tidak Ada Konflik Jadwal Terdeteksi</span>
                </div>
                <p class="text-xs text-on-surface-variant leading-relaxed">
                  Slot waktu <strong>${booking.timeString}</strong> pada <strong>${booking.roomName}</strong> (${booking.reservationDate}) tidak memiliki konflik dengan reservasi lain yang disetujui atau pending.
                </p>
              </div>
            `}

            <!-- Comparison Timeline Visualizer -->
            <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
              <h3 class="font-headline-sm text-sm font-bold text-on-surface">${hasConflict ? 'Perbandingan Pemohon & Jadwal' : 'Informasi Pengajuan'}</h3>
              
              <div class="space-y-3 pt-1">
                <!-- Candidate 1: Booking Saat Ini -->
                <div class="p-3 rounded-xl bg-primary-fixed/30 border border-primary/20 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="font-semibold text-xs text-primary flex items-center gap-1">
                      <span class="w-2 h-2 rounded-full bg-primary"></span>
                      Pemohon: ${booking.applicantName} (${booking.applicantDept || 'Internal'})
                    </span>
                    <span class="text-xs font-bold text-primary">${booking.timeString}</span>
                  </div>
                  <p class="text-[12px] text-on-surface-variant font-medium">"${booking.eventName}" (${booking.participants} Peserta)</p>
                  <p class="text-[11px] text-on-surface-variant opacity-80">Tujuan: ${booking.purpose}</p>
                </div>

                <!-- Candidate 2: Conflicting Booking jika ada -->
                ${conflictingBooking ? `
                  <div class="p-3 rounded-xl bg-secondary-fixed/40 border border-secondary/20 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <span class="font-semibold text-xs text-secondary flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-secondary"></span>
                        Bentrok dengan: ${conflictingBooking.applicantName} (${conflictingBooking.applicantDept || 'Internal'})
                      </span>
                      <span class="text-xs font-bold text-secondary">${conflictingBooking.timeString}</span>
                    </div>
                    <p class="text-[12px] text-on-surface-variant font-medium">"${conflictingBooking.eventName}" (${conflictingBooking.participants} Peserta)</p>
                    <p class="text-[11px] text-on-surface-variant opacity-80">Status: <span class="capitalize font-semibold">${conflictingBooking.status}</span></p>
                  </div>
                ` : ''}
              </div>

              <!-- Recommendation Advice -->
              <div class="mt-2 p-3 bg-secondary-fixed/30 rounded-xl text-xs text-on-secondary-fixed flex items-start gap-2">
                <span class="material-symbols-outlined text-secondary text-base mt-0.5">psychology</span>
                <div>
                  <strong class="font-semibold">Catatan Sistem:</strong>
                  <p class="mt-0.5 text-on-secondary-fixed-variant leading-relaxed">
                    ${hasConflict ? 
                      `Pengajuan #${booking.id} diajukan pada ${booking.submittedAt}. Disarankan untuk memprioritaskan pemohon dengan urgensi lebih tinggi atau menawarkan jadwal alternatif.` :
                      `Pengajuan #${booking.id} memenuhi seluruh persyaratan kapasitas dan waktu. Anda dapat menyetujui pengajuan ini secara langsung.`}
                  </p>
                </div>
              </div>
            </div>

            <!-- Decision Options for Admin -->
            <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3">
              <h3 class="font-headline-sm text-sm font-bold text-on-surface">Keputusan Admin</h3>
              
              <div class="flex flex-col gap-2">
                <button onclick="RoomBookApp.resolveConflictApprove('${booking.id}')" class="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-headline-sm text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary-container active:scale-98 transition-all cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-base">check_circle</span>
                  <span>Setujui ${booking.applicantName} (#${booking.id})</span>
                </button>

                ${conflictingBooking && conflictingBooking.status === 'pending' ? `
                  <button onclick="RoomBookApp.resolveConflictApprove('${conflictingBooking.id}')" class="w-full py-2.5 px-4 rounded-xl bg-secondary text-on-secondary font-headline-sm text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-98 transition-all cursor-pointer" type="button">
                    <span class="material-symbols-outlined text-base">swap_horiz</span>
                    <span>Setujui ${conflictingBooking.applicantName} (#${conflictingBooking.id})</span>
                  </button>
                ` : ''}

                <button onclick="RoomBookApp.resolveConflictReroute()" class="w-full py-2.5 px-4 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-headline-sm text-xs font-semibold flex items-center justify-center gap-2 hover:bg-secondary-fixed-dim active:scale-98 transition-all cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-base">alt_route</span>
                  <span>Alihkan ke Ruangan Alternatif</span>
                </button>

                <button onclick="RoomBookApp.openAdminRejectModal('${booking.id}')" class="w-full py-2.5 px-4 rounded-xl bg-surface-container text-error font-headline-sm text-xs font-semibold flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-base">cancel</span>
                  <span>Tolak Pengajuan #${booking.id}</span>
                </button>
              </div>
            </div>

          </div>
        </main>

        ${this.renderAdminBottomNav('approval')}
      `;
    },

    bindAdminDetailPengajuanEvents() {},

    async resolveConflictApprove(id) {
      try {
        const item = await RoomBookStore.getReservationById(id);
        const name = item?.applicantName || 'Pemohon';
        this.showToast(`Memproses persetujuan #${id}...`, 'hourglass_empty');
        await RoomBookStore.updateReservationStatusSupabase(id, 'approved', 'Disetujui oleh Administrator via resolusi jadwal.');
        await RoomBookStore.loadReservationsFromDatabase();
        this.showToast(`Pengajuan #${id} (${name}) disetujui! Status berhasil diperbarui di database.`, 'verified');
        this.navigate('#admin/approval');
      } catch (err) {
        console.error('❌ Gagal menyetujui reservasi via RPC Supabase:', err);
        const errorMsg = this.formatRpcError(err, `menyetujui kandidat #${id}`);
        this.showToast(errorMsg, 'error');
      }
    },

    resolveConflictReroute() {
      this.showToast('Fitur penjadwalan alternatif ke ruangan lain dapat dikonfirmasi langsung dengan pemohon melalui email/kontak terdaftar.', 'info');
    },

    // ==========================================
    // 10B. ADMIN TAMBAH RUANGAN VIEW (UPLOAD FOTO)
    // ==========================================
    renderAdminTambahRuanganView() {
      const rooms = [...RoomBookStore.getRooms()].sort((a, b) => Number(b.dbId || 0) - Number(a.dbId || 0));
      const editingRoom = this._editingRoomId ? RoomBookStore.getRoomById(this._editingRoomId) : null;
      const isEditing = Boolean(editingRoom);

      const previewUrl = this._pendingRoomPhotoPreview || (editingRoom ? (editingRoom.image || editingRoom.thumbnail || '') : '');
      const fileName = this._pendingRoomPhotoFile ? this._pendingRoomPhotoFile.name : '';
      const fileSizeKb = this._pendingRoomPhotoFile ? Math.max(1, Math.round(this._pendingRoomPhotoFile.size / 1024)) : 0;

      const existingFacNames = editingRoom
        ? (editingRoom.facilities || []).map(f => (typeof f === 'string' ? f : f.name)).filter(Boolean)
        : null;

      const baseFacilityTemplates = [
        { label: 'AC Central', icon: 'ac_unit', defaultChecked: true },
        { label: 'WiFi High-Speed', icon: 'wifi', defaultChecked: true },
        { label: 'Proyektor & Layar', icon: 'videocam', defaultChecked: true },
        { label: 'Smart Display TV', icon: 'tv', defaultChecked: false },
        { label: 'Sound System & Mic', icon: 'mic', defaultChecked: false },
        { label: 'Whiteboard & Spidol', icon: 'draw', defaultChecked: false }
      ];
      const baseLabels = baseFacilityTemplates.map(f => f.label);
      const defaultFacilities = baseFacilityTemplates.map(f => ({
        label: f.label,
        icon: f.icon,
        checked: existingFacNames ? existingFacNames.includes(f.label) : f.defaultChecked
      }));
      const checkedDefaultCount = defaultFacilities.filter(f => f.checked).length;
      const extraCustomFacilities = existingFacNames
        ? existingFacNames.filter(name => !baseLabels.includes(name)).join(', ')
        : '';

      const valName = editingRoom ? (editingRoom.name || '') : '';
      const valFloor = editingRoom ? (editingRoom.floor || 'Lantai 1') : 'Lantai 1';
      const valCapacity = editingRoom ? (editingRoom.capacity || 20) : 20;

      return `
        ${this.renderAdminHeader(isEditing ? 'Edit Ruangan' : 'Tambah Ruangan')}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-space-md pb-8 pt-2">

            <!-- Header Banner -->
            <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary-container to-secondary p-space-md text-on-primary shadow-md">
              <div class="relative z-10 flex flex-col gap-1">
                <div class="flex items-center justify-between gap-2">
                  <span class="inline-flex items-center gap-1.5 self-start px-2.5 py-0.5 rounded-full bg-white/15 text-on-primary font-label-sm text-label-sm backdrop-blur-sm">
                    <span class="material-symbols-outlined text-[15px]">${isEditing ? 'edit_square' : 'add_business'}</span>
                    Manajemen Fasilitas
                  </span>
                  ${isEditing ? `
                    <button type="button" onclick="RoomBookApp.cancelAdminEditRoom()" class="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-[11px] font-semibold cursor-pointer">
                      Batal Edit
                    </button>
                  ` : ''}
                </div>
                <h1 class="font-headline-md text-headline-md tracking-tight mt-1 text-on-primary font-bold">
                  ${isEditing ? `Edit Ruangan: ${editingRoom.name}` : 'Tambah Ruangan Baru'}
                </h1>
                <p class="font-body-sm text-body-sm text-primary-fixed-dim">
                  ${isEditing ? 'Perbarui detail ruangan. Biarkan foto tidak berubah jika ingin mempertahankan foto lama.' : 'Upload foto ruangan & lengkapi detail agar langsung bisa dibooking oleh pengguna.'}
                </p>
              </div>
              <div class="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-secondary-container/30 blur-2xl pointer-events-none"></div>
            </div>

            <!-- Form Tambah / Edit Ruangan -->
            <form id="admin-add-room-form" class="flex flex-col gap-space-md" onsubmit="event.preventDefault(); RoomBookApp.handleAdminAddRoomSubmit();">

              <!-- Upload Foto Ruangan (Tanpa Input URL) -->
              <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <label class="font-headline-sm text-headline-sm text-on-surface font-bold">Foto Ruangan</label>
                  <span class="font-label-sm text-label-sm text-secondary font-medium">${isEditing ? 'Opsional (Ganti Foto)' : 'Wajib Upload Foto'}</span>
                </div>

                <input type="file" id="admin-room-photo-input" accept="image/*" class="hidden" onchange="RoomBookApp.handleAdminRoomPhotoSelect(this)" />

                <div id="admin-room-photo-dropzone" class="${previewUrl ? 'hidden' : 'flex'} flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors text-center" onclick="document.getElementById('admin-room-photo-input').click()">
                  <div class="w-14 h-14 rounded-full bg-primary-fixed text-primary flex items-center justify-center shadow-xs">
                    <span class="material-symbols-outlined text-[28px]">add_a_photo</span>
                  </div>
                  <div>
                    <p class="font-label-md text-label-md text-on-surface font-bold">Upload Foto Ruangan</p>
                    <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Pilih dari galeri atau kamera (JPG, PNG, WEBP)</p>
                  </div>
                  <span class="mt-1 px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-xs">
                    Pilih File Foto
                  </span>
                </div>

                <div id="admin-room-photo-preview-box" class="${previewUrl ? 'flex' : 'hidden'} flex-col gap-2.5">
                  <div class="relative w-full h-48 rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30">
                    <img id="admin-room-photo-preview" src="${previewUrl}" alt="Preview Foto Ruangan" class="w-full h-full object-cover" />
                    <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-[11px]">
                      <span id="admin-room-photo-meta" class="truncate font-medium">${fileName ? `${fileName} (${fileSizeKb} KB)` : (isEditing ? 'Foto tersimpan saat ini' : 'Foto siap diupload')}</span>
                      <span class="text-emerald-300 font-semibold shrink-0 ml-2">${fileName ? 'Siap Upload' : 'Foto Aktif'}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button type="button" onclick="document.getElementById('admin-room-photo-input').click()" class="flex-1 py-2 px-3 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors">
                      <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
                      <span>Ganti Foto</span>
                    </button>
                    <button type="button" onclick="RoomBookApp.clearAdminRoomPhoto()" class="py-2 px-3 rounded-xl bg-error-container text-on-error-container hover:bg-error hover:text-on-error font-label-sm text-label-sm font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Nama & Lokasi Ruangan -->
              <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="admin-room-name">Nama Ruangan</label>
                  <div class="relative flex items-center">
                    <span class="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">meeting_room</span>
                    <input id="admin-room-name" type="text" value="${valName}" placeholder="Contoh: Ruang Rapat Anggrek" required class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:bg-surface-container transition-colors" />
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="admin-room-floor">Lokasi / Lantai Gedung</label>
                  <div class="relative flex items-center">
                    <span class="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">location_on</span>
                    <input id="admin-room-floor" type="text" placeholder="Contoh: Lantai 2 • Sayap Timur" value="${valFloor}" required class="w-full bg-surface-container-low text-on-surface font-body-md text-body-md pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:bg-surface-container transition-colors" />
                  </div>
                </div>
              </div>

              <!-- Kapasitas Ruangan -->
              <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                  <label class="font-label-sm text-label-sm text-on-surface-variant font-semibold" for="admin-room-capacity">Kapasitas Maksimal (Orang)</label>
                  <span class="font-label-sm text-label-sm text-primary font-semibold">Wajib > 0</span>
                </div>
                <div class="relative flex items-center">
                  <span class="material-symbols-outlined absolute left-3 text-outline text-[20px] pointer-events-none">groups</span>
                  <input id="admin-room-capacity" type="number" min="1" max="1000" value="${valCapacity}" required class="w-full bg-surface-container-low text-on-surface font-headline-sm text-headline-sm font-bold pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:bg-surface-container transition-colors" />
                </div>
                <div class="flex flex-wrap gap-1.5 pt-1">
                  ${[8, 15, 20, 40, 80].map(preset => `
                    <button type="button" onclick="RoomBookApp.setAdminRoomCapacity(${preset})" class="px-3 py-1 rounded-full bg-surface-container text-on-surface-variant hover:bg-primary hover:text-on-primary font-label-sm text-label-sm font-semibold transition-colors cursor-pointer">
                      ${preset} Org
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Fasilitas Ruangan -->
              <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex flex-col gap-3">
                <div class="flex items-center justify-between">
                  <span class="font-label-sm text-label-sm text-on-surface-variant font-semibold">Fasilitas Tersedia</span>
                  <span id="admin-room-fac-count" class="font-label-sm text-label-sm text-secondary font-medium">${checkedDefaultCount} Terpilih</span>
                </div>
                <div class="flex flex-col gap-2" id="admin-room-facility-chips">
                  ${defaultFacilities.map(f => `
                    <label class="admin-facility-chip flex items-center justify-between p-3 rounded-xl ${f.checked ? 'bg-secondary-fixed text-on-secondary-fixed' : 'bg-surface-container-low text-on-surface'} cursor-pointer transition-colors" data-label="${f.label}">
                      <div class="flex items-center gap-space-sm">
                        <span class="material-symbols-outlined text-[20px]">${f.icon}</span>
                        <span class="font-label-md text-label-md font-semibold">${f.label}</span>
                      </div>
                      <input ${f.checked ? 'checked' : ''} class="hidden admin-facility-toggle" type="checkbox" />
                      <span class="material-symbols-outlined admin-checkbox-icon ${f.checked ? 'text-primary' : 'text-outline'} text-[20px]" style="font-variation-settings: 'FILL' ${f.checked ? 1 : 0};">${f.checked ? 'check_box' : 'check_box_outline_blank'}</span>
                    </label>
                  `).join('')}
                </div>
                <div class="flex flex-col gap-1 pt-1">
                  <label class="font-label-sm text-label-sm text-on-surface-variant" for="admin-room-custom-facilities">Fasilitas Tambahan Lain (Opsional)</label>
                  <input id="admin-room-custom-facilities" type="text" value="${extraCustomFacilities}" placeholder="Contoh: Podium, Coffee Station (pisahkan koma)" class="w-full bg-surface-container-low text-on-surface font-body-sm text-body-sm px-3.5 py-2.5 rounded-xl focus:outline-none focus:bg-surface-container transition-colors" />
                </div>
              </div>

              <!-- Submit Button -->
              <div class="flex gap-2">
                ${isEditing ? `
                  <button type="button" onclick="RoomBookApp.cancelAdminEditRoom()" class="px-4 py-3.5 rounded-xl bg-surface-container text-on-surface font-headline-sm text-sm font-semibold hover:bg-surface-container-high transition-colors cursor-pointer">
                    Batal
                  </button>
                ` : ''}
                <button id="btn-submit-new-room" type="submit" class="flex-1 py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer">
                  <span class="material-symbols-outlined text-[22px]">${isEditing ? 'save' : 'add_circle'}</span>
                  <span>${isEditing ? 'Simpan Perubahan Ruangan' : 'Simpan & Tambah Ruangan'}</span>
                </button>
              </div>
            </form>

            <!-- Daftar Ruangan Aktif Saat Ini -->
            <section class="flex flex-col gap-3 pt-2">
              <div class="flex items-center justify-between">
                <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Ruangan Aktif (${rooms.length})</h2>
                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">Tersedia di User</span>
              </div>
              <div class="flex flex-col gap-2.5">
                ${rooms.length === 0 ? `
                  <div class="p-6 text-center bg-surface-container-lowest rounded-xl flex flex-col items-center gap-2 text-on-surface-variant">
                    <span class="material-symbols-outlined text-3xl text-outline">meeting_room</span>
                    <p class="font-body-sm">Belum ada ruangan aktif saat ini.</p>
                  </div>
                ` : rooms.map(r => `
                  <div class="bg-surface-container-lowest rounded-xl p-3 shadow-xs flex items-center gap-3">
                    <img src="${r.thumbnail || r.image}" alt="${r.name}" class="w-14 h-14 rounded-lg object-cover shrink-0 bg-surface-container" />
                    <div class="flex-1 min-w-0">
                      <p class="font-headline-sm text-on-surface font-bold truncate">${r.name}</p>
                      <p class="font-body-sm text-on-surface-variant truncate">${r.floor} • Kapasitas ${r.capacity} Orang</p>
                    </div>
                    <div class="flex items-center gap-1.5 shrink-0">
                      <button type="button" onclick="RoomBookApp.startEditRoom('${r.id}')" class="px-2.5 py-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed hover:bg-primary hover:text-on-primary font-label-sm text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer" title="Edit ruangan ini">
                        <span class="material-symbols-outlined text-[15px]">edit</span>
                        <span>Edit</span>
                      </button>
                      <button type="button" onclick="RoomBookApp.openDeleteRoomModal('${r.id}')" class="px-2.5 py-1.5 rounded-lg bg-error-container text-on-error-container hover:bg-error hover:text-on-error font-label-sm text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer" title="Hapus ruangan ini">
                        <span class="material-symbols-outlined text-[15px]">delete</span>
                        <span>Hapus</span>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </section>

          </div>
        </main>

        ${this.renderAdminBottomNav('tambah-ruangan')}
      `;
    },

    bindAdminTambahRuanganEvents() {
      const chips = document.querySelectorAll('.admin-facility-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          const cb = chip.querySelector('.admin-facility-toggle');
          const icon = chip.querySelector('.admin-checkbox-icon');
          cb.checked = !cb.checked;

          if (cb.checked) {
            chip.classList.remove('bg-surface-container-low', 'text-on-surface');
            chip.classList.add('bg-secondary-fixed', 'text-on-secondary-fixed');
            icon.textContent = 'check_box';
            icon.classList.remove('text-outline');
            icon.classList.add('text-primary');
            icon.style.fontVariationSettings = "'FILL' 1";
          } else {
            chip.classList.remove('bg-secondary-fixed', 'text-on-secondary-fixed');
            chip.classList.add('bg-surface-container-low', 'text-on-surface');
            icon.textContent = 'check_box_outline_blank';
            icon.classList.remove('text-primary');
            icon.classList.add('text-outline');
            icon.style.fontVariationSettings = "'FILL' 0";
          }

          const count = document.querySelectorAll('.admin-facility-toggle:checked').length;
          const countEl = document.getElementById('admin-room-fac-count');
          if (countEl) countEl.textContent = `${count} Terpilih`;
        });
      });
    },

    setAdminRoomCapacity(val) {
      const input = document.getElementById('admin-room-capacity');
      if (input) input.value = val;
    },

    handleAdminRoomPhotoSelect(input) {
      const file = input && input.files && input.files[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) {
        this.showToast('File harus berupa gambar (JPG, PNG, WEBP).', 'warning');
        return;
      }

      this._pendingRoomPhotoFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this._pendingRoomPhotoPreview = e.target.result;
        const dropzone = document.getElementById('admin-room-photo-dropzone');
        const previewBox = document.getElementById('admin-room-photo-preview-box');
        const previewImg = document.getElementById('admin-room-photo-preview');
        const metaEl = document.getElementById('admin-room-photo-meta');
        if (previewImg) previewImg.src = e.target.result;
        if (metaEl) metaEl.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
        if (dropzone) dropzone.classList.add('hidden');
        if (previewBox) {
          previewBox.classList.remove('hidden');
          previewBox.classList.add('flex');
        }
      };
      reader.readAsDataURL(file);
    },

    clearAdminRoomPhoto() {
      this._pendingRoomPhotoFile = null;
      this._pendingRoomPhotoPreview = null;
      const input = document.getElementById('admin-room-photo-input');
      const dropzone = document.getElementById('admin-room-photo-dropzone');
      const previewBox = document.getElementById('admin-room-photo-preview-box');
      const previewImg = document.getElementById('admin-room-photo-preview');
      if (input) input.value = '';
      if (previewImg) previewImg.src = '';
      if (previewBox) {
        previewBox.classList.add('hidden');
        previewBox.classList.remove('flex');
      }
      if (dropzone) {
        dropzone.classList.remove('hidden');
        dropzone.classList.add('flex');
      }
    },

    startEditRoom(roomId) {
      const room = RoomBookStore.getRoomById(roomId);
      if (!room) {
        this.showToast('Data ruangan tidak ditemukan.', 'warning');
        return;
      }
      this._editingRoomId = room.id;
      this._pendingRoomPhotoFile = null;
      this._pendingRoomPhotoPreview = room.image || room.thumbnail || null;
      this.render();
      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        window.scrollTo(0, 0);
      }
    },

    cancelAdminEditRoom() {
      this._editingRoomId = null;
      this._pendingRoomPhotoFile = null;
      this._pendingRoomPhotoPreview = null;
      this.render();
    },

    async handleAdminAddRoomSubmit() {
      const name = document.getElementById('admin-room-name')?.value?.trim() || '';
      const floor = document.getElementById('admin-room-floor')?.value?.trim() || '';
      const capRaw = document.getElementById('admin-room-capacity')?.value;
      const capacity = parseInt(capRaw, 10);
      const customFacRaw = document.getElementById('admin-room-custom-facilities')?.value || '';

      const editingRoom = this._editingRoomId ? RoomBookStore.getRoomById(this._editingRoomId) : null;
      const isEditing = Boolean(editingRoom);

      if (!isEditing && !this._pendingRoomPhotoFile) {
        this.showToast('Silakan upload foto ruangan terlebih dahulu.', 'add_a_photo');
        return;
      }
      if (!name) {
        this.showToast('Nama ruangan wajib diisi.', 'warning');
        return;
      }
      if (isNaN(capacity) || capacity <= 0) {
        this.showToast('Kapasitas ruangan harus lebih dari 0 orang.', 'warning');
        return;
      }
      if (!floor) {
        this.showToast('Lokasi atau lantai ruangan wajib diisi.', 'warning');
        return;
      }

      const facilities = [];
      document.querySelectorAll('.admin-facility-chip').forEach(chip => {
        const cb = chip.querySelector('.admin-facility-toggle');
        if (cb && cb.checked && chip.dataset.label) {
          facilities.push(chip.dataset.label);
        }
      });
      if (customFacRaw.trim()) {
        customFacRaw.split(',').map(s => s.trim()).filter(Boolean).forEach(item => {
          if (!facilities.includes(item)) facilities.push(item);
        });
      }
      if (facilities.length === 0) {
        this.showToast('Pilih minimal 1 fasilitas ruangan.', 'warning');
        return;
      }

      const btn = document.getElementById('btn-submit-new-room');
      const originalHtml = btn ? btn.innerHTML : '';
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[20px]">progress_activity</span><span>${isEditing ? 'Menyimpan Perubahan...' : 'Mengupload Foto & Menyimpan...'}</span>`;
      }

      try {
        let result;
        if (isEditing) {
          result = await RoomBookStore.updateRoomSupabase({
            roomId: editingRoom.dbId || editingRoom.id,
            name,
            capacity,
            floor,
            facilities,
            imageFile: this._pendingRoomPhotoFile || null
          });
          this._editingRoomId = null;
          this._pendingRoomPhotoFile = null;
          this._pendingRoomPhotoPreview = null;
          this.showToast(`Perubahan ruangan "${name}" berhasil disimpan!`, 'check_circle');
        } else {
          result = await RoomBookStore.createRoomSupabase({
            name,
            capacity,
            floor,
            facilities,
            imageFile: this._pendingRoomPhotoFile
          });
          this._pendingRoomPhotoFile = null;
          this._pendingRoomPhotoPreview = null;
          this.showToast(`Ruangan "${name}" berhasil ditambahkan dan langsung tersedia untuk user!`, 'check_circle');
        }

        if (result && result.storageMode === 'embedded') {
          console.log('ℹ️ [RoomBookApp] Foto disimpan dalam format terkompresi.');
        }
        this.render();
      } catch (err) {
        console.error(isEditing ? '❌ Gagal memperbarui ruangan:' : '❌ Gagal menambah ruangan:', err);
        this.showToast(this.formatRpcError(err, isEditing ? 'memperbarui ruangan' : 'menambah ruangan'), 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      }
    },

    openDeleteRoomModal(roomId) {
      const room = RoomBookStore.getRoomById(roomId);
      if (!room) {
        this.showToast('Data ruangan tidak ditemukan.', 'warning');
        return;
      }

      this._targetDeleteRoomId = room.dbId || room.id;
      const modal = document.getElementById('admin-delete-room-modal');
      const targetNameEl = document.getElementById('delete-room-target-name');
      if (targetNameEl) {
        targetNameEl.textContent = room.name;
      }

      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      } else if (typeof confirm === 'function') {
        if (confirm(`Apakah Anda yakin ingin menghapus ruangan "${room.name}"?`)) {
          this.executeDeleteRoom();
        }
      }
    },

    async executeDeleteRoom() {
      const targetId = this._targetDeleteRoomId;
      if (!targetId) return;

      const room = RoomBookStore.getRoomById(targetId);
      const roomName = room ? room.name : `#${targetId}`;
      const modal = document.getElementById('admin-delete-room-modal');
      const confirmBtn = document.getElementById('btn-confirm-delete-room');
      const originalHtml = confirmBtn ? confirmBtn.innerHTML : 'Ya, Hapus';

      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = 'Menghapus...';
      }

      try {
        await RoomBookStore.deleteRoomSupabase(targetId);
        this._targetDeleteRoomId = null;
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
        this.showToast(`Ruangan "${roomName}" berhasil dihapus & tidak lagi disewakan.`, 'delete_sweep');
        this.render();
      } catch (err) {
        console.error('❌ Gagal menghapus ruangan:', err);
        if (modal && typeof modal.close === 'function') {
          modal.close();
        }
        this.showToast(this.formatRpcError(err, `menghapus ruangan "${roomName}"`), 'error');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = originalHtml;
        }
      }
    },

    openForgotPasswordModal() {
      const modal = document.getElementById('forgot-password-modal');
      const input = document.getElementById('forgot-password-email');
      const loginEmail = document.getElementById('login-identifier')?.value?.trim() || '';
      if (input && loginEmail) input.value = loginEmail;
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        this.showToast('Masukkan email Anda untuk mengirim tautan reset sandi.', 'mail');
      }
    },

    async executeForgotPassword() {
      const modal = document.getElementById('forgot-password-modal');
      const input = document.getElementById('forgot-password-email');
      const btn = document.getElementById('btn-submit-forgot-pwd');
      const email = input?.value?.trim() || '';
      if (!email) {
        this.showToast('Email wajib diisi.', 'warning');
        return;
      }
      if (!window.AuthService || typeof window.AuthService.resetPassword !== 'function') {
        this.showToast('Layanan AuthService belum siap.', 'error');
        return;
      }
      const orig = btn ? btn.textContent : 'Kirim Tautan';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Mengirim...';
      }
      try {
        const res = await window.AuthService.resetPassword(email);
        if (modal && typeof modal.close === 'function') modal.close();
        this.showToast(res.message, res.success ? 'mark_email_read' : 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = orig;
        }
      }
    },

    openAdminCheckInModal() {
      const modal = document.getElementById('admin-checkin-modal');
      const resInput = document.getElementById('checkin-res-id-input');
      const qrInput = document.getElementById('checkin-qr-code-input');
      if (resInput) resInput.value = '';
      if (qrInput) qrInput.value = '';
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    },

    async executeAdminCheckIn() {
      const modal = document.getElementById('admin-checkin-modal');
      const resInput = document.getElementById('checkin-res-id-input')?.value?.trim() || '';
      const qrInput = document.getElementById('checkin-qr-code-input')?.value?.trim() || null;
      const btn = document.getElementById('btn-submit-admin-checkin');

      if (!resInput) {
        this.showToast('Masukkan ID Reservasi atau Kode QR tiket.', 'warning');
        return;
      }

      const orig = btn ? btn.textContent : 'Konfirmasi Check-In';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memverifikasi...';
      }

      try {
        await RoomBookStore.checkInReservationSupabase(resInput, qrInput);
        if (modal && typeof modal.close === 'function') modal.close();
        this.showToast('Check-in tiket berhasil terverifikasi di database!', 'verified');
        this.render();
      } catch (err) {
        this.showToast(this.formatRpcError(err, 'memproses check-in tiket'), 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = orig;
        }
      }
    },

    openEditProfileModal() {
      const modal = document.getElementById('edit-profile-modal');
      const input = document.getElementById('edit-profile-name-input');
      if (input) input.value = RoomBookStore.currentUser?.name || '';
      if (modal && typeof modal.showModal === 'function') {
        modal.showModal();
      }
    },

    async executeEditProfileName() {
      const modal = document.getElementById('edit-profile-modal');
      const newName = document.getElementById('edit-profile-name-input')?.value?.trim() || '';
      const btn = document.getElementById('btn-submit-edit-profile');
      if (!newName || newName.length < 2) {
        this.showToast('Nama lengkap minimal 2 karakter.', 'warning');
        return;
      }
      if (!window.AuthService || typeof window.AuthService.updateProfileName !== 'function') {
        this.showToast('Layanan AuthService belum tersedia.', 'error');
        return;
      }

      const orig = btn ? btn.textContent : 'Simpan Nama';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Menyimpan...';
      }
      try {
        const res = await window.AuthService.updateProfileName(newName);
        if (res.success) {
          if (modal && typeof modal.close === 'function') modal.close();
          this.showToast(res.message, 'check_circle');
          this.render();
        } else {
          this.showToast(res.message, 'error');
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = orig;
        }
      }
    },

    // ==========================================
    // 11. PROFILE VIEW
    // ==========================================
    renderProfilView() {
      const isAdmin = RoomBookStore.currentRole === 'admin';
      const hasAdminPrivilege = typeof window !== 'undefined' && window.AuthService && typeof window.AuthService.isAdmin === 'function'
        ? window.AuthService.isAdmin()
        : isAdmin;
      const currentUser = RoomBookStore.currentUser || {};
      const userName = currentUser.name || (isAdmin ? 'Admin Fasilitas & IT' : 'Pengguna Ruangan');
      const userEmail = currentUser.email || 'belum_login@kampus.ac.id';
      const userDept = currentUser.dept || (isAdmin ? 'Biro Aset Operasional Kampus' : 'Civitas Akademika');
      const userInitials = currentUser.initials || (isAdmin ? 'AD' : 'US');

      return `
        ${this.renderHeader('Profil Pengguna', true)}

        <main class="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-surface px-margin">
          <div class="flex flex-col w-full gap-4 pt-4">
            
            <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col items-center text-center gap-3">
              <div class="w-20 h-20 rounded-full bg-primary-fixed text-primary flex items-center justify-center text-2xl font-bold shadow-sm">
                ${userInitials}
              </div>
              <div>
                <h2 class="font-headline-lg text-xl font-bold text-on-surface">
                  ${userName}
                </h2>
                <p class="font-body-sm text-on-surface-variant">
                  ${userDept} • ${userEmail}
                </p>
              </div>
              <span class="px-3 py-1 rounded-full text-xs font-semibold ${isAdmin ? 'bg-secondary text-on-secondary' : 'bg-primary text-on-primary'}">
                ${isAdmin ? 'Hak Akses: Administrator Fasilitas' : 'Hak Akses: Civitas / Staff Internal'}
              </span>
            </div>

            <!-- Settings & Account Option -->
            <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-2">
              <span class="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pengaturan Akun &amp; Sesi</span>

              <button onclick="RoomBookApp.openEditProfileModal()" class="w-full p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-left transition-colors cursor-pointer">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-primary text-xl">edit</span>
                  <div>
                    <span class="font-semibold text-xs text-on-surface block">Ubah Nama Profil</span>
                    <span class="text-[11px] text-on-surface-variant">Perbarui nama lengkap Anda di database</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-sm text-outline">chevron_right</span>
              </button>

              ${hasAdminPrivilege ? `
                <button onclick="RoomBookApp.switchRole('${isAdmin ? 'user' : 'admin'}')" class="w-full p-3 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-between text-left transition-colors cursor-pointer">
                  <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-primary text-xl">${isAdmin ? 'person' : 'shield'}</span>
                    <div>
                      <span class="font-semibold text-xs text-on-surface block">Ganti Portal Tampilan</span>
                      <span class="text-[11px] text-on-surface-variant">Beralih ke mode ${isAdmin ? 'User' : 'Admin'}</span>
                    </div>
                  </div>
                  <span class="material-symbols-outlined text-sm text-outline">chevron_right</span>
                </button>
              ` : ''}

              <button onclick="RoomBookApp.handleLogout()" class="w-full p-3 rounded-xl bg-error-container text-on-error-container hover:bg-error hover:text-on-error flex items-center justify-between text-left transition-colors cursor-pointer mt-1">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-xl">logout</span>
                  <span class="font-semibold text-xs">Keluar dari Akun (Logout Supabase)</span>
                </div>
                <span class="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

          </div>
        </main>

        ${isAdmin ? this.renderAdminBottomNav('profil') : this.renderUserBottomNav('profil')}
      `;
    },

    // ==========================================
    // SHELL HEADER & NAVIGATION BUILDERS
    // ==========================================
    renderHeader(title, showBack = false) {
      const userPending = (RoomBookStore.getUserReservations() || []).filter(b => b.status === 'pending').length;
      const userNotifText = userPending > 0
        ? `${userPending} pengajuan Anda masih menunggu persetujuan admin`
        : 'Semua pengajuan Anda telah terupdate';

      return `
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between">
            <div class="flex items-center gap-space-sm">
              ${showBack ? `
                <button aria-label="Kembali" onclick="history.back()" class="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-on-surface hover:text-primary hover:bg-surface-container-high transition-colors cursor-pointer" type="button">
                  <span class="material-symbols-outlined text-[24px]">arrow_back</span>
                </button>
              ` : `
                <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
                  <span class="material-symbols-outlined text-[22px]">meeting_room</span>
                </div>
              `}
              <div class="flex flex-col">
                <span class="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">RoomBook</span>
                <span class="font-label-sm text-label-sm text-on-surface-variant leading-none">${title}</span>
              </div>
            </div>
            <div class="flex items-center gap-space-xs">
              <button aria-label="Notifikasi" onclick="RoomBookApp.showToast('${userNotifText}', 'notifications')" class="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[22px]">notifications</span>
                ${userPending > 0 ? '<span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>' : ''}
              </button>
              <div onclick="RoomBookApp.navigate('#user/profil')" class="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>
        </header>
      `;
    },

    renderAdminHeader(subtitle) {
      const adminPending = (RoomBookStore.getPendingReservations() || []).length;
      const adminNotifText = adminPending > 0
        ? `${adminPending} pengajuan menunggu verifikasi Anda`
        : 'Tidak ada pengajuan menunggu verifikasi';

      return `
        <header class="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
          <div class="h-16 px-margin flex items-center justify-between">
            <div class="flex items-center gap-space-sm">
              <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
                <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1;">shield</span>
              </div>
              <div class="flex flex-col">
                <span class="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">RoomBook Admin</span>
                <span class="font-label-sm text-label-sm text-on-surface-variant leading-none">${subtitle}</span>
              </div>
            </div>
            <div class="flex items-center gap-space-xs">
              <button aria-label="Notifikasi" onclick="RoomBookApp.showToast('${adminNotifText}', 'notifications')" class="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors" type="button">
                <span class="material-symbols-outlined text-[22px]">notifications</span>
                ${adminPending > 0 ? '<span class="absolute top-2 right-2 w-2 h-2 bg-error rounded-full"></span>' : ''}
              </button>
              <div onclick="RoomBookApp.navigate('#admin/profil')" class="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                <span class="material-symbols-outlined text-on-primary text-[18px]">manage_accounts</span>
              </div>
            </div>
          </div>
        </header>
      `;
    },

    renderUserBottomNav(activeTab) {
      return `
        <nav class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)] border-t border-surface-container-high">
          <div class="flex items-center justify-around h-16 px-space-xs max-w-md mx-auto">
            <a onclick="RoomBookApp.navigate('#user/dashboard')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'beranda' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'beranda' ? 'filled' : ''}">home</span>
              <span class="font-label-sm text-[11px]">Beranda</span>
            </a>
            <a onclick="RoomBookApp.navigate('#user/ketersediaan')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'ketersediaan' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'ketersediaan' ? 'filled' : ''}">calendar_month</span>
              <span class="font-label-sm text-[11px]">Ketersediaan</span>
            </a>
            <a onclick="RoomBookApp.navigate('#user/riwayat')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'riwayat' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'riwayat' ? 'filled' : ''}">history</span>
              <span class="font-label-sm text-[11px]">Riwayat</span>
            </a>
            <a onclick="RoomBookApp.navigate('#user/profil')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'profil' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'profil' ? 'filled' : ''}">account_circle</span>
              <span class="font-label-sm text-[11px]">Profil</span>
            </a>
          </div>
        </nav>
      `;
    },

    renderAdminBottomNav(activeTab) {
      return `
        <nav class="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl shadow-[0_-2px_12px_rgba(0,0,0,0.06)] border-t border-surface-container-high">
          <div class="flex items-center justify-around h-16 px-space-xs max-w-md mx-auto">
            <a onclick="RoomBookApp.navigate('#admin/dashboard')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'dashboard' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'dashboard' ? 'filled' : ''}">dashboard</span>
              <span class="font-label-sm text-[11px]">Dashboard</span>
            </a>
            <a onclick="RoomBookApp.navigate('#admin/approval')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'approval' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'approval' ? 'filled' : ''}">rule</span>
              <span class="font-label-sm text-[11px]">Approval</span>
            </a>
            <a onclick="RoomBookApp.navigate('#admin/tambah-ruangan')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'tambah-ruangan' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'tambah-ruangan' ? 'filled' : ''}">add_business</span>
              <span class="font-label-sm text-[10px] leading-none whitespace-nowrap">Tambah Ruangan</span>
            </a>
            <a onclick="RoomBookApp.navigate('#admin/profil')" class="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${activeTab === 'profil' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-primary'}">
              <span class="material-symbols-outlined text-[24px] ${activeTab === 'profil' ? 'filled' : ''}">manage_accounts</span>
              <span class="font-label-sm text-[11px]">Profil</span>
            </a>
          </div>
        </nav>
      `;
    }
  };

  // Expose to window
  window.RoomBookApp = App;

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
  } else {
    App.init();
  }
})();
