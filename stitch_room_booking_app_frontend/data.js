// RoomBook Dummy Data & State Store
// Design system compliant with room_booking_app_design_system/DESIGN.md

const INITIAL_ROOMS = [
  {
    id: 'ruang-rapat-utama',
    name: 'Ruang Rapat Utama',
    floor: 'Lt. 3',
    location: 'Gedung Rektorat Baru, Lantai 3, Sayap Barat',
    type: 'Tipe Eksekutif',
    capacity: 20,
    rating: 4.9,
    description: 'Ruang rapat modern berstandar eksekutif yang didesain khusus untuk rapat pimpinan, presentasi klien penting, dan koordinasi strategis tim. Dilengkapi pencahayaan alami dan insulasi suara kedap akustik tinggi.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDgreoNeoNPVJTdXK-G3awFT456hWn1fPhT63aRjnwb6qjQJB--ntOiKzR9GMNh2-0M3gt-PNEIb1Ss3WsQSpZcZAiKDbCQevwwfgcj6a--xwlWSBLZpNbVrkzrnS9ctzMhGSqyxWhDPaXHBP1ANlhiEvA-QgoWiZYfIJMbudzn13iQseJh0HvMd28dq2LveUscD_Y8VsSyvfyBWDQ2tvWDfZfxDFwChBgNUlENEfy',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANFlmwj0PU4yY92-2XDRRFg5k2PVh2cVvAa9f7g_9zpqkWsKLuI6TgBjVtFzMbbznCKwmMKkWG7QrCxv3eebVicDafD9JjNaOoZjlSYwK9I_6x_jucV67pjk5JzRd_BJcEqhL_aoFXqJjkK17ei_2H-WOssGFfdE0Xw9ZvrPAgyDo2mnRs1EssOkwzEjlmSFx8fzdwzC3hP7x4-zBfvV-BNZNzGe4oXL2lQGKFMJZq',
    availabilityStatus: 'Tersedia Sekarang',
    availableUntil: 'Hingga 15:00 WIB',
    shortNote: 'Ideal untuk presentasi direksi & rapat divisi lintas fungsi.',
    facilities: [
      { name: 'AC Central', desc: 'Suhu otomatis', icon: 'ac_unit' },
      { name: 'WiFi High-Speed', desc: 'Dedicated 100 Mbps', icon: 'wifi' },
      { name: 'Smart Display 75"', desc: '4K UHD Wireless', icon: 'tv' },
      { name: 'Proyektor Laser', desc: 'Layar Otomatis', icon: 'videocam' },
      { name: 'Sound System', desc: 'Mic Meja Konferensi', icon: 'mic' },
      { name: 'Whiteboard', desc: 'Spidol & Penghapus', icon: 'draw' }
    ],
    scheduleToday: [
      { time: '08:00 - 10:00', title: 'Tersedia untuk Booking', status: 'available', label: 'Kosong' },
      { time: '10:00 - 12:00', title: 'Monthly Sync Divisi Produk', status: 'booked', label: 'Terisi' },
      { time: '12:00 - 13:00', title: 'Jeda Pembersihan & Istirahat', status: 'break', label: 'Istirahat' },
      { time: '13:00 - 17:00', title: 'Slot Siang - Sore Panjang', status: 'available', label: 'Kosong' }
    ]
  },
  {
    id: 'auditorium-mini',
    name: 'Auditorium Mini',
    floor: 'Lt. 2',
    location: 'Gedung Rektorat Baru, Lantai 2',
    type: 'Auditorium Hall',
    capacity: 80,
    rating: 4.8,
    description: 'Dirancang untuk seminar berkala, all-hands meeting, workshop lintas fakultas/departemen, dan konferensi dengan kapasitas besar.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnZI5LqQ-bs416NVJHPGWLGs9Rpzij3IMZrEPeK1prB6yJlyFV4DxRKyDk8FjiJraf3WQkXUcknmcR2BhBn-AVptwoUzX5_XHdxkHhpzRXvqZMwYfNhQKc4H_KRZAMJsnO5BFTdxwsxa-_Mol6q_1n3sueLTIrir_gJE95pGD9I4JCu89wQdJmubBInh-v3KR3qPxgvSYLd7p6B57plEr8q2zSr3xd5r8PK2Xksu4l',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnZI5LqQ-bs416NVJHPGWLGs9Rpzij3IMZrEPeK1prB6yJlyFV4DxRKyDk8FjiJraf3WQkXUcknmcR2BhBn-AVptwoUzX5_XHdxkHhpzRXvqZMwYfNhQKc4H_KRZAMJsnO5BFTdxwsxa-_Mol6q_1n3sueLTIrir_gJE95pGD9I4JCu89wQdJmubBInh-v3KR3qPxgvSYLd7p6B57plEr8q2zSr3xd5r8PK2Xksu4l',
    availabilityStatus: 'Tersedia Pukul 13:00',
    availableUntil: '13:00 - 18:00 WIB',
    shortNote: 'Dirancang untuk seminar berkala, all-hands meeting, dan workshop.',
    facilities: [
      { name: 'Sound System', desc: 'Audio Panggung Digital', icon: 'volume_up' },
      { name: 'Proyektor 4K', desc: 'Dual Proyektor Cinema', icon: 'videocam' },
      { name: 'Podium', desc: 'Podium Presenter Interaktif', icon: 'mic' },
      { name: 'AC Central', desc: 'Double blower pendingin', icon: 'ac_unit' }
    ],
    scheduleToday: [
      { time: '08:00 - 12:00', title: 'Seminar Akademik', status: 'booked', label: 'Terisi' },
      { time: '12:00 - 13:00', title: 'Istirahat & Sterilisasi', status: 'break', label: 'Istirahat' },
      { time: '13:00 - 18:00', title: 'Tersedia untuk Booking', status: 'available', label: 'Kosong' }
    ]
  },
  {
    id: 'ruang-diskusi-b',
    name: 'Ruang Diskusi B',
    floor: 'Lt. 1',
    location: 'Gedung Inovasi & Riset, Lantai 1',
    type: 'Ruang Huddle / Diskusi',
    capacity: 8,
    rating: 4.7,
    description: 'Cocok untuk sprint planning harian, one-on-one session, diskusi tim taktis, dan kolaborasi terfokus.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2qJWnIv5GpA_MPW6dTEee-c84FhenwxEn48Az5BvmKAU4VQc0o2cOs_cs6lbT78iVlHJF96DQOsEWlN97tRoltmflRZmP9_9ab-Uqz76D7Yx4g1Jp5HAgPvrPrBO_ovf0MtLRUAKfnwDfn_Lgtw6P_32s_wXtmEafVgMycFdlio32aANnucJG2h12gLYjdNZuLjEPlFr9Dra3v2EGqutS-rizpEwgPnqWPyHAOgQA',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2qJWnIv5GpA_MPW6dTEee-c84FhenwxEn48Az5BvmKAU4VQc0o2cOs_cs6lbT78iVlHJF96DQOsEWlN97tRoltmflRZmP9_9ab-Uqz76D7Yx4g1Jp5HAgPvrPrBO_ovf0MtLRUAKfnwDfn_Lgtw6P_32s_wXtmEafVgMycFdlio32aANnucJG2h12gLYjdNZuLjEPlFr9Dra3v2EGqutS-rizpEwgPnqWPyHAOgQA',
    availabilityStatus: 'Tersedia Sekarang',
    availableUntil: 'Sepanjang Hari',
    shortNote: 'Cocok untuk sprint planning harian dan one-on-one session.',
    facilities: [
      { name: 'Whiteboard', desc: 'Papan Tulis Kaca Luas', icon: 'draw' },
      { name: 'Display TV', desc: '55" Wireless Casting', icon: 'tv' },
      { name: 'WiFi Cepat', desc: 'Koneksi Stabil', icon: 'wifi' }
    ],
    scheduleToday: [
      { time: '08:00 - 18:00', title: 'Tersedia Bebas', status: 'available', label: 'Kosong' }
    ]
  },
  {
    id: 'ruang-kreatif-a',
    name: 'Ruang Kreatif A',
    floor: 'Lt. 2',
    location: 'Gedung Lab Multimedia, Lantai 2',
    type: 'Design Lab',
    capacity: 8,
    rating: 4.8,
    description: 'Ruang brainstorming ergonomis yang dilengkapi perlengkapan design sprint dan papan moodboard.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcfd015si-MuWQzcZ4F7zWTkdUA942l-vkVrVkFrJwVIZLUN9uJpMTXxA1ejouw3K4ODcKnTsU71VpyIXCmnycxhaOUsTmsZCs1dvtll3fzpA8wz01BMGzuQahDnRsUvVBWtcUe_9IXQ7pTHVES5USXuGlQHegfgzGsPbNVAltalFn5M_KrGvHpVXkCgXQc0YImPe41D5gd2uFUDwSzk8_uZcJYCUtS5kLp2McKyC7',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcfd015si-MuWQzcZ4F7zWTkdUA942l-vkVrVkFrJwVIZLUN9uJpMTXxA1ejouw3K4ODcKnTsU71VpyIXCmnycxhaOUsTmsZCs1dvtll3fzpA8wz01BMGzuQahDnRsUvVBWtcUe_9IXQ7pTHVES5USXuGlQHegfgzGsPbNVAltalFn5M_KrGvHpVXkCgXQc0YImPe41D5gd2uFUDwSzk8_uZcJYCUtS5kLp2McKyC7',
    availabilityStatus: 'Siap Dipesan',
    availableUntil: 'Hingga 17:00 WIB',
    shortNote: 'Ruang kolaboratif khusus tim kreatif dan desainer produk.',
    facilities: [
      { name: 'Display Panel 65"', desc: '4K Touchscreen', icon: 'tv' },
      { name: 'Whiteboard Kaca', desc: 'Marker 6 Warna', icon: 'draw' },
      { name: 'WiFi High-Speed', desc: '100 Mbps', icon: 'wifi' }
    ],
    scheduleToday: [
      { time: '08:00 - 17:00', title: 'Tersedia untuk Booking', status: 'available', label: 'Kosong' }
    ]
  },
  {
    id: 'executive-lounge',
    name: 'Executive Lounge',
    floor: 'Lt. 4',
    location: 'Gedung Rektorat Baru, Lantai 4 Penthouse',
    type: 'VIP Lounge',
    capacity: 20,
    rating: 5.0,
    description: 'Ruang pertemuan VIP mewah untuk tamu institusi, mitra korporat, dan audiensi pimpinan tingkat rektorat.',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgle5ojnuDXzXwOVkslryv43dKMkuE6sUxeQj71rdw4zHfjJPnGPeWiiUWsdIoQQXUptA4uUgQ_L6OG9h_Z-tF04ozvn2zHeLVEjKe36JQedpfc0cAw63nL49JzAPlipx9oiPfUzYTQgIch3eJxRKJH2iBZk82TFpBpNOUDVC_CnEqAIMz64mKHCKNkTnOBT5Q2N2kqUd7lotdRwUmIaWqxCv2MNQ25UYrwdubGsFj',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBgle5ojnuDXzXwOVkslryv43dKMkuE6sUxeQj71rdw4zHfjJPnGPeWiiUWsdIoQQXUptA4uUgQ_L6OG9h_Z-tF04ozvn2zHeLVEjKe36JQedpfc0cAw63nL49JzAPlipx9oiPfUzYTQgIch3eJxRKJH2iBZk82TFpBpNOUDVC_CnEqAIMz64mKHCKNkTnOBT5Q2N2kqUd7lotdRwUmIaWqxCv2MNQ25UYrwdubGsFj',
    availabilityStatus: 'Siap Dipesan',
    availableUntil: 'Pemesanan Khusus',
    shortNote: 'Lounge eksklusif perjamuan & koordinasi tingkat tinggi.',
    facilities: [
      { name: 'Smart Display 85"', desc: 'Wireless 8K HDR', icon: 'tv' },
      { name: 'High-end Audio', desc: 'JBL Conference System', icon: 'mic' },
      { name: 'Sofa Eksekutif', desc: 'Nyaman & Privat', icon: 'chair' },
      { name: 'Coffee Station', desc: 'Mesin Espresso Lengkap', icon: 'coffee' }
    ],
    scheduleToday: [
      { time: '09:00 - 18:00', title: 'Tersedia dengan Persetujuan Khusus', status: 'available', label: 'Kosong' }
    ]
  }
];

