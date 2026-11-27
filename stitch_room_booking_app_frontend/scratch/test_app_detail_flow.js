/**
 * Test Suite: App Detail Flow & UI State Transitions
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Setup mock DOM environment
const listeners = {};
const elements = {};

function createMockElement(id) {
  return {
    id: id,
    innerHTML: '',
    textContent: '',
    className: '',
    classList: {
      remove() {},
      add() {},
      contains() { return false; }
    },
    addEventListener(event, fn) {
      listeners[id + ':' + event] = fn;
    },
    dataset: {},
    style: {}
  };
}

global.document = {
  getElementById(id) {
    if (!elements[id]) {
      elements[id] = createMockElement(id);
    }
    return elements[id];
  },
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  },
  addEventListener(event, fn) {
    listeners['doc:' + event] = fn;
  }
};

global.window = {
  location: { hash: '#login' },
  addEventListener(event, fn) {
    listeners['win:' + event] = fn;
  },
  scrollTo() {},
  history: { length: 2 }
};

global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

// Evaluasi data.js
const dataJsPath = path.resolve(__dirname, '../data.js');
eval(fs.readFileSync(dataJsPath, 'utf8'));
const store = global.RoomBookStore || window.RoomBookStore;
store.loadReservationsFromDatabase = async () => ({ success: true, count: store.reservations.length });

// Evaluasi app.js
const appJsPath = path.resolve(__dirname, '../app.js');
eval(fs.readFileSync(appJsPath, 'utf8'));

const app = global.RoomBookApp || window.RoomBookApp;

console.log('🧪 [Test Suite] Menguji Alur Halaman Detail & Transisi UI di app.js...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

(async () => {
  // Mock auth service
  window.AuthService = {
    isAuthenticated: () => true,
    isAdmin: () => false
  };

  // TEST 1: Routing parsing untuk #user/detail-reservasi/RB-3
  runTest('handleRouting mem-parse route dan id RB-3 dengan benar', () => {
    const originalRender = app.render;
    app.render = () => {};
    window.location.hash = '#user/detail-reservasi/RB-3';
    app.handleRouting();
    app.render = originalRender;

    assert.strictEqual(app.currentRoute, 'user/detail-reservasi');
    assert.strictEqual(app.params.id, 'RB-3');
    assert.strictEqual(store.selectedReservationId, 'RB-3');
  });

  // TEST 2: Initial render menampilkan Loading State ketika item belum ada di memory
  runTest('renderDetailReservasiView menampilkan Loading Skeleton ketika item belum di-cache', () => {
    const originalLoader = app.loadDetailReservation;
    app.loadDetailReservation = () => {};
    store.reservations = []; // kosongkan memori
    app.detailReservationState = { id: null, status: 'idle' };

    const html = app.renderDetailReservasiView();
    app.loadDetailReservation = originalLoader;
    assert.ok(html.includes('Memuat Detail Reservasi...'), 'Harus berisi teks loading');
    assert.ok(html.includes('#RB-3'), 'Harus menampilkan ID tiket #RB-3');
    assert.ok(html.includes('animate-pulse'), 'Harus menggunakan class skeleton animate-pulse');
  });

  // TEST 2b: tanggal default WIB tidak bergantung zona waktu mesin browser
  runTest('parseScheduleToISO mempertahankan kalender WIB dan menolak tanggal kalender invalid', () => {
    const valid = app.parseScheduleToISO('2099-01-02', '09:30 WIB', '2099-01-02');
    assert.strictEqual(valid.isValid, true);
    assert.strictEqual(valid.iso, '2099-01-02T09:30:00+07:00');
    assert.strictEqual(valid.isoUtc, '2099-01-02T02:30:00.000Z');

    const invalid = app.parseScheduleToISO('2099-02-30', '09:30 WIB', '2099-02-30');
    assert.strictEqual(invalid.isValid, false, 'Tanggal yang dinormalisasi JavaScript tidak boleh diterima');
  });

  // TEST 2c: riwayat Supabase perlu disegarkan meskipun cache lokal berisi data
  runTest('renderRiwayatView meminta data Supabase baru saat memasuki halaman dengan cache terisi', () => {
    const originalLoader = store.loadReservationsFromDatabase;
    let loadCount = 0;
    store.dataSource = 'supabase';
    store.isLoadingReservations = false;
    store.reservations = [{ id: 'RB-3', dbId: 3, userId: 'test-uuid-99' }];
    app._riwayatInitialLoadDone = false;
    store.loadReservationsFromDatabase = () => { loadCount++; };

    app.renderRiwayatView();
    app.renderRiwayatView();

    store.loadReservationsFromDatabase = originalLoader;
    assert.strictEqual(loadCount, 1, 'Refresh hanya sekali per kunjungan halaman');
  });

  // TEST 3: label tiket tidak boleh dipakai sebagai primary key database
  await runAsyncTest('klik RB-6 membawa dbId 42 ke query detail dan mempertahankan label tiket', async () => {
    let queriedReservationId = null;
    const selectedReservation = {
      id: 'RB-6',
      dbId: 42,
      isFromDatabase: true,
      userId: 'test-uuid-99',
      roomName: 'Ruang Rapat Utama',
      eventName: 'Kick-off Proyek Semester 3',
      status: 'pending'
    };
    store.reservations = [selectedReservation];
    store.dataSource = 'supabase';

    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-uuid-99' } } }, error: null };
        }
      },
      from(table) {
        if (table === 'reservations') {
          return {
            select() {
              return {
                eq(col, val) {
                  queriedReservationId = val;
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          id: 42,
                          room_id: 1,
                          user_id: 'test-uuid-99',
                          event_name: 'Kick-off Proyek Semester 3',
                          purpose: 'Sinkronisasi deliverables dan arsitektur',
                          start_time: '2026-10-26T02:00:00Z',
                          end_time: '2026-10-26T04:00:00Z',
                          participants: 10,
                          facilities: ['Proyektor & Kabel HDMI', 'Microfon Wireless'],
                          status: 'pending',
                          created_at: '2026-10-24T01:00:00Z',
                          rooms: {
                            id: 1,
                            name: 'Ruang Rapat Utama',
                            capacity: 20,
                            facilities: ['Proyektor'],
                            image_url: 'https://example.com/main-room.jpg'
                          },
                          profiles: {
                            id: 'test-uuid-99',
                            full_name: 'Budi Santoso',
                            role: 'user'
                          }
                        },
                        error: null
                      };
                    }
                  };
                }
              };
            }
          };
        }
        if (table === 'reservation_history') {
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return Promise.resolve({
                        data: [
                          { id: 101, action: 'CREATED', notes: 'Diajukan', created_at: '2026-10-24T01:00:00Z' }
                        ],
                        error: null
                      });
                    }
                  };
                }
              };
            }
          };
        }
        return {};
      }
    };

    const cardHtml = app.renderHistoryCard(selectedReservation);
    assert.ok(cardHtml.includes("openReservationDetail('42')"), 'Klik riwayat harus membawa primary key 42');
    app.openReservationDetail(app.getReservationRouteId(selectedReservation));
    assert.strictEqual(window.location.hash, '#user/detail-reservasi/42');
    app.params = { id: '42' };
    app.detailReservationState = { id: null, status: 'idle' };
    app.currentRoute = 'user/detail-reservasi';
    const originalLoadDetail = app.loadDetailReservation;
    let detailLoadPromise = null;
    app.loadDetailReservation = function (id) {
      detailLoadPromise = originalLoadDetail.call(this, id);
    };
    const initialDetailHtml = app.renderDetailReservasiView();
    assert.ok(initialDetailHtml.includes('Memuat Detail Reservasi...'), 'Halaman harus memuat record DB terbaru, bukan langsung memakai cache');
    await detailLoadPromise;
    app.loadDetailReservation = originalLoadDetail;

    assert.strictEqual(queriedReservationId, '42', 'Query Supabase harus memakai dbId 42, bukan suffix tiket 6');
    assert.strictEqual(app.detailReservationState.status, 'success');

    const html = app.renderDetailReservasiView();
    assert.ok(html.includes('#RB-6'), 'Harus tetap menampilkan label #RB-6 dari record riwayat');
    assert.ok(html.includes('Kick-off Proyek Semester 3'), 'Harus menampilkan judul agenda');
    assert.ok(html.includes('Ruang Rapat Utama'), 'Harus menampilkan nama ruangan');
    assert.ok(html.includes('Menunggu Persetujuan'), 'Harus menampilkan badge status pending');
    assert.ok(html.includes('Proyektor & Kabel HDMI'), 'Harus menampilkan fasilitas');
    assert.ok(html.includes('Budi Santoso'), 'Harus menampilkan nama pemohon');
    assert.ok(html.includes('Kembali ke Riwayat Reservasi'), 'Harus memiliki tombol kembali ke riwayat');
  });

  // TEST 4: Navigasi tombol "Kembali ke Riwayat"
  runTest('Navigasi kembali ke riwayat tidak menghilangkan session dan mengubah route ke user/riwayat', () => {
    app.navigate('#user/riwayat');
    assert.strictEqual(window.location.hash, '#user/riwayat');
    app.handleRouting();
    assert.strictEqual(app.currentRoute, 'user/riwayat');
    assert.strictEqual(window.AuthService.isAuthenticated(), true, 'Session autentikasi harus tetap utuh');
  });

  // TEST 5: Admin route membawa primary key database
  runTest('Admin route detail tersinkronisasi memakai primary key database', () => {
    window.AuthService.isAdmin = () => true;
    const adminDetailItem = store.getCachedReservationById('42');
    adminDetailItem.id = 'RB-3';
    adminDetailItem.dbId = 3;
    store.reservations = [adminDetailItem];
    window.location.hash = '#admin/detail-pengajuan/3';
    const originalRender = app.render;
    app.render = () => {};
    app.handleRouting();
    app.render = originalRender;
    app.adminDetailPengajuanState = { id: '3', status: 'success', error: null };
    assert.strictEqual(app.currentRoute, 'admin/detail-pengajuan');
    assert.strictEqual(app.params.id, '3');
    assert.strictEqual(store.selectedReservationId, '3');
  });

  // TEST 6: Admin detail pengajuan merender record yang cocok dengan primary key
  runTest('renderAdminDetailPengajuanView merender detail dari record terpilih', () => {
    const html = app.renderAdminDetailPengajuanView();
    assert.ok(html.includes('Analisis Jadwal Pengajuan'), 'Harus merender header admin detail');
    assert.ok(html.includes('Ruang Rapat Utama'), 'Harus menampilkan nama ruangan');
    assert.ok(html.includes('Kick-off Proyek Semester 3'), 'Harus menampilkan agenda pemohon');
  });

  console.log(`\n========================================`);
  console.log(`📊 Hasil Pengujian: ${passedTests} / ${totalTests} Passed`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 SEMUA PENGUJIAN ALUR DAN UI DETAIL BERHASIL!');
    process.exit(0);
  } else {
    console.error('❌ BEBERAPA PENGUJIAN GAGAL!');
    process.exit(1);
  }
})();
