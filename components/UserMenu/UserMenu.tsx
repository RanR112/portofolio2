"use client";

// components/UserMenu/UserMenu.tsx
//
// Displayed in the Topbar when the user is authenticated.
// Shows: avatar → display name → logout button
//
// Avatar resolution order:
//   1. user_metadata.avatar_url — set by OAuth providers
//   2. user_metadata.picture    — some providers use this key
//   3. Fallback: initials circle generated from display name
//
// Display name resolution:
//   1. user_metadata.full_name
//   2. user_metadata.name
//   3. user.email (truncated before @)

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./UserMenu.module.scss";

export default function UserMenu() {
    const { user, signOut } = useAuth();
    const [isSigningOut, setIsSigningOut] = useState(false);

    if (!user) return null;

    // ---- Resolve display values from OAuth metadata ----
    const meta = user.user_metadata ?? {};
    const avatarUrl: string | undefined =
        meta.avatar_url ?? meta.picture ?? undefined;
    const displayName: string =
        meta.full_name ?? meta.name ?? user.email?.split("@")[0] ?? "User";

    // Initials for fallback avatar — first letter of each word, max 2
    const initials = displayName
        .split(" ")
        .slice(0, 2)
        .map((word: string) => word[0]?.toUpperCase() ?? "")
        .join("");

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await signOut();
        // isSigningOut resets when component unmounts after session clears
    };

    return (
        <div className={styles.menu}>
            {/* Avatar */}
            <div className={styles.avatar} aria-hidden="true">
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className={styles.avatarImage}
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <span className={styles.avatarInitials}>{initials}</span>
                )}
            </div>

            {/* Display name */}
            <span className={styles.name} title={user.email}>
                {displayName}
            </span>

            {/* Logout button */}
            <button
                className={styles.signOutButton}
                onClick={handleSignOut}
                disabled={isSigningOut}
                aria-label="Sign out"
                title="Sign out"
            >
                {isSigningOut ? (
                    <span className={styles.spinner} aria-hidden="true" />
                ) : (
                    <SignOutIcon />
                )}
            </button>
        </div>
    );
}

function SignOutIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
    );
}