const INITIAL_RESERVATIONS = [
  {
    id: 'RB-892',
    roomId: 'ruang-rapat-utama',
    roomName: 'Ruang Rapat Utama',
    roomFloor: 'Lantai 3 • Sayap Barat',
    roomCapacity: 20,
    roomImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDgreoNeoNPVJTdXK-G3awFT456hWn1fPhT63aRjnwb6qjQJB--ntOiKzR9GMNh2-0M3gt-PNEIb1Ss3WsQSpZcZAiKDbCQevwwfgcj6a--xwlWSBLZpNbVrkzrnS9ctzMhGSqyxWhDPaXHBP1ANlhiEvA-QgoWiZYfIJMbudzn13iQseJh0HvMd28dq2LveUscD_Y8VsSyvfyBWDQ2tvWDfZfxDFwChBgNUlENEfy',
    applicantName: 'Budi Santoso',
    applicantRole: 'Staff Divisi',
    applicantDept: 'Product Engineering',
    applicantEmail: 'budi.santoso@kampus.ac.id',
    applicantInitials: 'BS',
    applicantAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrCqTjcXPxtgzjHZQVILzD1Aj5wgZ7vso-pY0YUCBoZoPi7SET9BchUYQ8KyHada-yrUE5debG3PUGGHCMYYqEpGy9mZ99oCeQKarZM70jCi0Kx6_32uRG5pZIEQQJHi5C9xb-wQxOyIbhN42hteHxy9nvQ86Ako3Zqh165Pr8Peq1sgawXaUMzPBccHz8AyYJqQjBfDYMAwcjBmVfcBWRZyCjJtUX543_bNVfCkae',
    eventName: 'Rapat Koordinasi Himpunan & Sprint Q4',
    purpose: 'Pembahasan roadmap semester baru dan evaluasi KPI tim internal engineering.',
    reservationDate: 'Kamis, 24 Oktober 2024',
    timeStart: '10:00',
    timeEnd: '12:00',
    timeString: '10:00 - 12:00 WIB',
    duration: '2 Jam',
    participants: 15,
    facilities: ['Proyektor & Kabel HDMI', 'Microfon Wireless (2 unit)', 'Akses WiFi Tamu'],
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    hasConflict: true,
    conflictOverlap: '15m',
    conflictingBooking: {
      id: 'RB-895',
      applicantName: 'Siti Rahmawati',
      applicantDept: 'Biro Kemahasiswaan',
      timeString: '10:30 - 12:30 WIB',
      agenda: 'Perekrutan Asisten Lab & Pengurus Himpunan'
    },
    submittedAt: '24 Okt 2024, 08:30 WIB',
    rejectionReason: '',
    qrCodeUnlocked: false
  },
  {
    id: 'RB-889',
    roomId: 'auditorium-mini',
    roomName: 'Auditorium Mini',
    roomFloor: 'Lantai 2',
    roomCapacity: 80,
    roomImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBnZI5LqQ-bs416NVJHPGWLGs9Rpzij3IMZrEPeK1prB6yJlyFV4DxRKyDk8FjiJraf3WQkXUcknmcR2BhBn-AVptwoUzX5_XHdxkHhpzRXvqZMwYfNhQKc4H_KRZAMJsnO5BFTdxwsxa-_Mol6q_1n3sueLTIrir_gJE95pGD9I4JCu89wQdJmubBInh-v3KR3qPxgvSYLd7p6B57plEr8q2zSr3xd5r8PK2Xksu4l',
    applicantName: 'Siti Aminah',
    applicantRole: 'Growth Lead',
    applicantDept: 'Marketing Growth',
    applicantEmail: 'siti.aminah@kampus.ac.id',
    applicantInitials: 'SA',
    applicantAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAUYZPVfq0qy_zqBk7sES5o3gKkN2AUMhJPdw9acQLT7bDRCZH6t-3_nFjJs237G96ltjzi8G7k-sa-4UwEhHYRJqrtUkISaTcSKejifyr07ORUbOl7N3hOYzZBGydTsKYwlF4dtXqb6Dulaim4w-OgtY_iacv1lEFUa4cUIEClHkAB2XCWdVQN3P92tiVKQM5XDFgDRU4bWEd5-iZppqB9X6Bcoc9VArZbxSi31FkO',
    eventName: 'Workshop UI/UX Design Sprint Q4',
    purpose: 'Pelatihan design thinking dan hands-on wireframing bersama mahasiswa tingkat akhir.',
    reservationDate: 'Jumat, 25 Oktober 2024',
    timeStart: '13:00',
    timeEnd: '15:00',
    timeString: '13:00 - 15:00 WIB',
    duration: '2 Jam',
    participants: 60,
    facilities: ['Proyektor 4K', 'Sound System', 'AC Central'],
    status: 'approved',
    hasConflict: false,
    submittedAt: '23 Okt 2024, 14:10 WIB',
    rejectionReason: '',
    qrCodeUnlocked: true
  },
  {
    id: 'RB-881',
    roomId: 'ruang-diskusi-b',
    roomName: 'Ruang Diskusi B',
    roomFloor: 'Lantai 1',
    roomCapacity: 8,
    roomImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC2qJWnIv5GpA_MPW6dTEee-c84FhenwxEn48Az5BvmKAU4VQc0o2cOs_cs6lbT78iVlHJF96DQOsEWlN97tRoltmflRZmP9_9ab-Uqz76D7Yx4g1Jp5HAgPvrPrBO_ovf0MtLRUAKfnwDfn_Lgtw6P_32s_wXtmEafVgMycFdlio32aANnucJG2h12gLYjdNZuLjEPlFr9Dra3v2EGqutS-rizpEwgPnqWPyHAOgQA',
    applicantName: 'Budi Santoso',
    applicantRole: 'Staff Divisi',
    applicantDept: 'Product Engineering',
    applicantEmail: 'budi.santoso@kampus.ac.id',
    applicantInitials: 'BS',
    applicantAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrCqTjcXPxtgzjHZQVILzD1Aj5wgZ7vso-pY0YUCBoZoPi7SET9BchUYQ8KyHada-yrUE5debG3PUGGHCMYYqEpGy9mZ99oCeQKarZM70jCi0Kx6_32uRG5pZIEQQJHi5C9xb-wQxOyIbhN42hteHxy9nvQ86Ako3Zqh165Pr8Peq1sgawXaUMzPBccHz8AyYJqQjBfDYMAwcjBmVfcBWRZyCjJtUX543_bNVfCkae',
    eventName: 'Evaluasi Mingguan Sprint Retrospective',
    purpose: 'Review sprint backlog 12 dan identifikasi bottleneck deployment.',
    reservationDate: 'Senin, 21 Oktober 2024',
    timeStart: '09:00',
    timeEnd: '10:30',
    timeString: '09:00 - 10:30 WIB',
    duration: '1.5 Jam',
    participants: 7,
    facilities: ['Whiteboard', 'WiFi Cepat'],
    status: 'approved',
    hasConflict: false,
    submittedAt: '20 Okt 2024, 09:15 WIB',
    rejectionReason: '',
    qrCodeUnlocked: true
  },
  {
    id: 'RB-875',
    roomId: 'ruang-kreatif-a',
    roomName: 'Ruang Kreatif A',
    roomFloor: 'Lantai 2',
    roomCapacity: 8,
    roomImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDcfd015si-MuWQzcZ4F7zWTkdUA942l-vkVrVkFrJwVIZLUN9uJpMTXxA1ejouw3K4ODcKnTsU71VpyIXCmnycxhaOUsTmsZCs1dvtll3fzpA8wz01BMGzuQahDnRsUvVBWtcUe_9IXQ7pTHVES5USXuGlQHegfgzGsPbNVAltalFn5M_KrGvHpVXkCgXQc0YImPe41D5gd2uFUDwSzk8_uZcJYCUtS5kLp2McKyC7',
    applicantName: 'Doni Pratama',
    applicantRole: 'Staf Administrasi',
    applicantDept: 'Keuangan',
    applicantEmail: 'doni.pratama@kampus.ac.id',
    applicantInitials: 'DP',
    applicantAvatar: '',
    eventName: 'Rapat Anggaran Tahunan',
    purpose: 'Penyusunan RAB semester ganjil.',
    reservationDate: 'Jumat, 18 Oktober 2024',
    timeStart: '14:00',
    timeEnd: '16:00',
    timeString: '14:00 - 16:00 WIB',
    duration: '2 Jam',
    participants: 10,
    facilities: ['Display Panel 65"'],
    status: 'rejected',
    hasConflict: false,
    submittedAt: '17 Okt 2024, 11:00 WIB',
    rejectionReason: 'Ruangan sudah dialokasikan untuk kegiatan pimpinan yang diajukan lebih awal.',
    qrCodeUnlocked: false
  }
];

