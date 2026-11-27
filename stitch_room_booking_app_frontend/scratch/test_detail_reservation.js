/**
 * Test Suite: RoomBook Detail Reservasi Flow & ID Mapping Test
 * Memverifikasi:
 * 1. Pemetaan display ID (RB-3) ke database ID (bigint 3)
 * 2. Supabase query .eq('id', 3) bukan .eq('id', 'RB-3')
 * 3. Store getReservationById & fetchReservationById
 * 4. Error states: Not Found, Access Denied (RLS 42501), Network Error
 * 5. Penggabungan rooms, profiles, dan reservation_history
 * 6. Navigasi kembali ke riwayat
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Simulasikan environment browser minimal
global.window = {
  location: { hash: '#user/detail-reservasi/RB-3' },
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

// 2. Evaluasi data.js
const dataJsPath = path.resolve(__dirname, '../data.js');
const dataJsCode = fs.readFileSync(dataJsPath, 'utf8');
eval(dataJsCode);

const store = global.RoomBookStore || window.RoomBookStore;

console.log('🧪 [Test Suite] Memulai pengujian Detail Reservasi RoomBook...\n');

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
  // TEST 1: Pemetaan display ID 'RB-3' ke numeric 3
  runTest('Display ID "RB-3" diekstrak secara benar menjadi angka 3', () => {
    const rawId = 'RB-3';
    const cleanNum = rawId.replace(/\D/g, '');
    const numericId = parseInt(cleanNum, 10);
    assert.strictEqual(cleanNum, '3');
    assert.strictEqual(numericId, 3);
  });

  // TEST 2: getReservationById menemukan reservasi berbasis string 'RB-3', '3', atau angka 3
  runTest('Store getReservationById menemukan item dengan variasi ID (RB-3, 3, numeric 3)', () => {
    store.reservations = [
      {
        id: 'RB-3',
        dbId: 3,
        userId: 'user-123',
        roomName: 'Ruang Rapat Utama',
        eventName: 'Koordinasi Proyek',
        status: 'pending'
      }
    ];

    const byDisplayId = store.getCachedReservationById('RB-3');
    assert.ok(byDisplayId, 'Harus ditemukan dengan display ID RB-3');
    assert.strictEqual(byDisplayId.dbId, 3);

    const byStrId = store.getCachedReservationById('3');
    assert.ok(byStrId, 'Harus ditemukan dengan string numeric "3"');
    assert.strictEqual(byStrId.id, 'RB-3');

    const byNumId = store.getCachedReservationById(3);
    assert.ok(byNumId, 'Harus ditemukan dengan integer 3');
    assert.strictEqual(byNumId.id, 'RB-3');
  });

  // TEST 3: getReservationById fallback mencari demo item jika ID ada di fallback
  runTest('Store getReservationById mencari di fallbackReservations jika tidak di memory', () => {
    store.reservations = []; // kosong
    store.dataSource = 'fallback';
    const fallbackItem = store.getCachedReservationById('RB-892');
    assert.ok(fallbackItem, 'Item demo RB-892 harus ditemukan di fallback');
    assert.strictEqual(fallbackItem.id, 'RB-892');
  });

  // TEST 4: fetchReservationById dengan mock Supabase client
  await runAsyncTest('fetchReservationById memanggil query .eq("id", 3) dan menggabungkan history', async () => {
    let capturedEqColumn = null;
    let capturedEqValue = null;
    let capturedHistoryEqVal = null;

    store.reservations = [{ id: 'RB-3', dbId: 3, isFromDatabase: true }];
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-user-uuid' } } }, error: null };
        }
      },
      from(table) {
        if (table === 'reservations') {
          return {
            select(cols) {
              return {
                eq(column, val) {
                  capturedEqColumn = column;
                  capturedEqValue = val;
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          id: 3,
                          room_id: 1,
                          user_id: 'test-user-uuid',
                          event_name: 'Evaluasi Sistem',
                          purpose: 'Review berkala performa aplikasi',
                          start_time: '2026-10-24T02:00:00Z',
                          end_time: '2026-10-24T04:00:00Z',
                          participants: 12,
                          facilities: ['Proyektor & Kabel HDMI', 'Sound System'],
                          status: 'approved',
                          created_at: '2026-10-24T01:00:00Z',
                          rooms: {
                            id: 1,
                            name: 'Ruang Rapat Eksekutif',
                            capacity: 25,
                            facilities: ['Proyektor', 'WiFi'],
                            image_url: 'https://example.com/room.jpg'
                          },
                          profiles: {
                            id: 'test-user-uuid',
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
            select(cols) {
              return {
                eq(column, val) {
                  capturedHistoryEqVal = val;
                  return {
                    order() {
                      return Promise.resolve({
                        data: [
                          { id: 10, action: 'CREATED', notes: 'Pengajuan baru', created_at: '2026-10-24T01:00:00Z' },
                          { id: 11, action: 'APPROVED', notes: 'Disetujui oleh Kepala Biro', created_at: '2026-10-24T01:30:00Z' }
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

    store.dataSource = 'supabase';
    const result = await store.getReservationById('RB-3');

    assert.ok(result, 'Fetch harus sukses');
    assert.strictEqual(capturedEqColumn, 'id');
    assert.strictEqual(capturedEqValue, '3', 'Parameter query Supabase harus dbId dari mapping');
    assert.strictEqual(capturedHistoryEqVal, '3', 'Query history harus memakai primary key database');

    assert.strictEqual(result.id, 'RB-3');
    assert.strictEqual(result.dbId, 3);
    assert.strictEqual(result.roomName, 'Ruang Rapat Eksekutif');
    assert.strictEqual(result.applicantName, 'Budi Santoso');
    assert.strictEqual(result.status, 'approved');
    assert.strictEqual(result.participants, 12);
    assert.strictEqual(result.approvalNotes, 'Disetujui oleh Kepala Biro');
    assert.strictEqual(result.history.length, 2);

    // Pastikan tersimpan di memory store.reservations
    const fromMemory = store.getCachedReservationById('RB-3');
    assert.ok(fromMemory, 'Setelah fetch, data harus tersedia di store.reservations');
  });

  // TEST 5: fetchReservationById menangani 404 (Not Found)
  await runAsyncTest('fetchReservationById menangani kondisi record tidak ditemukan (404)', async () => {
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-user-uuid' } } }, error: null };
        }
      },
      from(table) {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    store.reservations = [];
    const result = await store.fetchReservationById('99999');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.notFound, true, 'Harus mengembalikan notFound: true');
    assert.ok(result.error.message.includes('99999'));
  });

  // TEST 6: fetchReservationById menangani 42501 (Akses Ditolak / RLS)
  await runAsyncTest('fetchReservationById menangani kondisi RLS Access Denied (42501)', async () => {
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-user-uuid' } } }, error: null };
        }
      },
      from(table) {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { 
                      data: null, 
                      error: { code: '42501', message: 'permission denied for table reservations' } 
                    };
                  }
                };
              }
            };
          }
        };
      }
    };

    const result = await store.fetchReservationById('5');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.accessDenied, true, 'Harus mengembalikan accessDenied: true');
    assert.strictEqual(result.error.code, '42501');
  });

  // TEST 7: fetchReservationById menangani Network Error
  await runAsyncTest('fetchReservationById menangani kegagalan koneksi jaringan', async () => {
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-user-uuid' } } }, error: null };
        }
      },
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: { message: 'Failed to fetch (NetworkError)' } };
                  }
                };
              }
            };
          }
        };
      }
    };

    const result = await store.fetchReservationById('6');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.accessDenied, undefined);
    assert.strictEqual(result.notFound, undefined);
    assert.ok(result.error.message.includes('NetworkError') || result.error.message.includes('Failed to fetch'));
  });

  // TEST 8: display ID tidak boleh dipakai sebagai database ID tanpa mapping
  await runAsyncTest('fetchReservationById tidak menebak primary key dari RB-6', async () => {
    let queryStarted = false;
    store.dataSource = 'supabase';
    store.reservations = [];
    window.supabaseClient = {
      from() {
        queryStarted = true;
        throw new Error('Query tidak boleh memakai angka dari display ID');
      }
    };

    const result = await store.fetchReservationById('RB-6');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.invalidId, true);
    assert.strictEqual(queryStarted, false);
  });

  // TEST 9b: numeric route is the canonical database primary key
  await runAsyncTest('fetchReservationById tidak mengganti PK route 8 dengan dbId cache yang berbeda', async () => {
    let queriedId = null;
    store.dataSource = 'supabase';
    store.reservations = [{ id: '8', dbId: 42, isFromDatabase: true }];
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: { user: { id: 'test-user-uuid' } } }, error: null };
        }
      },
      from(table) {
        if (table === 'reservation_history') {
          return {
            select() {
              return {
                eq() {
                  return {
                    order() {
                      return Promise.resolve({ data: [], error: null });
                    }
                  };
                }
              };
            }
          };
        }
        return {
          select() {
            return {
              eq(column, value) {
                if (table === 'reservations') queriedId = value;
                return {
                  async maybeSingle() {
                    return { data: { id: 8, room_id: 1, user_id: 'test-user-uuid' }, error: null };
                  }
                };
              }
            };
          }
        };
      }
    };

    const item = await store.getReservationById('8');
    assert.strictEqual(queriedId, '8');
    assert.strictEqual(String(item.dbId), '8');
  });

  // TEST 9: sesi yang hilang dibedakan dari record yang tidak ditemukan
  await runAsyncTest('fetchReservationById melaporkan sesi Supabase yang tidak tersedia', async () => {
    let queryStarted = false;
    store.reservations = [];
    window.supabaseClient = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        }
      },
      from() {
        queryStarted = true;
        throw new Error('Query tidak boleh berjalan tanpa sesi');
      }
    };

    const result = await store.fetchReservationById('42');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.authRequired, true);
    assert.strictEqual(result.notFound, undefined);
    assert.strictEqual(queryStarted, false);
  });

  // TEST 10: aksi admin juga memakai dbId dari record, bukan suffix label
  await runAsyncTest('updateReservationStatusSupabase mengirim dbId 42 untuk label RB-6', async () => {
    let rpcPayload = null;
    store.reservations = [{ id: 'RB-6', dbId: 42, isFromDatabase: true }];
    window.supabaseClient = {
      async rpc(name, payload) {
        assert.strictEqual(name, 'update_reservation_status_safe');
        rpcPayload = payload;
        return { data: { success: true }, error: null };
      }
    };

    await store.updateReservationStatusSupabase('RB-6', 'approved');
    assert.strictEqual(rpcPayload.p_reservation_id, '42');
  });

  // TEST 11: reload lama tidak boleh menimpa hasil reload yang lebih baru
  await runAsyncTest('loadReservationsFromDatabase mengabaikan respons list yang stale', async () => {
    const pendingResponses = [];
    store.dataSource = 'supabase';
    window.supabaseClient = {
      from() {
        return {
          select() {
            return {
              order() {
                return new Promise(resolve => pendingResponses.push(resolve));
              }
            };
          }
        };
      }
    };

    const oldRequest = store.loadReservationsFromDatabase();
    const latestRequest = store.loadReservationsFromDatabase();
    pendingResponses[1]({
      data: [{ id: 42, room_id: 1, user_id: 'test-user-uuid', start_time: '2026-10-26T02:00:00Z', end_time: '2026-10-26T04:00:00Z' }],
      error: null
    });
    const latestResult = await latestRequest;
    pendingResponses[0]({ data: [], error: null });
    const oldResult = await oldRequest;

    assert.strictEqual(latestResult.success, true);
    assert.strictEqual(oldResult.stale, true);
    assert.strictEqual(store.reservations.length, 1);
    assert.strictEqual(String(store.reservations[0].dbId), '42');
  });

  console.log(`\n========================================`);
  console.log(`📊 Hasil Pengujian: ${passedTests} / ${totalTests} Passed`);
  console.log(`========================================\n`);

  if (passedTests === totalTests) {
    console.log('🎉 SEMUA PENGUJIAN DETAIL RESERVASI BERHASIL!');
    process.exit(0);
  } else {
    console.error('❌ BEBERAPA PENGUJIAN GAGAL!');
    process.exit(1);
  }
})();
