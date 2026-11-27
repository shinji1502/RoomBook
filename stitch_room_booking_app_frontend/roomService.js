// RoomService - Modul Layanan Data Ruangan Supabase
// Menghubungkan aplikasi ke tabel 'rooms' & Supabase Storage di database Supabase

(function () {
  'use strict';

  const ROOM_IMAGES_BUCKET = 'room-images';

  /**
   * Menentukan icon Material Symbols yang representatif berdasarkan nama fasilitas
   * @param {string} name
   * @returns {string} Material icon name
   */
  function getIconForFacility(name) {
    const lower = String(name || '').toLowerCase();
    if (lower.includes('wifi') || lower.includes('internet')) return 'wifi';
    if (lower.includes('ac') || lower.includes('pendingin') || lower.includes('air cond')) return 'ac_unit';
    if (lower.includes('proyektor') || lower.includes('projector') || lower.includes('display') || lower.includes('tv') || lower.includes('layar')) return 'tv';
    if (lower.includes('sound') || lower.includes('audio') || lower.includes('mic') || lower.includes('speaker')) return 'mic';
    if (lower.includes('whiteboard') || lower.includes('spidol') || lower.includes('papan')) return 'draw';
    if (lower.includes('sofa') || lower.includes('kursi') || lower.includes('chair')) return 'chair';
    if (lower.includes('kopi') || lower.includes('coffee') || lower.includes('minum')) return 'coffee';
    if (lower.includes('podium')) return 'mic';
    return 'check_circle';
  }

  /**
   * Mem-parsing kolom 'facilities' (tipe teks / JSON / array) menjadi format UI [{ name, desc, icon }]
   * @param {string|Array} raw
   * @returns {Array<{ name: string, desc: string, icon: string }>}
   */
  function parseFacilities(raw) {
    if (!raw) {
      return [{ name: 'Fasilitas Standar', desc: 'Tersedia di ruangan', icon: 'meeting_room' }];
    }

    // Jika sudah berupa array
    if (Array.isArray(raw)) {
      return raw.map(item => {
        if (typeof item === 'string') {
          return { name: item, desc: 'Tersedia', icon: getIconForFacility(item) };
        }
        return {
          name: item.name || 'Fasilitas',
          desc: item.desc || 'Tersedia',
          icon: item.icon || getIconForFacility(item.name)
        };
      });
    }

    // Jika berupa string JSON atau Postgres array literal "{A,B}"
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parseFacilities(parsed);
        } catch (e) {
          // Lanjut ke pemisahan teks koma
        }
      }

      const cleaned = (trimmed.startsWith('{') && trimmed.endsWith('}'))
        ? trimmed.slice(1, -1).replace(/"/g, '')
        : trimmed;

      // String dipisahkan koma, titik koma, atau baris baru
      const items = cleaned.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      if (items.length > 0) {
        return items.map(name => ({
          name: name,
          desc: 'Tersedia di ruangan',
          icon: getIconForFacility(name)
        }));
      }
    }

    return [{ name: String(raw), desc: 'Tersedia', icon: 'meeting_room' }];
  }

  /**
   * Memetakan baris database tabel 'rooms' ke skema objek ruangan yang digunakan UI RoomBook
   * @param {Object} dbRoom
   * @returns {Object} UI Room Object
   */
  function mapRoomRecord(dbRoom) {
    if (!dbRoom) return null;

    const cap = Number(dbRoom.capacity) || 10;
    const facilitiesList = parseFacilities(dbRoom.facilities);

    // Fallback foto representatif jika image_url kosong
    const defaultImage = 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80';
    const roomImage = dbRoom.image_url || defaultImage;

    // Gunakan kolom floor dari database jika ada, fallback ke klasifikasi kapasitas
    const floor = (dbRoom.floor && String(dbRoom.floor).trim())
      ? String(dbRoom.floor).trim()
      : (cap >= 50 ? 'Lt. 2' : (cap >= 20 ? 'Lt. 3' : 'Lt. 1'));
    const roomType = cap >= 50 ? 'Auditorium Hall' : (cap >= 20 ? 'Tipe Eksekutif' : 'Ruang Diskusi / Rapat');
    const location = floor.toLowerCase().includes('gedung') ? floor : `Gedung Utama, ${floor}`;

    const facilitiesSummary = facilitiesList.slice(0, 3).map(f => f.name).join(', ');

    return {
      id: String(dbRoom.id), // String untuk kompatibilitas hash router & selector
      dbId: dbRoom.id,
      name: dbRoom.name || 'Ruangan Tanpa Nama',
      floor: floor,
      location: location,
      type: roomType,
      capacity: cap,
      rating: 4.8,
      description: `Ruangan ${dbRoom.name} dengan kapasitas ${cap} orang. Dilengkapi fasilitas pendukung ${facilitiesSummary || 'standar'} untuk kelancaran rapat dan kegiatan institusi.`,
      image: roomImage,
      thumbnail: roomImage,
      availabilityStatus: 'Tersedia Sekarang',
      availableUntil: 'Sepanjang Hari',
      shortNote: `Kapasitas ${cap} orang • ${facilitiesSummary || 'Fasilitas lengkap'}`,
      facilities: facilitiesList,
      scheduleToday: [],
      isFromDatabase: true,
      created_at: dbRoom.created_at
    };
  }

  /**
   * Mengompres foto yang diupload dari perangkat ke ukuran optimal (maks 1000px JPEG)
   * @param {File} file
   * @returns {Promise<{ blob: Blob, dataUrl: string }>}
   */
  function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('File gambar tidak ditemukan.'));
        return;
      }
      if (!String(file.type || '').startsWith('image/')) {
        reject(new Error('File yang dipilih harus berupa gambar (JPG, PNG, WEBP).'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca file gambar dari perangkat.'));
      reader.onload = (e) => {
        const rawDataUrl = e.target.result;
        if (typeof document === 'undefined' || typeof Image === 'undefined') {
          resolve({ blob: file, dataUrl: rawDataUrl });
          return;
        }

        const img = new Image();
        img.onerror = () => reject(new Error('Format gambar tidak dapat diproses oleh browser.'));
        img.onload = () => {
          const maxDim = 1000;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width >= height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          if (typeof canvas.toBlob === 'function') {
            canvas.toBlob((blob) => {
              resolve({ blob: blob || file, dataUrl: compressedDataUrl });
            }, 'image/jpeg', 0.82);
          } else {
            resolve({ blob: file, dataUrl: compressedDataUrl });
          }
        };
        img.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * Mengupload foto ruangan ke Supabase Storage ('room-images'),
   * dengan fallback aman ke compressed Data URL jika bucket Storage belum dibuat.
   * @param {File} file
   * @returns {Promise<{ url: string, storageMode: string }>}
   */
  async function uploadRoomPhoto(file) {
    const client = window.supabaseClient;
    if (!client) {
      throw new Error('Client Supabase belum diinisialisasi.');
    }

    const { blob, dataUrl } = await compressImageFile(file);
    const fileName = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const filePath = `rooms/${fileName}`;

    try {
      if (client.storage && typeof client.storage.from === 'function') {
        const { error: uploadError } = await client.storage
          .from(ROOM_IMAGES_BUCKET)
          .upload(filePath, blob, {
            contentType: 'image/jpeg',
            upsert: false
          });

        if (!uploadError) {
          const { data: pubData } = client.storage
            .from(ROOM_IMAGES_BUCKET)
            .getPublicUrl(filePath);

          if (pubData && pubData.publicUrl) {
            console.log('✅ [RoomService] Foto ruangan berhasil diupload ke Storage:', pubData.publicUrl);
            return { url: pubData.publicUrl, storageMode: 'storage' };
          }
        } else {
          console.warn('⚠️ [RoomService] Upload ke Storage bucket gagal, beralih ke gambar terkompresi:', uploadError.message);
        }
      }
    } catch (storageErr) {
      console.warn('⚠️ [RoomService] Pengecualian Storage upload, beralih ke gambar terkompresi:', storageErr);
    }

    return { url: dataUrl, storageMode: 'embedded' };
  }

  /**
   * Menambahkan ruangan baru via Supabase RPC admin_create_room
   * @param {Object} params - { name, capacity, floor, facilities, imageFile }
   */
  async function createRoom({ name, capacity, floor, facilities, imageFile }) {
    const client = window.supabaseClient;
    if (!client) {
      return { data: null, error: new Error('Client Supabase belum diinisialisasi.') };
    }

    const cleanName = String(name || '').trim();
    const numericCap = parseInt(capacity, 10);
    const cleanFloor = String(floor || '').trim() || 'Lantai 1';
    const cleanFacilities = Array.isArray(facilities)
      ? facilities.map(f => String(f).trim()).filter(Boolean)
      : [];

    if (!cleanName) {
      return { data: null, error: new Error('Nama ruangan wajib diisi.') };
    }
    if (isNaN(numericCap) || numericCap <= 0) {
      return { data: null, error: new Error('Kapasitas ruangan harus berupa angka lebih dari 0.') };
    }
    if (!imageFile) {
      return { data: null, error: new Error('Foto ruangan wajib diupload terlebih dahulu.') };
    }

    try {
      // 1. Upload foto ruangan
      const uploadRes = await uploadRoomPhoto(imageFile);

      // 2. Simpan data ruangan ke database melalui RPC admin_create_room
      const payload = {
        p_name: cleanName,
        p_capacity: numericCap,
        p_floor: cleanFloor,
        p_facilities: cleanFacilities,
        p_image_url: uploadRes.url
      };

      console.log('🚀 [RoomService] Memanggil RPC admin_create_room...', { ...payload, p_image_url: uploadRes.storageMode === 'embedded' ? '[embedded_jpeg]' : uploadRes.url });
      const { data, error } = await client.rpc('admin_create_room', payload);

      if (error) {
        console.error('❌ [RoomService] RPC admin_create_room gagal:', error);
        return { data: null, error };
      }

      console.log('✅ [RoomService] Ruangan baru tersimpan di database:', data);
      return { data, error: null, storageMode: uploadRes.storageMode };
    } catch (err) {
      console.error('❌ [RoomService] Unexpected error on createRoom:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Mengambil semua data ruangan dari database Supabase
   * Menggunakan query: supabase.from('rooms').select('*')
   * @returns {Promise<{ data: Array<Object>, error: Object|null }>}
   */
  async function fetchRooms() {
    const client = window.supabaseClient;
    if (!client) {
      const err = new Error('Client Supabase belum diinisialisasi. Periksa konfigurasi supabaseClient.js.');
      console.error('[RoomService]', err.message);
      return { data: [], error: err };
    }

    try {
      console.log('📡 [RoomService] Membaca data dari tabel Supabase "rooms"...');
      const { data, error } = await client
        .from('rooms')
        .select('*')
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ [RoomService] Supabase error:', error.message, error);
        return { data: [], error };
      }

      console.log(`✅ [RoomService] Berhasil membaca ${data ? data.length : 0} baris dari Supabase rooms.`);
      const mappedRooms = (data || []).map(mapRoomRecord);
      return { data: mappedRooms, error: null };
    } catch (err) {
      console.error('❌ [RoomService] Network/Unexpected error:', err);
      return { data: [], error: err };
    }
  }

  /**
   * Mengambil satu data ruangan berdasarkan id dari Supabase
   * @param {string|number} id
   * @returns {Promise<{ data: Object|null, error: Object|null }>}
   */
  async function fetchRoomById(id) {
    const client = window.supabaseClient;
    if (!client) {
      return { data: null, error: new Error('Client Supabase belum diinisialisasi.') };
    }

    try {
      const { data, error } = await client
        .from('rooms')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return { data: null, error };
      return { data: data ? mapRoomRecord(data) : null, error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  /**
   * Mengekstrak path objek Storage dari URL publik Supabase Storage bucket room-images
   * @param {string} url
   * @returns {string|null}
   */
  function extractStoragePathFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const marker = `/storage/v1/object/public/${ROOM_IMAGES_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  }

  /**
   * Menghapus ruangan via RPC admin_delete_room beserta file fotonya di Storage (jika ada)
   * @param {string|number} roomId
   */
  async function deleteRoom(roomId) {
    const client = window.supabaseClient;
    if (!client) {
      return { data: null, error: new Error('Client Supabase belum diinisialisasi.') };
    }

    const numericId = parseInt(roomId, 10);
    if (isNaN(numericId) || numericId <= 0) {
      return { data: null, error: new Error(`ID ruangan (${roomId}) tidak valid.`) };
    }

    try {
      console.log('🗑️ [RoomService] Memanggil RPC admin_delete_room untuk ID:', numericId);
      const { data, error } = await client.rpc('admin_delete_room', {
        p_room_id: numericId
      });

      if (error) {
        console.error('❌ [RoomService] RPC admin_delete_room gagal:', error);
        return { data: null, error };
      }

      // Bersihkan file foto di Storage bucket jika berasal dari Supabase Storage
      const storagePath = extractStoragePathFromUrl(data && data.image_url);
      if (storagePath && client.storage && typeof client.storage.from === 'function') {
        try {
          await client.storage.from(ROOM_IMAGES_BUCKET).remove([storagePath]);
        } catch (storageErr) {
          console.warn('⚠️ [RoomService] Gagal membersihkan file foto di Storage:', storageErr);
        }
      }

      console.log('✅ [RoomService] Ruangan berhasil dihapus:', data);
      return { data, error: null };
    } catch (err) {
      console.error('❌ [RoomService] Unexpected error on deleteRoom:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Memperbarui data ruangan via Supabase RPC admin_update_room
   * @param {Object} params - { roomId, name, capacity, floor, facilities, imageFile }
   */
  async function updateRoom({ roomId, name, capacity, floor, facilities, imageFile }) {
    const client = window.supabaseClient;
    if (!client) {
      return { data: null, error: new Error('Client Supabase belum diinisialisasi.') };
    }

    const numericId = parseInt(roomId, 10);
    const cleanName = String(name || '').trim();
    const numericCap = parseInt(capacity, 10);
    const cleanFloor = String(floor || '').trim() || 'Lantai 1';
    const cleanFacilities = Array.isArray(facilities)
      ? facilities.map(f => String(f).trim()).filter(Boolean)
      : [];

    if (isNaN(numericId) || numericId <= 0) {
      return { data: null, error: new Error('ID ruangan tidak valid.') };
    }
    if (!cleanName) {
      return { data: null, error: new Error('Nama ruangan wajib diisi.') };
    }
    if (isNaN(numericCap) || numericCap <= 0) {
      return { data: null, error: new Error('Kapasitas ruangan harus berupa angka lebih dari 0.') };
    }

    try {
      let imageUrl = null;
      let storageMode = 'unchanged';
      if (imageFile) {
        const uploadRes = await uploadRoomPhoto(imageFile);
        imageUrl = uploadRes.url;
        storageMode = uploadRes.storageMode;
      }

      const payload = {
        p_room_id: numericId,
        p_name: cleanName,
        p_capacity: numericCap,
        p_floor: cleanFloor,
        p_facilities: cleanFacilities,
        p_image_url: imageUrl
      };

      const { data, error } = await client.rpc('admin_update_room', payload);
      if (error) {
        console.error('❌ [RoomService] RPC admin_update_room gagal:', error);
        return { data: null, error };
      }

      return { data, error: null, storageMode };
    } catch (err) {
      console.error('❌ [RoomService] Unexpected error on updateRoom:', err);
      return { data: null, error: err };
    }
  }

  /**
   * Mengambil jadwal terisi ruangan pada tanggal tertentu via RPC get_room_schedule
   * @param {string|number} roomId
   * @param {string} isoDate - YYYY-MM-DD
   */
  async function fetchRoomSchedule(roomId, isoDate) {
    const client = window.supabaseClient;
    const numericId = parseInt(roomId, 10);
    if (!client || isNaN(numericId) || numericId <= 0 || !isoDate) {
      return { data: [], error: null };
    }

    try {
      const { data, error } = await client.rpc('get_room_schedule', {
        p_room_id: numericId,
        p_date: isoDate
      });
      if (error) {
        return { data: [], error };
      }
      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (err) {
      return { data: [], error: err };
    }
  }

  // Ekspor service ke global window
  window.RoomService = {
    fetchRooms,
    fetchRoomById,
    fetchRoomSchedule,
    createRoom,
    updateRoom,
    deleteRoom,
    uploadRoomPhoto,
    compressImageFile,
    mapRoomRecord,
    parseFacilities,
    getIconForFacility
  };
})();