class AppStore {
  constructor() {
    this.STORAGE_KEY_RESERVATIONS = 'roombook_reservations_data';
    this.STORAGE_KEY_CURRENT_USER = 'roombook_current_user_role';
    this.STORAGE_KEY_SELECTED_ROOM = 'roombook_selected_room_id';
    this.STORAGE_KEY_SELECTED_RESERVATION = 'roombook_selected_reservation_id';

    this.fallbackRooms = INITIAL_ROOMS; // Mempertahankan data.js sebagai fallback sementara
    this.rooms = []; // Data awal sebelum dimuat dari Supabase
    this.isLoadingRooms = true;
    this.roomsError = null;
    this.dataSource = 'supabase'; // 'supabase' atau 'fallback'

    this.fallbackReservations = INITIAL_RESERVATIONS;
    this.isLoadingReservations = false;
    this.reservationsError = null;
    this.reservationsLoadRequestId = 0;

    this.reservations = this.loadReservations();
    this.currentRole = this.loadRole(); // 'user' or 'admin'
    this.currentUser = {
      name: 'Budi Santoso',
      role: 'Staff Divisi',
      dept: 'Product Engineering',
      email: 'budi.santoso@kampus.ac.id',
      initials: 'BS'
    };
    this.selectedRoomId = 'ruang-rapat-utama';
    this.selectedReservationId = 'RB-892';
    this.listeners = [];
  }

