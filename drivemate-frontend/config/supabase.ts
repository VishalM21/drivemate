import { createClient } from '@supabase/supabase-js';

import { env } from './env';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false, // We use Firebase auth and custom JWT via authStore
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
