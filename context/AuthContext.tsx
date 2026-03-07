"use client";

// context/AuthContext.tsx
//
// Provides auth state (session, user, loading) globally.
// Wraps the app with a single Supabase onAuthStateChange listener.
//
// Why a context and not a Zustand store:
//   Auth state is cross-cutting but read-heavy and rarely updated.
//   Context is the idiomatic React solution. A store would add
//   unnecessary complexity for this use case.
//
// What this provides:
//   - session     — the full Supabase Session object or null
//   - user        — derived User object or null (shorthand for session.user)
//   - isLoading   — true until the first auth check resolves
//   - signInWithGoogle()
//   - signInWithGitHub()
//   - signOut()

import {
    createContext,
    useContext,
    useEffect,
    useState,
    useMemo,
    useCallback,
    type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

// ============================================================
// Types
// ============================================================

type AuthContextValue = {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signInWithGitHub: () => Promise<void>;
    signOut: () => Promise<void>;
};

// ============================================================
// Context
// ============================================================

const AuthContext = createContext<AuthContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // ---- 1. Hydrate session on first mount ----
        // getSession() reads from localStorage (or cookie on SSR).
        // This resolves the initial loading state before the listener fires.
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoading(false);
        });

        // ---- 2. Subscribe to auth state changes ----
        // Fires on: sign-in, sign-out, token refresh, password recovery, etc.
        // This is the single source of truth for session state after hydration.
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            // isLoading is false after the first getSession() resolves.
            // We don't toggle it here to avoid a flash on token refresh.
        });

        // Unsubscribe when the provider unmounts (e.g. during testing)
        return () => subscription.unsubscribe();
    }, []);

    // ---- Sign-in helpers ----

    const signInWithGoogle = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                // After OAuth redirect, Supabase returns the user to this URL.
                // In production, replace with your deployed domain.
                redirectTo: `${window.location.origin}/auth/callback`,

                // Request profile scopes so we get name + avatar
                scopes: "profile email",

                // queryParams can pass hint, prompt etc. if needed:
                // queryParams: { prompt: 'select_account' }
            },
        });
        if (error) {
            console.error("[AuthContext] Google sign-in error:", error.message);
        }
    }, []);

    const signInWithGitHub = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: "github",
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                // Read:user scope gives us name + avatar URL from GitHub
                scopes: "read:user user:email",
            },
        });
        if (error) {
            console.error("[AuthContext] GitHub sign-in error:", error.message);
        }
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error("[AuthContext] Sign-out error:", error.message);
        }
        // Session will be set to null by onAuthStateChange automatically
    }, []);

    // ---- Derived value ----
    const user = session?.user ?? null;

    const value = useMemo<AuthContextValue>(
        () => ({
            session,
            user,
            isLoading,
            signInWithGoogle,
            signInWithGitHub,
            signOut,
        }),
        [session, user, isLoading, signInWithGoogle, signInWithGitHub, signOut],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

// ============================================================
// Consumer hook
// ============================================================

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
