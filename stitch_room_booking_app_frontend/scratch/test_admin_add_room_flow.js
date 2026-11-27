/**
 * Test Suite: Admin Tambah Ruangan (Upload Foto) & Sinkronisasi ke Akun User + Booking
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
    value: '',
    innerHTML: '',
    textContent: '',
    disabled: false,
    files: [],
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
  querySelectorAll(selector) {
    if (selector === '.admin-facility-chip') {
      return [
        {
          dataset: { label: 'AC Central' },
          querySelector: () => ({ checked: true })
        },
        {
          dataset: { label: 'WiFi High-Speed' },
          querySelector: () => ({ checked: true })
        }
      ];
    }
    return [];
  },
  querySelector() { return null; },
  addEventListener(event, fn) { listeners['doc:' + event] = fn; }
};

global.window = {
  location: { hash: '#login' },
  addEventListener() {},
  scrollTo() {},
  history: { length: 2 }
};

global.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

global.FileReader = class MockFileReader {
  readAsDataURL() {
    if (this.onload) {
      this.onload({ target: { result: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' } });
    }
  }
};

// Evaluasi roomService.js, data.js, dan app.js
eval(fs.readFileSync(path.resolve(__dirname, '../roomService.js'), 'utf8'));
eval(fs.readFileSync(path.resolve(__dirname, '../data.js'), 'utf8'));
const store = global.RoomBookStore || window.RoomBookStore;
store.loadReservationsFromDatabase = async () => ({ success: true, count: store.reservations.length });

eval(fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8'));
const app = global.RoomBookApp || window.RoomBookApp;

console.log('🧪 [Test Suite] Menguji Fitur Admin Tambah Ruangan & Alur Booking User...\n');

let passed = 0;
let total = 0;

function testSync(name, fn) {
  total++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ [FAIL] ${name}:`, e.message);
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ [FAIL] ${name}:`, e.message);
  }
}

(async () => {
  window.AuthService = {
    isAuthenticated: () => true,
    isAdmin: () => true
  };

  testSync('1. Admin Bottom Nav menghapus tab Ruangan dan menggantinya dengan Tambah Ruangan', () => {
    const navHtml = app.renderAdminBottomNav('tambah-ruangan');
    assert.ok(navHtml.includes('#admin/tambah-ruangan'), 'Nav harus mengarah ke #admin/tambah-ruangan');
    assert.ok(navHtml.includes('Tambah Ruangan'), 'Nav harus berlabel Tambah Ruangan');
    assert.ok(!navHtml.includes('#user/ketersediaan'), 'Nav admin tidak boleh lagi menuju #user/ketersediaan');
    assert.ok(!navHtml.includes('>Ruangan<'), 'Label lama Ruangan harus sudah dihapus');
  });

  testSync('2. Form Tambah Ruangan memakai upload file foto, bukan input URL', () => {
    const html = app.renderAdminTambahRuanganView();
    assert.ok(html.includes('type="file"'), 'Harus menyediakan input file upload foto');
    assert.ok(html.includes('accept="image/*"'), 'Harus menerima file gambar');
    assert.ok(!html.toLowerCase().includes('url foto'), 'Tidak boleh memakai input URL Foto Ruangan');
  });

  await testAsync('3. Admin upload foto + tambah ruangan tersimpan di Supabase & langsung tampil di User Dashboard + bisa dibooking', async () => {
    let dbRooms = [
      { id: 2, name: 'Ruang Rapat Utama', capacity: 20, floor: 'Lt. 3', facilities: 'AC Central, WiFi', image_url: 'https://example.com/2.jpg' },
      { id: 3, name: 'Auditorium Mini', capacity: 80, floor: 'Lt. 2', facilities: 'Sound System', image_url: 'https://example.com/3.jpg' },
      { id: 4, name: 'Ruang Diskusi B', capacity: 8, floor: 'Lt. 1', facilities: 'Whiteboard', image_url: 'https://example.com/4.jpg' },
      { id: 5, name: 'Ruang Kreatif A', capacity: 8, floor: 'Lt. 2', facilities: 'TV', image_url: 'https://example.com/5.jpg' }
    ];

    let capturedRpcPayload = null;
    window.supabaseClient = {
      storage: {
        from(bucket) {
          assert.strictEqual(bucket, 'room-images');
          return {
            async upload(filePath) {
              return { data: { path: filePath }, error: null };
            },
            getPublicUrl(filePath) {
              return { data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/room-images/${filePath}` } };
            }
          };
        }
      },
      async rpc(fnName, params) {
        if (fnName === 'admin_create_room') {
          capturedRpcPayload = params;
          const newRoom = {
            id: 99,
            name: params.p_name,
            capacity: params.p_capacity,
            floor: params.p_floor,
            facilities: params.p_facilities.join(', '),
            image_url: params.p_image_url,
            created_at: new Date().toISOString()
          };
          dbRooms.push(newRoom);
          return { data: { success: true, id: 99, room: newRoom }, error: null };
        }
        return { data: null, error: null };
      },
      from(table) {
        assert.strictEqual(table, 'rooms');
        return {
          select() {
            return {
              async order() {
                return { data: dbRooms, error: null };
              }
            };
          }
        };
      }
    };

    elements['admin-room-name'] = createMockElement('admin-room-name');
    elements['admin-room-name'].value = 'Ruang Inovasi Baru';
    elements['admin-room-floor'] = createMockElement('admin-room-floor');
    elements['admin-room-floor'].value = 'Lantai 4 • Sayap Utara';
    elements['admin-room-capacity'] = createMockElement('admin-room-capacity');
    elements['admin-room-capacity'].value = '30';
    elements['admin-room-custom-facilities'] = createMockElement('admin-room-custom-facilities');
    elements['admin-room-custom-facilities'].value = 'Smart TV 75"';

    app._pendingRoomPhotoFile = { name: 'ruangan-baru.jpg', size: 20480, type: 'image/jpeg' };
    app._pendingRoomPhotoPreview = 'data:image/jpeg;base64,/9j/4AAQ';

    await app.handleAdminAddRoomSubmit();

    assert.ok(capturedRpcPayload, 'RPC admin_create_room harus dipanggil');
    assert.strictEqual(capturedRpcPayload.p_name, 'Ruang Inovasi Baru');
    assert.strictEqual(capturedRpcPayload.p_capacity, 30);
    assert.strictEqual(capturedRpcPayload.p_floor, 'Lantai 4 • Sayap Utara');
    assert.ok(capturedRpcPayload.p_image_url.includes('room-images/rooms/'), 'Foto harus terupload ke Supabase Storage');

    // Simulasikan pindah ke akun User
    window.AuthService.isAdmin = () => false;
    store.currentRole = 'user';

    const userDashHtml = app.renderUserDashboardView();
    assert.ok(userDashHtml.includes('Ruang Inovasi Baru'), 'Ruangan baru harus langsung muncul di User Dashboard meskipun total > 3 ruangan');
    assert.ok(userDashHtml.includes('Lantai 4 • Sayap Utara'), 'Lantai ruangan baru harus tampil');

    const userCatalogHtml = app.renderKetersediaanView();
    assert.ok(userCatalogHtml.includes('Ruang Inovasi Baru'), 'Ruangan baru harus muncul di Ketersediaan User');

    // Verifikasi user bisa membuka form booking untuk ruangan baru tersebut
    app.startBooking('99');
    assert.strictEqual(store.selectedRoomId, '99');
    assert.strictEqual(app.resolveRoomDatabaseId('99'), 99, 'Database ID ruangan baru harus ter-resolve ke 99');

    const bookingFormHtml = app.renderFormReservasiView();
    assert.ok(bookingFormHtml.includes('Ruang Inovasi Baru'), 'Form reservasi user harus menampilkan ruangan baru');
    assert.ok(bookingFormHtml.includes('Kapasitas Maks. 30 Orang'), 'Kapasitas ruangan baru harus terbaca di form booking');
  });

  await testAsync('4. Fallback compressed image tetap berhasil jika Storage bucket belum siap', async () => {
    window.supabaseClient.storage = {
      from() {
        return {
          async upload() {
            return { data: null, error: { message: 'Bucket not found' } };
          }
        };
      }
    };

    const uploadRes = await window.RoomService.uploadRoomPhoto({ name: 'foto.jpg', size: 1024, type: 'image/jpeg' });
    assert.strictEqual(uploadRes.storageMode, 'embedded');
    assert.ok(uploadRes.url.startsWith('data:image/jpeg;base64,'));
  });

  await testAsync('5. Admin dapat menghapus ruangan & otomatis terhapus di akun User (termasuk cleanup Storage)', async () => {
    let dbRooms = [
      { id: 2, name: 'Ruang Rapat Utama', capacity: 20, floor: 'Lt. 3', facilities: 'AC Central', image_url: 'https://example.com/2.jpg' },
      { id: 99, name: 'Ruang Inovasi Baru', capacity: 30, floor: 'Lantai 4', facilities: 'AC, WiFi', image_url: 'https://example.supabase.co/storage/v1/object/public/room-images/rooms/room_99.jpg' }
    ];

    let deletedStoragePaths = [];
    let activeBookingBlocks = false;

    window.supabaseClient = {
      storage: {
        from(bucket) {
          assert.strictEqual(bucket, 'room-images');
          return {
            async remove(paths) {
              deletedStoragePaths.push(...paths);
              return { data: [], error: null };
            }
          };
        }
      },
      async rpc(fnName, params) {
        if (fnName === 'admin_delete_room') {
          if (activeBookingBlocks) {
            return {
              data: null,
              error: { code: '23503', message: 'Tidak dapat menghapus ruangan "Ruang Inovasi Baru": Masih ada jadwal reservasi aktif atau menunggu persetujuan.' }
            };
          }
          const idx = dbRooms.findIndex(r => r.id === params.p_room_id);
          const removed = dbRooms.splice(idx, 1)[0];
          return { data: { success: true, id: params.p_room_id, name: removed.name, image_url: removed.image_url }, error: null };
        }
        return { data: null, error: null };
      },
      from(table) {
        return {
          select() {
            return {
              async order() {
                if (table === 'rooms') return { data: dbRooms, error: null };
                return { data: [], error: null };
              }
            };
          }
        };
      }
    };

    await store.loadRoomsFromDatabase();
    const adminHtml = app.renderAdminTambahRuanganView();
    assert.ok(adminHtml.includes("openDeleteRoomModal('99')"), 'Harus menampilkan tombol Hapus pada daftar ruangan');

    // Simulasi proteksi jadwal aktif
    activeBookingBlocks = true;
    let blockedErr = null;
    try {
      await store.deleteRoomSupabase(99);
    } catch (e) {
      blockedErr = e;
    }
    assert.ok(blockedErr && blockedErr.code === '23503', 'Harus menolak hapus jika ada jadwal aktif');
    assert.strictEqual(store.getRooms().length, 2, 'Ruangan tidak boleh terhapus saat ada jadwal aktif');

    // Simulasi hapus berhasil saat tidak ada jadwal aktif
    activeBookingBlocks = false;
    app._targetDeleteRoomId = 99;
    await app.executeDeleteRoom();

    assert.strictEqual(store.getRooms().length, 1, 'Ruangan 99 harus terhapus dari Store');
    assert.deepStrictEqual(deletedStoragePaths, ['rooms/room_99.jpg'], 'Foto di Storage bucket harus ikut dibersihkan');

    // Verifikasi di sisi User ruangan 99 sudah hilang
    window.AuthService.isAdmin = () => false;
    store.currentRole = 'user';
    const userDashHtml = app.renderUserDashboardView();
    assert.ok(!userDashHtml.includes('Ruang Inovasi Baru'), 'Ruangan terhapus tidak boleh tampil lagi di User Dashboard');
    assert.ok(userDashHtml.includes('Ruang Rapat Utama'), 'Ruangan lain harus tetap tampil');
  });

  console.log(`\n========================================`);
  console.log(`📊 Hasil Pengujian: ${passed} / ${total} Passed`);
  console.log(`========================================`);
  if (passed !== total) process.exit(1);
})();
