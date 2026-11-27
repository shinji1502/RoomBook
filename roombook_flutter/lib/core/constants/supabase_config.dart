/// Konfigurasi Supabase untuk RoomBook Flutter
/// Mendukung environment override via --dart-define (misal: --dart-define=SUPABASE_URL=...)
class SupabaseConfig {
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://pwdumkxaqlmpcglqcrys.supabase.co',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: 'sb_publishable_lLxuMN0PRBjX5qvkIyOlyQ_Sl22HrzQ',
  );
}