  /**
   * Mengambil data ruangan dari database Supabase melalui RoomService
   */
  async loadRoomsFromDatabase({ silent = false } = {}) {
    if (!silent) {
      this.isLoadingRooms = true;
      this.roomsError = null;
      this.notify();
    }

    if (typeof window !== 'undefined' && window.RoomService) {
      try {
        const { data, error } = await window.RoomService.fetchRooms();
        if (error) {
          this.roomsError = error.message || 'Gagal memuat data ruangan dari Supabase.';
          this.isLoadingRooms = false;
          this.notify();
          return { success: false, error };
        }
        this.rooms = data || [];
        this.dataSource = 'supabase';
        this.isLoadingRooms = false;
        this.roomsError = null;
        this.notify();
        return { success: true, count: this.rooms.length };
      } catch (err) {
        this.roomsError = err.message || 'Kesalahan jaringan saat membaca Supabase.';
        this.isLoadingRooms = false;
        this.notify();
        return { success: false, error: err };
      }
    } else {
      this.roomsError = 'Modul RoomService belum dimuat.';
      this.isLoadingRooms = false;
      this.notify();
      return { success: false, error: new Error(this.roomsError) };
    }
  }

  /**
   * Mengalihkan ke mode fallback dummy data secara eksplisit
   */
  useFallbackData() {
    this.rooms = JSON.parse(JSON.stringify(this.fallbackRooms));
    this.dataSource = 'fallback';
    this.isLoadingRooms = false;
    this.roomsError = null;
    console.warn('⚠️ [RoomBookStore] Mengaktifkan mode fallback dummy data.');
    this.notify();
  }

  /**
   * Mengalihkan kembali ke mode database Supabase
   */
  useDatabaseData() {
    return this.loadRoomsFromDatabase();
  }

