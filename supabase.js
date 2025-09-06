// Replace with your values from Supabase Project Settings → API
const SUPABASE_URL = "https://mrsstxabvakkghlbqkne.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc3N0eGFidmFra2dobGJxa25lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcwNTYxOTQsImV4cCI6MjA3MjYzMjE5NH0.tDh9zmIalkPqFEYy20NUO1F74HzUWAD9y5v2Ie7xosk";

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Must be true for OAuth redirect handling
    detectSessionInUrl: true,
  },
});

// (Optional) Expose these if you ever need REST fallbacks elsewhere:
// window.SUPABASE_URL = SUPABASE_URL;
// window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
