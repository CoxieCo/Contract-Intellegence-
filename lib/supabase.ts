import { createClient } from "@supabase/supabase-js";

// Service role key, not the anon key — every call site is a server-only
// Next.js route handler (app/api/**/route.ts), never a client component, so
// there's no reason to ship a key capable of read/write into the browser
// bundle. RLS policies for the anon role have been dropped in Supabase
// directly; this key bypasses RLS entirely, so it must never be exposed
// client-side (no NEXT_PUBLIC_ prefix).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
