export const env = {
  apiBaseUrl:
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    'https://chxnlpjgndfeynwwigfu.supabase.co/functions/v1',
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  googleMapsApiKeyAndroid: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID ?? '',
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    'https://chxnlpjgndfeynwwigfu.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
} as const;

