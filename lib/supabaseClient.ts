// lib/supabaseClient.ts
//
// Single Supabase client instance for the entire application.
//
// Rules:
//   - One instance only — created once and reused (module-level singleton)
//   - Reads credentials from environment variables exclusively
//   - NEXT_PUBLIC_ prefix makes these available on the client bundle;
//     they are safe to expose (anon key is designed to be public)
//   - Never import a service-role key here — that belongs server-side only
//
// Usage:
//   import { supabase } from '@/lib/supabaseClient'

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
    throw new Error(
        "[supabaseClient] Missing environment variables.\n" +
            "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
            "are set in your .env.local file.",
    );
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
    auth: {
        // Persist session to localStorage so the user stays logged in
        // across page refreshes and new tabs
        persistSession: true,

        // Automatically refresh the access token before it expires
        autoRefreshToken: true,

        // Detect OAuth redirect callbacks (hash fragment or query params)
        // and exchange the code for a session automatically
        detectSessionInUrl: true,

        // Storage key — namespaced to avoid collisions with other apps
        // on the same localhost during development
        storageKey: "portfolio-auth-token",
    },
});
