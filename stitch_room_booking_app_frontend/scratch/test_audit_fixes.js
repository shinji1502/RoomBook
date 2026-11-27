const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('🧪 [Test Suite] Menguji Seluruh Perbaikan Audit & Fitur Baru RoomBook...\n');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      return res.then(() => {
        console.log(`✅ [PASS] ${name}`);
        passed++;
      }).catch((err) => {
        console.error(`❌ [FAIL] ${name}\n   -> ${err.stack || err.message}`);
        failed++;
      });
    }
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}\n   -> ${err.stack || err.message}`);
    failed++;
  }
  return Promise.resolve();
}

const frontendDir = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
const authCode = fs.readFileSync(path.join(frontendDir, 'authService.js'), 'utf8');
const roomServiceCode = fs.readFileSync(path.join(frontendDir, 'roomService.js'), 'utf8');
const dataCode = fs.readFileSync(path.join(frontendDir, 'data.js'), 'utf8');
const appCode = fs.readFileSync(path.join(frontendDir, 'app.js'), 'utf8');
const migrationV4Sql = fs.readFileSync(path.join(frontendDir, 'supabase_migration_v4.sql'), 'utf8');

function createHarness() {
  const storage = {};
  const elements = {};
  const makeEl = (id) => ({
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    dataset: {},
    style: {},
    disabled: false,
    classList: { add() {}, remove() {}, contains: () => false },
    addEventListener() {},
    querySelectorAll: () => [],
    querySelector: () => null,
    showModal() { this.open = true; },
    close() { this.open = false; }
  });

  [
    'view-root', 'modal-qr-canvas-box', 'modal-qr-code', 'modal-qr-payload',
    'modal-qr-room', 'modal-qr-time', 'qr-code-modal',
    'form-reservation-date', 'native-date-picker', 'form-time-start', 'form-time-end',
    'conflict-banner', 'conflict-time-indicator', 'form-live-schedule-box',
    'admin-room-name', 'admin-room-floor', 'admin-room-capacity', 'admin-room-custom-facilities',
    'btn-submit-new-room', 'room-today-schedule-list'
  ].forEach(id => { elements[id] = makeEl(id); });

  const rpcCalls = [];
  let roomUpdateResult = {
    success: true,
    id: 1,
    room: {
      id: 1,
      name: 'Ruang Rapat Updated',
      capacity: 45,
      floor: 'Lantai 4',
      facilities: 'AC Central, Proyektor & Layar, Audio Mixer',
      image_url: 'https://example.supabase.co/storage/v1/object/public/room-images/rooms/old.jpg',
      created_at: new Date().toISOString()
    }
  };
  let adminPrivilege = false;

  const mockSupabaseClient = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      resetPasswordForEmail: async (email) => ({ data: { email }, error: null }),
      updateUser: async (payload) => ({ data: { user: { id: 'u-1', user_metadata: payload.data } }, error: null })
    },
    from: (table) => ({
      select: () => ({
        order: async () => {
          if (table === 'rooms') {
            return {
              data: [roomUpdateResult.room],
              error: null
            };
          }
          return { data: [], error: null };
        },
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { full_name: 'Nama Baru' }, error: null })
          }),
          single: async () => ({ data: roomUpdateResult.room, error: null }),
          maybeSingle: async () => ({ data: roomUpdateResult.room, error: null })
        })
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: async () => ({ data: { id: 'u-1', full_name: 'Nama Baru', role: adminPrivilege ? 'admin' : 'user' }, error: null }),
            maybeSingle: async () => ({ data: { id: 'u-1', full_name: 'Nama Baru', role: adminPrivilege ? 'admin' : 'user' }, error: null })
          })
        })
      })
    }),
    storage: {
      from: () => ({
        upload: async () => ({ data: { path: 'rooms/test.jpg' }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/room-images/rooms/test.jpg' } })
      })
    },
    channel: () => ({
      on() { return this; },
      subscribe() { return this; }
    }),
    rpc: async (name, params) => {
      rpcCalls.push({ name, params });
      if (name === 'get_room_schedule') {
        const d = new Date();
        const yyyy = d.getUTCFullYear();
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        return {
          data: [{
            reservation_id: 77,
            event_name: 'Rapat Tertutup User Lain',
            start_time: `${yyyy}-${mm}-${dd}T13:00:00+07:00`,
            end_time: `${yyyy}-${mm}-${dd}T15:00:00+07:00`,
            status: 'approved'
          }],
          error: null
        };
      }
      if (name === 'admin_update_room') {
        roomUpdateResult.room = {
          ...roomUpdateResult.room,
          name: params.p_name,
          capacity: params.p_capacity,
          floor: params.p_floor,
          facilities: (params.p_facilities || []).join(', ')
        };
        return { data: roomUpdateResult, error: null };
      }
      if (name === 'check_in_reservation_safe') {
        return { data: { success: true, reservation_id: params.p_reservation_id }, error: null };
      }
      if (name === 'complete_expired_reservations') {
        return { data: { success: true, completed_count: 1 }, error: null };
      }
      return { data: { success: true }, error: null };
    }
  };

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    FileReader: function() {},
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; }
    },
    navigator: {
      clipboard: { writeText: async () => {} }
    },
    window: {
      location: { hash: '#user/dashboard', origin: 'http://localhost:3000', pathname: '/', href: 'http://localhost:3000/' },
      addEventListener() {},
      scrollTo() {},
      print() {},
      supabaseClient: mockSupabaseClient
    },
    document: {
      readyState: 'complete',
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => [],
      querySelector: () => null,
      addEventListener() {}
    },
    alert() {},
    confirm: () => true
  };
  ctx.global = ctx;
  ctx.window.document = ctx.document;
  ctx.window.localStorage = ctx.localStorage;
  ctx.window.navigator = ctx.navigator;
  ctx.supabaseClient = mockSupabaseClient;

  vm.createContext(ctx);
  vm.runInContext(authCode, ctx);
  vm.runInContext(roomServiceCode, ctx);
  vm.runInContext(dataCode, ctx);
  vm.runInContext(appCode, ctx);

  // Sync window bindings on ctx
  ctx.window.AuthService = ctx.AuthService || ctx.window.AuthService;
  ctx.window.RoomService = ctx.RoomService || ctx.window.RoomService;

  return {
    ctx,
    elements,
    rpcCalls,
    setAdminPrivilege: (v) => { adminPrivilege = v; },
    store: ctx.window.RoomBookStore,
    app: ctx.window.RoomBookApp,
    auth: ctx.window.AuthService,
    roomService: ctx.window.RoomService
  };
}

(async () => {
  await test('1. index.html menghapus toolbar simulasi demo & SVG QR statis serta menambahkan modal baru', () => {
    assert(!indexHtml.includes('sim-controls-bar'), 'Toolbar simulasi harus sudah dihapus dari index.html');
    assert(!indexHtml.includes('Geometric QR-like aesthetic'), 'SVG QR statis harus dihapus');
    assert(indexHtml.includes('id="modal-qr-canvas-box"'), 'Harus ada kontainer QR live');
    assert(indexHtml.includes('id="forgot-password-modal"'), 'Harus ada modal Lupa Password');
    assert(indexHtml.includes('id="admin-checkin-modal"'), 'Harus ada modal Check-In Admin');
    assert(indexHtml.includes('id="edit-profile-modal"'), 'Harus ada modal Edit Profil');
    assert(indexHtml.includes('v=20261127_4'), 'Cache-busting script version harus ?v=20261127_4');
  });

  await test('2. supabase_migration_v4.sql mendefinisikan RPC complete_expired_reservations beserta GRANT authenticated', () => {
    assert(migrationV4Sql.includes('CREATE OR REPLACE FUNCTION public.complete_expired_reservations()'));
    assert(migrationV4Sql.includes('GRANT EXECUTE ON FUNCTION public.complete_expired_reservations() TO authenticated;'));
  });

  await test('3. AuthService.resetPassword dan updateProfileName bekerja dan memperbarui RoomBookStore', async () => {
    const h = createHarness();
    h.auth._currentUser = { id: 'u-1', email: 'user@kampus.ac.id', user_metadata: {} };
    h.auth._currentProfile = { id: 'u-1', full_name: 'Nama Lama', role: 'user' };

    const resetRes = await h.auth.resetPassword('user@kampus.ac.id');
    assert.strictEqual(resetRes.success, true);

    const updRes = await h.auth.updateProfileName('Nama Baru');
    assert.strictEqual(updRes.success, true);
    assert.strictEqual(h.store.currentUser.name, 'Nama Baru');
  });

  await test('4. Profil menyembunyikan tombol Ganti Portal Tampilan dari user biasa dan menghapus tombol Reset Demo', () => {
    const h = createHarness();
    h.store.currentRole = 'user';
    h.auth._currentProfile = { id: 'u-1', full_name: 'Civitas Biasa', role: 'user' };
    const htmlUser = h.app.renderProfilView();
    assert(!htmlUser.includes('Kembalikan Data Awal Demo'), 'Tombol Reset Demo harus dihapus');
    assert(!htmlUser.includes('Ganti Portal Tampilan'), 'User non-admin tidak boleh melihat switcher Admin');
    assert(htmlUser.includes('Ubah Nama Profil'), 'Harus ada tombol Edit Nama Profil');

    h.auth._currentProfile = { id: 'a-1', full_name: 'Admin Kampus', role: 'admin' };
    h.store.currentRole = 'admin';
    const htmlAdmin = h.app.renderProfilView();
    assert(htmlAdmin.includes('Ganti Portal Tampilan'), 'Admin asli tetap bisa beralih tampilan User/Admin');
  });

  await test('5. Status cancelled dan completed dirender di Dashboard, Riwayat, Detail Reservasi (+ audit log), dan Approval Admin', () => {
    const h = createHarness();
    h.store.currentUser = { id: 'u-1', name: 'Budi', dept: 'TI', initials: 'BD', email: 'budi@kampus.ac.id' };
    h.store.currentRole = 'user';
    h.store.reservations = [
      {
        id: 'RB-21',
        dbId: 21,
        userId: 'u-1',
        roomId: '1',
        roomName: 'Aula Utama',
        roomFloor: 'Lantai 3',
        roomCapacity: 50,
        roomImage: 'https://example.com/a.jpg',
        eventName: 'Seminar Selesai',
        purpose: 'Evaluasi',
        reservationDate: 'Hari Ini',
        timeString: '08:00 - 10:00 WIB',
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        participants: 20,
        applicantName: 'Budi',
        applicantDept: 'TI',
        applicantRole: 'Mahasiswa',
        applicantEmail: 'budi@kampus.ac.id',
        applicantInitials: 'BD',
        facilities: ['AC Central'],
        status: 'completed',
        historyLoaded: true,
        history: [{ action: 'Sesi Selesai', timestamp: '10:05 WIB', notes: 'Otomatis selesai' }],
        submittedAt: 'Kemarin'
      },
      {
        id: 'RB-22',
        dbId: 22,
        userId: 'u-1',
        roomId: '1',
        roomName: 'Aula Utama',
        roomFloor: 'Lantai 3',
        roomCapacity: 50,
        roomImage: 'https://example.com/a.jpg',
        eventName: 'Rapat Dibatalkan',
        purpose: 'Batal',
        reservationDate: 'Besok',
        timeString: '10:00 - 12:00 WIB',
        participants: 10,
        applicantName: 'Budi',
        applicantDept: 'TI',
        applicantRole: 'Mahasiswa',
        applicantEmail: 'budi@kampus.ac.id',
        applicantInitials: 'BD',
        facilities: [],
        status: 'cancelled',
        rejectionReason: 'Dibatalkan oleh pemohon.',
        historyLoaded: true,
        history: [],
        submittedAt: 'Kemarin'
      }
    ];

    const dashHtml = h.app.renderUserDashboardView();
    assert(dashHtml.includes('Selesai Digunakan'));

    h.app.activeUserHistoryFilter = 'completed';
    const riwayatCompleted = h.app.renderRiwayatView();
    assert(riwayatCompleted.includes('Seminar Selesai'));
    assert(!riwayatCompleted.includes('Rapat Dibatalkan'));

    h.app.activeUserHistoryFilter = 'cancelled';
    const riwayatCancelled = h.app.renderRiwayatView();
    assert(riwayatCancelled.includes('Rapat Dibatalkan'));

    h.store.dataSource = 'fallback';
    h.app.params = { id: 'RB-21' };
    const detailHtml = h.app.renderDetailReservasiView();
    assert(detailHtml.includes('Sesi Selesai') && detailHtml.includes('Otomatis selesai'), 'Detail harus merender riwayat audit database');

    h.app.activeAdminFilter = 'completed';
    const adminApprovalHtml = h.app.renderAdminApprovalView();
    assert(!adminApprovalHtml.includes('Siti Rahmawati'), 'Kartu demo Siti Rahmawati harus sudah dihapus');
    assert(adminApprovalHtml.includes('Seminar Selesai'), 'Tab Selesai Admin harus menampilkan reservasi completed');
  });

  await test('6. checkFormConflict mendeteksi bentrok dari RPC get_room_schedule & openQRPassModal merender QR live', async () => {
    const h = createHarness();
    h.store.rooms = [{ id: '1', dbId: 1, name: 'Ruang Senat', floor: 'Lantai 3', capacity: 30, facilities: [{ name: 'Proyektor', icon: 'videocam' }] }];
    h.store.selectedRoomId = '1';

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const todayIso = `${yyyy}-${mm}-${dd}`;

    h.elements['native-date-picker'].value = todayIso;
    h.elements['form-reservation-date'].value = `${dd}/${mm}/${yyyy}`;
    h.elements['form-reservation-date'].dataset.iso = todayIso;
    h.elements['form-time-start'].value = '13:30';
    h.elements['form-time-end'].value = '14:30';

    let bannerHidden = true;
    h.elements['conflict-banner'].classList = {
      add: (cls) => { if (cls === 'hidden') bannerHidden = true; },
      remove: (cls) => { if (cls === 'hidden') bannerHidden = false; }
    };

    await h.app.loadFormRoomSchedule(todayIso);
    assert.strictEqual(bannerHidden, false, 'Harus mendeteksi bentrok jadwal user lain dari RPC get_room_schedule');
    assert(h.elements['conflict-time-indicator'].textContent.includes('Rapat Tertutup User Lain'));

    // QR Code test (fallback / cached mode)
    h.store.dataSource = 'fallback';
    h.store.reservations = [{
      id: 'RB-12',
      dbId: 12,
      roomId: '1',
      roomName: 'Ruang Senat',
      reservationDate: todayIso,
      timeString: '09:00 - 11:00 WIB'
    }];
    await h.app.openQRPassModal('RB-12');
    assert.strictEqual(h.elements['modal-qr-payload'].textContent, 'ROOMBOOK-12-1');
    assert(h.elements['modal-qr-canvas-box'].innerHTML.includes('<svg'), 'QR modal harus merender matriks QR unik');
  });

  await test('7. Admin Dashboard menghitung okupansi mingguan riil tanpa teks statis Oktober & Check-in parsing ROOMBOOK-id-room', async () => {
    const h = createHarness();
    h.store.rooms = [{ id: '1', dbId: 1, name: 'Aula', floor: 'Lantai 3', capacity: 50, facilities: [] }];

    // Kosong -> 0%
    h.store.reservations = [];
    const emptyOcc = h.app.computeWeeklyOccupancy();
    assert.strictEqual(emptyOcc.avgPct, 0);

    // Senin minggu berjalan (WIB) -> okupansi > 0
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const jsDay = nowWib.getUTCDay();
    const diffToMon = jsDay === 0 ? -6 : 1 - jsDay;
    const monWib = Date.UTC(nowWib.getUTCFullYear(), nowWib.getUTCMonth(), nowWib.getUTCDate() + diffToMon, 3, 0, 0); // 10:00 WIB = 03:00 UTC
    h.store.reservations = [
      { id: 'RB-1', dbId: 1, status: 'approved', startTime: new Date(monWib).toISOString() },
      { id: 'RB-2', dbId: 2, status: 'completed', startTime: new Date(monWib + 3600 * 1000).toISOString() }
    ];
    const realOcc = h.app.computeWeeklyOccupancy();
    assert(realOcc.bars[0].pct > 0, 'Hari Senin harus mencatat okupansi riil > 0%');

    const adminDash = h.app.renderAdminDashboardView();
    assert(!adminDash.includes('Bulan Oktober Ini'), 'Label bulan statis Oktober harus hilang');
    assert(adminDash.includes('Check-In Tiket'), 'Harus ada tombol Check-In Tiket Admin');

    await h.store.checkInReservationSupabase('ROOMBOOK-12-3');
    const checkInRpc = h.rpcCalls.find(c => c.name === 'check_in_reservation_safe');
    assert(checkInRpc && checkInRpc.params.p_reservation_id === 12 && checkInRpc.params.p_qr_code === 'ROOMBOOK-12-3');
  });

  await test('8. Admin Edit Ruangan memperbarui ruangan melalui RPC admin_update_room tanpa wajib upload foto ulang', async () => {
    const h = createHarness();
    h.store.rooms = [{
      id: '1',
      dbId: 1,
      name: 'Ruang Rapat Lama',
      capacity: 20,
      floor: 'Lantai 2',
      facilities: [{ name: 'AC Central' }],
      image: 'https://example.supabase.co/storage/v1/object/public/room-images/rooms/old.jpg',
      thumbnail: 'https://example.supabase.co/storage/v1/object/public/room-images/rooms/old.jpg'
    }];

    h.app.startEditRoom('1');
    const editHtml = h.app.renderAdminTambahRuanganView();
    assert(editHtml.includes('Edit Ruangan: Ruang Rapat Lama'));
    assert(editHtml.includes('Simpan Perubahan Ruangan'));

    h.elements['admin-room-name'].value = 'Ruang Rapat Updated';
    h.elements['admin-room-floor'].value = 'Lantai 4';
    h.elements['admin-room-capacity'].value = '45';
    h.elements['admin-room-custom-facilities'].value = 'Audio Mixer';

    await h.app.handleAdminAddRoomSubmit();
    const updRpc = h.rpcCalls.find(c => c.name === 'admin_update_room');
    assert(updRpc, 'RPC admin_update_room harus dipanggil saat Edit Ruangan');
    assert.strictEqual(updRpc.params.p_name, 'Ruang Rapat Updated');
    assert.strictEqual(updRpc.params.p_capacity, 45);
    assert.strictEqual(h.app._editingRoomId, null, 'Mode edit harus tereset setelah selesai');
  });

  await test('9. Quick Filter Dashboard (openCatalogWithFilter) menyaring Katalog Ruangan di KetersediaanView', () => {
    const h = createHarness();
    h.store.isLoadingRooms = false;
    h.store.roomsError = null;
    h.store.rooms = [
      { id: '1', dbId: 1, name: 'Ruang Kecil', capacity: 8, floor: 'Lantai 1', facilities: [{ name: 'WiFi' }], image: '' },
      { id: '2', dbId: 2, name: 'Aula Lantai 3', capacity: 60, floor: 'Lantai 3', facilities: [{ name: 'Proyektor & Layar' }], image: '' }
    ];
    h.app.openCatalogWithFilter('floor3');
    h.store.isLoadingRooms = false;
    h.store.rooms = [
      { id: '1', dbId: 1, name: 'Ruang Kecil', capacity: 8, floor: 'Lantai 1', facilities: [{ name: 'WiFi' }], image: '' },
      { id: '2', dbId: 2, name: 'Aula Lantai 3', capacity: 60, floor: 'Lantai 3', facilities: [{ name: 'Proyektor & Layar' }], image: '' }
    ];
    const htmlFloor3 = h.app.renderKetersediaanView();
    assert(htmlFloor3.includes('Aula Lantai 3'), 'Harus menampilkan Aula Lantai 3');
    assert(!htmlFloor3.includes('Ruang Kecil'), 'Tidak boleh menampilkan Ruang Kecil pada filter floor3');

    h.app.openCatalogWithFilter('large');
    const htmlLarge = h.app.renderKetersediaanView();
    assert(htmlLarge.includes('Aula Lantai 3') && !htmlLarge.includes('Ruang Kecil'));
  });

  console.log(`\n========================================`);
  console.log(`📊 Hasil Pengujian Audit: ${passed} / ${passed + failed} Passed`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
})();
