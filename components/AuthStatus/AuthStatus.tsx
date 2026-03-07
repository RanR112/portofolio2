"use client";

// components/AuthStatus/AuthStatus.tsx
//
// Consumed by Topbar. Three states:
//   isLoading  → skeleton placeholder (prevents layout shift)
//   user       → UserMenu (avatar + name + logout)
//   no user    → Single "Login" button that opens AuthModal
//
// The AuthModal is mounted here (not in Topbar) so the modal's
// triggerRef can point to the login button for focus-return on close.

import { useRef, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import AuthModal from "@/components/AuthModal/AuthModal";
import UserMenu from "@/components/UserMenu/UserMenu";
import styles from "./AuthStatus.module.scss";

export default function AuthStatus() {
    const { user, isLoading } = useAuth();
    const [modalOpen, setModalOpen] = useState(false);
    const loginButtonRef = useRef<HTMLButtonElement>(null);

    const openModal = useCallback(() => setModalOpen(true), []);
    const closeModal = useCallback(() => setModalOpen(false), []);

    if (isLoading) {
        return <div className={styles.skeleton} aria-hidden="true" />;
    }

    if (user) {
        return <UserMenu />;
    }

    return (
        <>
            <button
                ref={loginButtonRef}
                className={styles.loginButton}
                onClick={openModal}
                aria-haspopup="dialog"
                aria-expanded={modalOpen}
                aria-label="Open sign in dialog"
            >
                <KeyIcon />
                <span>Login</span>
            </button>

            <AuthModal
                isOpen={modalOpen}
                onClose={closeModal}
                triggerRef={loginButtonRef}
            />
        </>
    );
}

// Small key icon — fits the music/studio theme
function KeyIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="M21 2l-9.6 9.6" />
            <path d="M15.5 7.5l3 3" />
            <path d="M18 5l3 3" />
        </svg>
    );
}
