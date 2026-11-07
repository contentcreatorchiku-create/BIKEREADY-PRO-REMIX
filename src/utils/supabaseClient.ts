import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://dcoymtibhysaitrnsyyl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjb3ltdGliaHlzYWl0cm5zeXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0MDM5ODAsImV4cCI6MjEwODk3OTk4MH0.oJGIJ211q88mhQxPeeuz7OUkyBYKr2dnrViXThla9-Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
