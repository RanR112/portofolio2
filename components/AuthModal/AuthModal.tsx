"use client";

// components/AuthModal/AuthModal.tsx
// Step 13: privacy policy link added to disclaimer.

import {
    useEffect,
    useRef,
    useCallback,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useAuth } from "@/context/AuthContext";
import styles from "./AuthModal.module.scss";

type AuthModalProps = {
    isOpen: boolean;
    onClose: () => void;
    // Ref to the element that opened the modal — focus returns here on close
    triggerRef?: React.RefObject<HTMLElement | null>;
};

export default function AuthModal({
    isOpen,
    onClose,
    triggerRef,
}: AuthModalProps) {
    const { signInWithGoogle, signInWithGitHub, isLoading } = useAuth();
    const t = useTranslations("auth");
    const locale = useLocale();

    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // ---- Lock body scroll while open ----
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            // Move focus into modal on open
            requestAnimationFrame(() => closeButtonRef.current?.focus());
        } else {
            document.body.style.overflow = "";
            // Return focus to trigger on close
            triggerRef?.current?.focus();
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen, triggerRef]);

    // ---- ESC key closes modal ----
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // ---- Focus trap — Tab / Shift+Tab cycle within the dialog ----
    const handleKeyDown = useCallback(
        (e: ReactKeyboardEvent<HTMLDivElement>) => {
            if (e.key !== "Tab") return;

            const dialog = dialogRef.current;
            if (!dialog) return;

            const focusable = dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        },
        [],
    );

    // ---- Backdrop click closes modal ----
    const handleBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            // Only close if the backdrop itself was clicked, not the dialog panel
            if (e.target === e.currentTarget) onClose();
        },
        [onClose],
    );

    // Don't render at all when closed — keeps DOM clean
    if (!isOpen) return null;

    return (
        <div
            className={styles.backdrop}
            onClick={handleBackdropClick}
            aria-hidden={!isOpen}
        >
            <div
                ref={dialogRef}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className={styles.header}>
                    <div className={styles.headerText}>
                        <p className={styles.eyebrow}>{t("eyebrow")}</p>
                        <h2 id="auth-modal-title" className={styles.title}>
                            {t("title")}
                        </h2>
                    </div>

                    <button
                        ref={closeButtonRef}
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Close sign in modal"
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Divider */}
                <div className={styles.divider} aria-hidden="true" />

                {/* Body */}
                <div className={styles.body}>
                    <p className={styles.description}>{t("description")}</p>

                    <div className={styles.providerList}>
                        {/* Google */}
                        <button
                            className={[
                                styles.providerButton,
                                styles.providerGoogle,
                            ].join(" ")}
                            onClick={signInWithGoogle}
                            disabled={isLoading}
                            aria-label={t("google")}
                        >
                            <GoogleIcon />
                            <span>{t("google")}</span>
                        </button>

                        {/* GitHub */}
                        <button
                            className={[
                                styles.providerButton,
                                styles.providerGitHub,
                            ].join(" ")}
                            onClick={signInWithGitHub}
                            disabled={isLoading}
                            aria-label={t("github")}
                        >
                            <GitHubIcon />
                            <span>{t("github")}</span>
                        </button>
                    </div>

                    <p className={styles.disclaimer}>
                        {t("privacy")}{" "}
                        <Link
                            href={`/${locale}/privacy-policy`}
                            className={styles.privacyLink}
                            onClick={onClose}
                        >
                            {t("privacyLink")}
                        </Link>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}

// ---- Icons ----

function CloseIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
            />
            <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
            />
            <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
            />
            <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
            />
        </svg>
    );
}

function GitHubIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
        </svg>
    );
}
