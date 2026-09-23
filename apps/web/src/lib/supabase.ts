import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

let browser: SupabaseClient | null = null;

/** Read-only client (publishable key + RLS). Safe in the browser and in server components. */
export function supabase(): SupabaseClient {
  if (!browser) {
    browser = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return browser;
}

/** Full-access client for server routes only. Never import this from a client component. */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("supabaseAdmin() is server-only");
  return createClient(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
}
