// Shared Supabase client for CoastlineGuessr
const SUPABASE_URL = "https://yxkxkebjckzclzpvejkj.supabase.co";
const SUPABASE_KEY = "sb_publishable_6yPZn7RF9Fm49f76nBsavw_HuHuqEiK";

let sb = null;
try {
  if (window.supabase) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) { console.warn("Supabase init failed", e); }

window.CLG_SB = sb;