  loadReservations() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY_RESERVATIONS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('LocalStorage unavailable, using initial dummy data', e);
    }
    return JSON.parse(JSON.stringify(INITIAL_RESERVATIONS));
  }

  saveReservations() {
    try {
      localStorage.setItem(this.STORAGE_KEY_RESERVATIONS, JSON.stringify(this.reservations));
    } catch (e) {
      console.warn('LocalStorage save error', e);
    }
    this.notify();
  }

  loadRole() {
    try {
      return localStorage.getItem(this.STORAGE_KEY_CURRENT_USER) || 'user';
    } catch (e) {
      return 'user';
    }
  }

  setRole(role) {
    this.currentRole = role;
    try {
      localStorage.setItem(this.STORAGE_KEY_CURRENT_USER, role);
    } catch (e) { }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Listener error', err); }
    });
  }

  getRooms() {
    return this.rooms;
  }

  getRoomById(id) {
    if (!id) return null;
    const strId = String(id);
    const found = this.rooms.find(r => String(r.id) === strId || (r.dbId && String(r.dbId) === strId));
    if (found) return found;
    if (this.dataSource === 'fallback') {
      const fallbackFound = this.fallbackRooms.find(r => String(r.id) === strId);
      if (fallbackFound) return fallbackFound;
    }
    return null;
  }

  getReservations() {
    return this.reservations;
  }

  getCachedReservationById(id) {
    if (!id) return null;
    const strId = String(id).trim();
    const found = this.reservations.find(r => 
      String(r.id) === strId || 
      (r.dbId !== undefined && r.dbId !== null && String(r.dbId) === strId)
    );
    if (found) return found;

    if (this.dataSource !== 'supabase') {
      const fallbackFound = this.fallbackReservations.find(r => String(r.id) === strId);
      if (fallbackFound) return fallbackFound;
    }
    return null;
  }

  addOrUpdateReservation(reservation) {
    if (!reservation) return;
    const resId = String(reservation.id || '').trim();
    const dbId = (reservation.dbId !== undefined && reservation.dbId !== null) ? String(reservation.dbId).trim() : null;

    const existingIndex = this.reservations.findIndex(r => 
      (resId && String(r.id).trim() === resId) || 
      (dbId && r.dbId !== undefined && r.dbId !== null && String(r.dbId).trim() === dbId)
    );

    if (existingIndex >= 0) {
      this.reservations[existingIndex] = { ...this.reservations[existingIndex], ...reservation };
    } else {
      this.reservations.unshift(reservation);
    }

    this.detectConflicts();
    this.saveReservations();
    this.notify();
  }

  async getReservationById(id) {
    if (this.dataSource !== 'supabase') {
      return this.getCachedReservationById(id);
    }

    const result = await this.fetchReservationById(id);
    if (!result.success) throw result.error || new Error(`Gagal mengambil reservasi "${id}".`);
    return result.data;
  }

  getUserReservations() {
    const userId = (this.currentUser && this.currentUser.id) || '';
    const userEmail = (this.currentUser && this.currentUser.email) || '';

    // Mode Supabase aktif: hanya tampilkan reservasi yang terikat dengan user ID login
    if (this.dataSource === 'supabase') {
      if (!userId) return [];
      return this.reservations.filter(r => r.userId === userId);
    }

    // Mode fallback: cocokkan berdasarkan user ID atau email login (tanpa fallback Budi Santoso)
    return this.reservations.filter(r => 
      (userId && r.userId === userId) ||
      (userEmail && r.applicantEmail === userEmail)
    );
  }

  getPendingReservations() {
    return this.reservations.filter(r => r.status === 'pending');
  }

  getApprovedReservations() {
    return this.reservations.filter(r => r.status === 'approved');
  }

  getRejectedReservations() {
    return this.reservations.filter(r => r.status === 'rejected');
  }

  addReservation(data) {
    const randomNum = Math.floor(100 + Math.random() * 900);
    const newId = `RB-${randomNum}`;
    const room = this.getRoomById(data.roomId || this.selectedRoomId);

    const newReservation = {
      id: newId,
      roomId: room.id,
      roomName: room.name,
      roomFloor: room.floor,
      roomCapacity: room.capacity,
      roomImage: room.image,
      applicantName: this.currentUser.name,
      applicantRole: this.currentUser.role,
      applicantDept: this.currentUser.dept,
      applicantEmail: this.currentUser.email,
      applicantInitials: this.currentUser.initials,
      applicantAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrCqTjcXPxtgzjHZQVILzD1Aj5wgZ7vso-pY0YUCBoZoPi7SET9BchUYQ8KyHada-yrUE5debG3PUGGHCMYYqEpGy9mZ99oCeQKarZM70jCi0Kx6_32uRG5pZIEQQJHi5C9xb-wQxOyIbhN42hteHxy9nvQ86Ako3Zqh165Pr8Peq1sgawXaUMzPBccHz8AyYJqQjBfDYMAwcjBmVfcBWRZyCjJtUX543_bNVfCkae',
      eventName: data.eventName || 'Agenda Rapat Tim',
      purpose: data.purpose || 'Koordinasi perencanaan dan sinkronisasi tugas.',
      reservationDate: data.reservationDate || 'Kamis, 24 Oktober 2024',
      timeStart: data.timeStart || '13:00',
      timeEnd: data.timeEnd || '15:00',
      timeString: `${data.timeStart || '13:00'} - ${data.timeEnd || '15:00'} WIB`,
      duration: '2 Jam',
      participants: parseInt(data.participants, 10) || 10,
      facilities: data.facilities || ['Akses WiFi Tamu'],
      status: 'pending',
      hasConflict: Boolean(data.hasConflict),
      conflictOverlap: data.hasConflict ? '15m' : '',
      conflictingBooking: data.hasConflict ? {
        id: 'RB-895',
        applicantName: 'Siti Rahmawati',
        applicantDept: 'Biro Kemahasiswaan',
        timeString: '10:30 - 12:30 WIB',
        agenda: 'Perekrutan Asisten Lab & Pengurus Himpunan'
      } : null,
      submittedAt: 'Hari ini, baru saja',
      rejectionReason: '',
      qrCodeUnlocked: false
    };

    this.reservations.unshift(newReservation);
    this.selectedReservationId = newId;
    this.saveReservations();
    return newReservation;
  }

  updateReservationStatus(id, newStatus, rejectionReason = '') {
    const res = this.reservations.find(r => r.id === id);
    if (!res) return false;

    res.status = newStatus;
    if (newStatus === 'approved') {
      res.qrCodeUnlocked = true;
      res.rejectionReason = '';
    } else if (newStatus === 'rejected') {
      res.qrCodeUnlocked = false;
      res.rejectionReason = rejectionReason || 'Tidak memenuhi kriteria ketersediaan jadwal.';
    }
    this.saveReservations();
    return true;
  }

  cancelReservation(id) {
    const res = this.reservations.find(r => r.id === id);
    if (!res) return false;
    res.status = 'rejected';
    res.rejectionReason = 'Dibatalkan oleh pemohon.';
    res.qrCodeUnlocked = false;
    this.saveReservations();
    return true;
  }

  /**
   * Memetakan data reservasi database Supabase ke format objek UI RoomBook
   * Mengonversi timestamp database ke zona waktu WIB (UTC+7) secara konsisten
   */
  mapDbReservationToUI(dbRecord) {
    if (!dbRecord) return null;

    // Helper konsisten WIB (UTC+7)
    const toWibDate = (dInput) => {
      if (!dInput) return new Date();
      const d = dInput instanceof Date ? dInput : new Date(dInput);
      if (isNaN(d.getTime())) return new Date();
      return new Date(d.getTime() + 7 * 3600000);
    };

    const wibStart = toWibDate(dbRecord.start_time);
    const wibEnd = toWibDate(dbRecord.end_time);

    const indonesianDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const indonesianMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const dayName = indonesianDays[wibStart.getUTCDay()];
    const dateNum = wibStart.getUTCDate();
    const monthName = indonesianMonths[wibStart.getUTCMonth()];
    const yearNum = wibStart.getUTCFullYear();
    const reservationDate = `${dayName}, ${dateNum} ${monthName} ${yearNum}`;

    const pad = (n) => String(n).padStart(2, '0');
    const timeStart = `${pad(wibStart.getUTCHours())}:${pad(wibStart.getUTCMinutes())}`;
    const timeEnd = `${pad(wibEnd.getUTCHours())}:${pad(wibEnd.getUTCMinutes())}`;
    const timeString = `${timeStart} - ${timeEnd} WIB`;

    const startMs = dbRecord.start_time ? new Date(dbRecord.start_time).getTime() : 0;
    const endMs = dbRecord.end_time ? new Date(dbRecord.end_time).getTime() : 0;
    const diffMs = Math.max(0, endMs - startMs);
    const diffHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
    const duration = diffHours >= 1 ? `${diffHours} Jam` : `${Math.round(diffMs / (1000 * 60))} Menit`;

    // Room info
    const dbRoom = dbRecord.rooms || this.getRoomById(dbRecord.room_id) || {};
    const roomCapacity = Number(dbRoom.capacity) || 20;
    const roomFloor = dbRoom.floor || (roomCapacity >= 50 ? 'Lantai 2' : (roomCapacity >= 20 ? 'Lantai 3 • Sayap Barat' : 'Lantai 1'));
    const defaultImage = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDgreoNeoNPVJTdXK-G3awFT456hWn1fPhT63aRjnwb6qjQJB--ntOiKzR9GMNh2-0M3gt-PNEIb1Ss3WsQSpZcZAiKDbCQevwwfgcj6a--xwlWSBLZpNbVrkzrnS9ctzMhGSqyxWhDPaXHBP1ANlhiEvA-QgoWiZYfIJMbudzn13iQseJh0HvMd28dq2LveUscD_Y8VsSyvfyBWDQ2tvWDfZfxDFwChBgNUlENEfy';

    // Applicant info from profiles join
    const profile = dbRecord.profiles || {};
    const applicantName = profile.full_name || (this.currentUser && this.currentUser.id === dbRecord.user_id ? this.currentUser.name : 'Pemohon Terdaftar');
    const applicantRole = profile.role === 'admin' ? 'Administrator Fasilitas' : 'Pengguna Terdaftar';
    const applicantDept = profile.role === 'admin' ? 'Biro Aset Operasional Kampus' : 'Civitas Akademika / Instansi';
    const applicantEmail = (this.currentUser && this.currentUser.id === dbRecord.user_id) ? this.currentUser.email : (profile.id ? `${applicantName.toLowerCase().replace(/\s+/g, '.')}@kampus.ac.id` : 'user@kampus.ac.id');
    
    // Initials
    const nameParts = applicantName.trim().split(/\s+/);
    const applicantInitials = nameParts.length === 1 ? nameParts[0].slice(0, 2).toUpperCase() : (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();

    // Parse facilities (support column facilities text[] from DB or room facilities)
    let facilities = [];
    if (Array.isArray(dbRecord.facilities) && dbRecord.facilities.length > 0) {
      facilities = dbRecord.facilities;
    } else if (typeof dbRecord.facilities === 'string' && dbRecord.facilities.trim()) {
      facilities = dbRecord.facilities.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    } else if (dbRoom.facilities) {
      if (Array.isArray(dbRoom.facilities)) {
        facilities = dbRoom.facilities.map(f => typeof f === 'string' ? f : (f.name || 'Fasilitas'));
      } else if (typeof dbRoom.facilities === 'string') {
        facilities = dbRoom.facilities.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      }
    }
    if (facilities.length === 0) {
      facilities = ['Proyektor & Kabel HDMI', 'Akses WiFi Tamu'];
    }

    const purpose = dbRecord.purpose || 'Agenda Pertemuan';
    const eventName = dbRecord.event_name || (purpose.length > 40 ? purpose.slice(0, 37) + '...' : purpose);
    const participants = Number(dbRecord.participants) || Math.min(roomCapacity, 15);

    const wibCreated = toWibDate(dbRecord.created_at);
    const submittedAt = `${wibCreated.getUTCDate()} ${indonesianMonths[wibCreated.getUTCMonth()].slice(0, 3)} ${wibCreated.getUTCFullYear()}, ${pad(wibCreated.getUTCHours())}:${pad(wibCreated.getUTCMinutes())} WIB`;

    return {
      id: `RB-${dbRecord.id}`,
      dbId: dbRecord.id,
      userId: dbRecord.user_id,
      roomId: String(dbRecord.room_id),
      roomName: dbRoom.name || 'Ruang Rapat',
      roomFloor: roomFloor,
      roomCapacity: roomCapacity,
      roomImage: dbRoom.image_url || defaultImage,
      applicantName: applicantName,
      applicantRole: applicantRole,
      applicantDept: applicantDept,
      applicantEmail: applicantEmail,
      applicantInitials: applicantInitials,
      applicantAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCrCqTjcXPxtgzjHZQVILzD1Aj5wgZ7vso-pY0YUCBoZoPi7SET9BchUYQ8KyHada-yrUE5debG3PUGGHCMYYqEpGy9mZ99oCeQKarZM70jCi0Kx6_32uRG5pZIEQQJHi5C9xb-wQxOyIbhN42hteHxy9nvQ86Ako3Zqh165Pr8Peq1sgawXaUMzPBccHz8AyYJqQjBfDYMAwcjBmVfcBWRZyCjJtUX543_bNVfCkae',
      eventName: eventName,
      purpose: purpose,
      reservationDate: reservationDate,
      timeStart: timeStart,
      timeEnd: timeEnd,
      timeString: timeString,
      startTime: dbRecord.start_time,
      endTime: dbRecord.end_time,
      rawStartTime: dbRecord.start_time,
      rawEndTime: dbRecord.end_time,
      duration: duration,
      participants: participants,
      facilities: facilities,
      status: dbRecord.status || 'pending',
      hasConflict: false,
      conflictOverlap: '',
      conflictingBooking: null,
      submittedAt: submittedAt,
      rejectionReason: dbRecord.status === 'rejected'
        ? 'Ditolak oleh administrator.'
        : (dbRecord.status === 'cancelled' ? 'Dibatalkan oleh pemohon.' : ''),
      qrCodeUnlocked: dbRecord.status === 'approved',
      isFromDatabase: true
    };
  }

  /**
   * Menghitung secara aktual bentrok jadwal antara dua reservasi pada ruangan yang sama.
   * Jadwal bertabrakan jika: (startA < endB) AND (endA > startB)
   */
  detectConflicts() {
    for (let i = 0; i < this.reservations.length; i++) {
      const resA = this.reservations[i];
      if (resA.status !== 'pending') {
        resA.hasConflict = false;
        resA.conflictingBooking = null;
        continue;
      }

      let conflictFound = null;
      for (let j = 0; j < this.reservations.length; j++) {
        if (i === j) continue;
        const resB = this.reservations[j];
        if (resB.status !== 'pending' && resB.status !== 'approved') continue;
        if (String(resA.roomId) !== String(resB.roomId)) continue;

        const startA = resA.startTime ? new Date(resA.startTime).getTime() : 0;
        const endA = resA.endTime ? new Date(resA.endTime).getTime() : 0;
        const startB = resB.startTime ? new Date(resB.startTime).getTime() : 0;
        const endB = resB.endTime ? new Date(resB.endTime).getTime() : 0;

        if (startA && endA && startB && endB && startA < endB && endA > startB) {
          conflictFound = resB;
          break;
        }
      }

      if (conflictFound) {
        resA.hasConflict = true;
        resA.conflictOverlap = 'Jadwal Bertabrakan';
        resA.conflictingBooking = {
          id: conflictFound.id,
          applicantName: conflictFound.applicantName,
          applicantDept: conflictFound.applicantDept,
          timeString: conflictFound.timeString,
          agenda: conflictFound.eventName || conflictFound.purpose
        };
      } else {
        resA.hasConflict = false;
        resA.conflictingBooking = null;
      }
    }
  }

  /**
   * Mengambil seluruh data reservasi dari Supabase melalui REST API (RLS enforced)
   */
  async loadReservationsFromDatabase() {
    const requestId = ++this.reservationsLoadRequestId;
    this.isLoadingReservations = true;
    this.reservationsError = null;

    const client = window.supabaseClient;
    if (!client) {
      if (requestId === this.reservationsLoadRequestId) this.isLoadingReservations = false;
      return { success: false, error: new Error('Supabase client belum diinisialisasi.') };
    }

    try {
      console.log('📡 [RoomBookStore] Membaca data dari tabel Supabase "reservations"...');
      let records = null;
      
      const relQuery = await client
        .from('reservations')
        .select(`
          *,
          rooms (*),
          profiles:user_id (id, full_name, role)
        `)
        .order('created_at', { ascending: false });

      if (relQuery.error) {
        console.warn('⚠️ [RoomBookStore] Query relasi reservations gagal (' + relQuery.error.message + '), beralih ke query langsung select("*")...');
        const simpleQuery = await client
          .from('reservations')
          .select('*')
          .order('created_at', { ascending: false });

        if (simpleQuery.error) {
          console.error('❌ [RoomBookStore] Gagal membaca reservations:', simpleQuery.error.message);
          if (requestId === this.reservationsLoadRequestId) {
            this.isLoadingReservations = false;
            this.reservationsError = simpleQuery.error.message;
          }
          return { success: false, error: simpleQuery.error };
        }
        records = simpleQuery.data;
      } else {
        records = relQuery.data;
      }

      if (requestId !== this.reservationsLoadRequestId) {
        return { success: false, stale: true };
      }

      // STRICT: Mode Supabase murni menggunakan data database tanpa tercampur dummy
      const dbItems = (records || []).map(r => this.mapDbReservationToUI(r)).filter(Boolean);

      // Pertahankan reservasi lokal yang baru dibuat jika belum terbaca oleh query database (RLS / replikasi tertunda)
      const dbKeys = new Set();
      dbItems.forEach(item => {
        if (item.id) dbKeys.add(String(item.id).trim());
        if (item.dbId !== undefined && item.dbId !== null) dbKeys.add(String(item.dbId).trim());
      });

      const pendingLocalItems = (this.reservations || []).filter(r => 
        r.syncPending && (
          (r.dbId !== undefined && r.dbId !== null && !dbKeys.has(String(r.dbId).trim())) ||
          (r.id && !dbKeys.has(String(r.id).trim()))
        )
      );

      this.reservations = [...pendingLocalItems, ...dbItems];
      this.detectConflicts();
      console.log(`✅ [RoomBookStore] Berhasil memuat ${this.reservations.length} reservasi (${dbItems.length} dari database, ${pendingLocalItems.length} cache lokal).`);

      this.isLoadingReservations = false;
      this.saveReservations();
      this.notify();
      return { success: true, count: this.reservations.length };
    } catch (err) {
      console.error('❌ [RoomBookStore] Unexpected error loading reservations:', err);
      if (requestId === this.reservationsLoadRequestId) {
        this.isLoadingReservations = false;
        this.reservationsError = err.message;
      }
      return { success: false, error: err };
    }
  }

  /**
   * Mengambil reservasi berdasarkan primary key database atau ID tampilan yang memiliki mapping cache
   * Menyertakan relasi rooms, profiles, dan linimasa reservation_history
   */
  async fetchReservationById(id) {
    if (!id) {
      return { success: false, notFound: true, error: new Error('ID reservasi tidak valid.') };
    }

    const strId = String(id).trim();
    const cachedItem = this.reservations.find(r =>
      String(r.id) === strId ||
      (r.dbId !== undefined && r.dbId !== null && String(r.dbId) === strId)
    );
    const rawDatabaseId = /^\d+$/.test(strId)
      ? strId
      : (cachedItem && cachedItem.dbId !== undefined && cachedItem.dbId !== null ? String(cachedItem.dbId) : null);
    const databaseId = rawDatabaseId && /^\d+$/.test(rawDatabaseId) && !/^0+$/.test(rawDatabaseId)
      ? rawDatabaseId
      : null;

    const client = window.supabaseClient;

    // Data fallback hanya boleh dibaca dari sumber fallback.
    if (this.dataSource === 'fallback') {
      const local = this.getCachedReservationById(strId);
      if (local) return { success: true, data: local };
      return { 
        success: false, 
        notFound: true, 
        error: new Error(`Data reservasi dengan ID "${strId}" tidak ditemukan di database.`) 
      };
    }

    if (!client) {
      const error = new Error('Client Supabase belum diinisialisasi.');
      console.error('❌ [RoomBookStore] Tidak dapat mengambil detail reservasi:', error);
      return { success: false, error };
    }

    // ID tampilan memerlukan pasangan dbId dari record; suffix tidak pernah ditebak.
    if (databaseId === null) {
      return {
        success: false,
        invalidId: true,
        error: new Error(`ID tampilan "${strId}" tidak memiliki primary key database yang terpetakan.`)
      };
    }

    try {
      if (!client.auth || typeof client.auth.getSession !== 'function') {
        const error = new Error('API sesi Supabase Auth tidak tersedia.');
        console.error('❌ [RoomBookStore] Tidak dapat memeriksa sesi sebelum query detail:', error);
        return { success: false, error };
      }

      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        console.error('❌ [RoomBookStore] Gagal memeriksa sesi Supabase sebelum query detail:', sessionError);
        return { success: false, error: sessionError };
      }
      if (!sessionData || !sessionData.session) {
        return {
          success: false,
          authRequired: true,
          error: new Error('Sesi login Supabase tidak ditemukan atau telah berakhir.')
        };
      }

      console.log(`📡 [RoomBookStore] Mengambil detail reservasi berdasarkan primary key ${databaseId} (input: ${strId})...`);

      let dbRecord = null;

      // 1. Coba query relasi dengan rooms dan profiles
      const relQuery = await client
        .from('reservations')
        .select(`
          *,
          rooms (*),
          profiles:user_id (id, full_name, role)
        `)
        .eq('id', databaseId)
        .maybeSingle();

      if (relQuery.error) {
        console.error('❌ [RoomBookStore] Query relasi detail gagal; mencoba query reservations tanpa relasi:', relQuery.error);

        // Periksa apakah error adalah RLS / Hak Akses Ditolak (42501)
        if (relQuery.error.code === '42501' || (relQuery.error.message && relQuery.error.message.toLowerCase().includes('permission'))) {
          return {
            success: false,
            accessDenied: true,
            error: relQuery.error
          };
        }
        if (relQuery.error.code === '401' || (relQuery.error.message && /jwt.*(expired|invalid)|auth session missing/i.test(relQuery.error.message))) {
          return { success: false, authRequired: true, error: relQuery.error };
        }

        // Coba query langsung tabel reservations
        const simpleQuery = await client
          .from('reservations')
          .select('*')
          .eq('id', databaseId)
          .maybeSingle();

        if (simpleQuery.error) {
          console.error('❌ [RoomBookStore] Query langsung reservations gagal:', simpleQuery.error);
          if (simpleQuery.error.code === '42501' || (simpleQuery.error.message && simpleQuery.error.message.toLowerCase().includes('permission'))) {
            return {
              success: false,
              accessDenied: true,
              error: simpleQuery.error
            };
          }
          if (simpleQuery.error.code === '401' || (simpleQuery.error.message && /jwt.*(expired|invalid)|auth session missing/i.test(simpleQuery.error.message))) {
            return { success: false, authRequired: true, error: simpleQuery.error };
          }
          return {
            success: false,
            error: simpleQuery.error
          };
        }
        dbRecord = simpleQuery.data;
      } else {
        dbRecord = relQuery.data;
      }

      // 2. Jika tidak ditemukan di database
      if (!dbRecord) {
        if (cachedItem && (cachedItem.eventName || cachedItem.roomName || cachedItem.purpose)) {
          console.warn(`⚠️ [RoomBookStore] Record ${strId} belum terlihat di database via SELECT (RLS/latensi), menggunakan data cache lokal:`, cachedItem);
          return { success: true, data: cachedItem, fromCache: true };
        }

        if (cachedItem && cachedItem.isFromDatabase) {
          const error = new Error(`Reservasi ${strId} tidak terlihat oleh sesi saat ini. Periksa akses RLS atau apakah record masih tersedia.`);
          console.error('❌ [RoomBookStore] Primary key dari riwayat tidak menghasilkan record yang dapat dibaca:', {
            databaseId,
            error
          });
          return { success: false, accessDenied: true, error };
        }

        return {
          success: false,
          notFound: true,
          error: new Error(`Data reservasi dengan ID "${strId}" tidak ditemukan di database.`)
        };
      }

      // Pastikan data rooms tersedia jika query relasi tidak membawa data room
      if (!dbRecord.rooms && dbRecord.room_id) {
        try {
          const roomQuery = await client
            .from('rooms')
            .select('id, name, capacity, facilities, image_url')
            .eq('id', dbRecord.room_id)
            .maybeSingle();
          if (roomQuery.data) {
            dbRecord.rooms = roomQuery.data;
          }
        } catch (rErr) {
          console.warn('⚠️ [RoomBookStore] Gagal mengambil relasi rooms langsung:', rErr);
        }
      }

      // Pastikan data profile pemohon tersedia jika query relasi tidak membawanya
      if (!dbRecord.profiles && dbRecord.user_id) {
        try {
          const profQuery = await client
            .from('profiles')
            .select('id, full_name, role')
            .eq('id', dbRecord.user_id)
            .maybeSingle();
          if (profQuery.data) {
            dbRecord.profiles = profQuery.data;
          }
        } catch (pErr) {
          console.warn('⚠️ [RoomBookStore] Gagal mengambil relasi profiles langsung:', pErr);
        }
      }

      // 3. Ambil linimasa dari reservation_history jika tabel tersedia
      let historyRecords = [];
      try {
        const historyQuery = await client
          .from('reservation_history')
          .select('*')
          .eq('reservation_id', databaseId)
          .order('created_at', { ascending: true });

        if (!historyQuery.error && historyQuery.data) {
          historyRecords = historyQuery.data;
        }
      } catch (hErr) {
        console.warn('⚠️ [RoomBookStore] Gagal membaca riwayat audit reservation_history:', hErr);
      }

      // 4. Petakan record DB ke format objek UI RoomBook
      const uiItem = this.mapDbReservationToUI(dbRecord);
      if (uiItem) {
        if (cachedItem && cachedItem.isFromDatabase && String(cachedItem.dbId) === String(uiItem.dbId)) {
          uiItem.id = cachedItem.id;
        }
        uiItem.history = historyRecords;
        uiItem.historyLoaded = true;

        // Ambil catatan penolakan/persetujuan/pembatalan terbaru dari reservation_history jika ada
        const rejectEntry = historyRecords.slice().reverse().find(h =>
          h.action === 'REJECTED' ||
          h.action === 'CANCELLED' ||
          h.action === 'CANCELLED_BY_USER' ||
          h.action === 'CANCELLED_BY_ADMIN'
        );
        if (rejectEntry && rejectEntry.notes) {
          uiItem.rejectionReason = rejectEntry.notes;
        }
        const approveEntry = historyRecords.slice().reverse().find(h => h.action === 'APPROVED');
        if (approveEntry && approveEntry.notes) {
          uiItem.approvalNotes = approveEntry.notes;
        }

        // Sinkronkan ke in-memory reservations array
        const existingIdx = this.reservations.findIndex(r => 
          String(r.id) === String(uiItem.id) || 
          (r.dbId !== undefined && r.dbId !== null && String(r.dbId) === String(uiItem.dbId))
        );
        if (existingIdx >= 0) {
          this.reservations[existingIdx] = uiItem;
        } else {
          this.reservations.unshift(uiItem);
        }

        this.detectConflicts();
        this.saveReservations();
        this.notify();

        return { success: true, data: uiItem };
      }

      return {
        success: false,
        notFound: true,
        error: new Error(`Gagal memetakan data reservasi ID "${strId}".`)
      };
    } catch (err) {
      console.error('❌ [RoomBookStore] Error fetching reservation by ID:', err);
      if (err.code === '42501' || (err.message && err.message.toLowerCase().includes('permission'))) {
        return { success: false, accessDenied: true, error: err };
      }
      return { success: false, error: err };
    }
  }

  /**
   * Membuat reservasi baru via Supabase RPC create_reservation_safe
   * Menjalankan locking rooms dan anti-overlap di level database
   */
  async createReservationSupabase({ roomId, eventName, purpose, startTime, endTime, participants, facilities }) {
    const client = window.supabaseClient;
    if (!client) throw new Error('Client Supabase belum siap.');

    const numericRoomId = parseInt(roomId, 10);
    if (isNaN(numericRoomId) || numericRoomId <= 0) {
      throw new Error(`ID Ruangan (${roomId}) tidak valid untuk database.`);
    }

    const payload = {
      p_room_id: numericRoomId,
      p_event_name: (eventName || purpose || '').trim(),
      p_purpose: (purpose || '').trim(),
      p_start_time: startTime,
      p_end_time: endTime,
      p_participants: (participants !== undefined && participants !== null && String(participants).trim() !== '') ? Number(participants) : null,
      p_facilities: Array.isArray(facilities) ? facilities : []
    };

    console.log('🚀 [RoomBookStore] Memanggil RPC create_reservation_safe...', payload);

    const { data, error } = await client.rpc('create_reservation_safe', payload);

    if (error) {
      console.error('❌ [RoomBookStore] RPC create_reservation_safe error:', error);
      throw error;
    }

    console.log('✅ [RoomBookStore] RPC create_reservation_safe berhasil:', data);
    return data;
  }

  /**
   * Mengubah status reservasi (approve/reject/cancel) via Supabase RPC update_reservation_status_safe
   * Menjalankan double-approval prevention dan lock ordering konsisten
   */
  async updateReservationStatusSupabase(reservationId, newStatus, notes = '') {
    const client = window.supabaseClient;
    if (!client) throw new Error('Client Supabase belum siap.');

    const requestedId = String(reservationId).trim();
    const cachedItem = this.reservations.find(r =>
      String(r.id) === requestedId ||
      (r.dbId !== undefined && r.dbId !== null && String(r.dbId) === requestedId)
    );
    const databaseId = /^\d+$/.test(requestedId)
      ? requestedId
      : (cachedItem && cachedItem.dbId !== undefined && cachedItem.dbId !== null ? String(cachedItem.dbId) : null);
    if (!databaseId || !/^\d+$/.test(databaseId) || /^0+$/.test(databaseId)) {
      throw new Error(`ID Reservasi (${reservationId}) tidak valid.`);
    }

    console.log('🚀 [RoomBookStore] Memanggil RPC update_reservation_status_safe...', {
      p_reservation_id: databaseId,
      p_new_status: newStatus,
      p_notes: notes || null
    });

    const { data, error } = await client.rpc('update_reservation_status_safe', {
      p_reservation_id: databaseId,
      p_new_status: newStatus,
      p_notes: notes ? String(notes).trim() : null
    });

    if (error) {
      console.error('❌ [RoomBookStore] RPC update_reservation_status_safe error:', error);
      throw error;
    }

    console.log('✅ [RoomBookStore] RPC update_reservation_status_safe berhasil:', data);
    return data;
  }

  resetToInitial() {
    if (this.dataSource === 'supabase') {
      return this.loadReservationsFromDatabase();
    }
    this.reservations = JSON.parse(JSON.stringify(INITIAL_RESERVATIONS));
    this.saveReservations();
  }

  /**
   * Menambahkan ruangan baru melalui RoomService + memperbarui daftar ruangan di store
   */
  async createRoomSupabase({ name, capacity, floor, facilities, imageFile }) {
    if (typeof window === 'undefined' || !window.RoomService || typeof window.RoomService.createRoom !== 'function') {
      throw new Error('Modul RoomService.createRoom belum tersedia.');
    }

    const { data, error, storageMode } = await window.RoomService.createRoom({
      name,
      capacity,
      floor,
      facilities,
      imageFile
    });

    if (error) {
      throw error;
    }

    this.dataSource = 'supabase';
    await this.loadRoomsFromDatabase();
    this.notify();

    return { data, storageMode };
  }

  /**
   * Menghapus ruangan melalui RoomService + menyegarkan daftar ruangan di store
   */
  async deleteRoomSupabase(roomId) {
    if (typeof window === 'undefined' || !window.RoomService || typeof window.RoomService.deleteRoom !== 'function') {
      throw new Error('Modul RoomService.deleteRoom belum tersedia.');
    }

    const { data, error } = await window.RoomService.deleteRoom(roomId);
    if (error) {
      throw error;
    }

    this.dataSource = 'supabase';
    await this.loadRoomsFromDatabase();
    if (typeof this.loadReservationsFromDatabase === 'function') {
      try {
        await this.loadReservationsFromDatabase();
      } catch (_) {}
    }
    this.notify();

    return data;
  }

  /**
   * Memperbarui data ruangan melalui RoomService + menyegarkan daftar ruangan di store
   */
  async updateRoomSupabase({ roomId, name, capacity, floor, facilities, imageFile }) {
    if (typeof window === 'undefined' || !window.RoomService || typeof window.RoomService.updateRoom !== 'function') {
      throw new Error('Modul RoomService.updateRoom belum tersedia.');
    }

    const { data, error, storageMode } = await window.RoomService.updateRoom({
      roomId,
      name,
      capacity,
      floor,
      facilities,
      imageFile
    });

    if (error) {
      throw error;
    }

    this.dataSource = 'supabase';
    await this.loadRoomsFromDatabase();
    this.notify();

    return { data, storageMode };
  }

  /**
   * Memproses check-in QR tiket melalui RPC check_in_reservation_safe
   */
  async checkInReservationSupabase(reservationId, qrCode = null) {
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!client) throw new Error('Client Supabase belum siap.');

    const rawInput = String(reservationId || '').trim();
    const roombookMatch = rawInput.match(/^ROOMBOOK-(\d+)-(\d+)$/i);
    let numericId = NaN;
    let resolvedQrCode = qrCode ? String(qrCode).trim() : null;

    if (roombookMatch) {
      numericId = parseInt(roombookMatch[1], 10);
      if (!resolvedQrCode) resolvedQrCode = rawInput.toUpperCase();
    } else {
      numericId = parseInt(rawInput.replace(/^RB-/i, ''), 10);
    }

    if (isNaN(numericId) || numericId <= 0) {
      throw new Error(`ID Reservasi (${reservationId}) tidak valid.`);
    }

    const { data, error } = await client.rpc('check_in_reservation_safe', {
      p_reservation_id: numericId,
      p_qr_code: resolvedQrCode
    });

    if (error) throw error;
    await this.loadReservationsFromDatabase();
    return data;
  }

  /**
   * Menandai reservasi approved yang sudah melewati end_time menjadi 'completed'
   */
  async completeExpiredReservationsSupabase() {
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!client) return null;
    try {
      const { data, error } = await client.rpc('complete_expired_reservations');
      if (!error && data && data.completed_count > 0) {
        await this.loadReservationsFromDatabase();
      }
      return data || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Mengaktifkan Supabase Realtime Channel untuk auto-refresh reservasi & ruangan seketika
   */
  initRealtimeSubscription() {
    const client = typeof window !== 'undefined' ? window.supabaseClient : null;
    if (!client || this._realtimeSubscribed) return;
    try {
      this._realtimeSubscribed = true;
      client
        .channel('web_roombook_realtime_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => {
          console.log('⚡ [Realtime] Terdeteksi perubahan reservasi di Supabase. Memperbarui store...');
          this.loadReservationsFromDatabase();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, () => {
          console.log('⚡ [Realtime] Terdeteksi ruangan baru/perubahan di Supabase. Memperbarui daftar ruangan...');
          this.loadRoomsFromDatabase();
        })
        .subscribe();
      console.log('✅ [Supabase Realtime] Berhasil terhubung ke channel reservasi & ruangan.');
    } catch (e) {
      console.warn('Realtime subscription tidak aktif atau dibatasi:', e);
    }
  }
}

// Global store instance
const storeInstance = new AppStore();
if (typeof window !== 'undefined') {
  window.RoomBookStore = storeInstance;
}
if (typeof globalThis !== 'undefined') {
  globalThis.RoomBookStore = storeInstance;
}

