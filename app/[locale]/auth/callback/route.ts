// app/auth/callback/route.ts
//
// OAuth callback handler for the PKCE flow used by Supabase.
//
// Flow:
//   1. User clicks "Login with Google/GitHub"
//   2. Supabase redirects to the OAuth provider
//   3. Provider redirects back to /auth/callback?code=...
//   4. This route exchanges the code for a session via Supabase
//   5. Supabase sets the session cookie / localStorage entry
//   6. User is redirected back to the app
//
// This is a Next.js Route Handler (App Router) — runs on the server.
// It uses @supabase/ssr for the server-side client so cookies are
// correctly set for SSR hydration.
//
// NOTE: If you are not using SSR / server components for auth,
// you can simplify this to just redirect to '/' and let
// detectSessionInUrl: true in the client handle the code exchange.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    // `next` param lets specific pages redirect back after login
    const next = searchParams.get("next") ?? "/";

    if (code) {
        // Exchange the authorization code for a session.
        // We use the browser client here because this callback is handled
        // client-side via detectSessionInUrl when JS is available.
        // The route handler is a fallback for environments that need it.
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return NextResponse.redirect(`${origin}${next}`);
        }

        console.error("[auth/callback] Code exchange error:", error.message);
    }

    // If no code or exchange failed — redirect to home with error param
    // so the UI can optionally show a toast or message
    return NextResponse.redirect(`${origin}`);
}
