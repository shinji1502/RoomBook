// Supabase Client Initialization for RoomBook
// Menginisialisasi single client Supabase menggunakan anon/publishable key
// Dilengkapi konfigurasi persistensi sesi dan auto refresh token untuk Supabase Auth

(function () {
  'use strict';

  // Base URL project Supabase (mendukung window.ROOMBOOK_CONFIG jika diatur di environment)
  const envConfig = window.ROOMBOOK_CONFIG || {};
  const SUPABASE_URL = envConfig.SUPABASE_URL || 'https://pwdumkxaqlmpcglqcrys.supabase.co';
  const SUPABASE_ANON_KEY = envConfig.SUPABASE_ANON_KEY || 'sb_publishable_lLxuMN0PRBjX5qvkIyOlyQ_Sl22HrzQ';

  if (!window.supabaseClient) {
    const supabaseLib = window.supabase;
    if (supabaseLib && typeof supabaseLib.createClient === 'function') {
      window.supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('✅ [Supabase] Client berhasil diinisialisasi:', SUPABASE_URL);
    } else {
      console.error('❌ [Supabase] Library @supabase/supabase-js belum dimuat sebelum supabaseClient.js.');
    }
  }
})();
