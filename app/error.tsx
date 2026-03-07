"use client";

// app/error.tsx
//
// Next.js App Router global error boundary.
// Catches unhandled exceptions that bubble up from any Server or Client
// Component in the route segment. Renders a minimal recovery UI.
//
// Key constraints:
//   - Must be a Client Component ('use client')
//   - Receives `error` (the thrown Error) and `reset` (retry callback)
//   - Rendered outside the normal layout — keep it self-contained
//   - Does NOT catch errors in layout.tsx (use global-error.tsx for that)

import { useEffect } from "react";
import styles from "./error.module.scss";
import Link from "next/link";

type ErrorPageProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
    useEffect(() => {
        // Log to your error monitoring service here (Sentry, etc.)
        console.error("[ErrorBoundary]", error);
    }, [error]);

    return (
        <div className={styles.container} role="alert" aria-live="assertive">
            <div className={styles.card}>
                {/* Icon */}
                <div className={styles.iconWrap} aria-hidden="true">
                    <ErrorIcon />
                </div>

                {/* Heading */}
                <h1 className={styles.title}>Something went wrong</h1>

                {/* Message */}
                <p className={styles.message}>
                    An unexpected error occurred. This has been noted — try
                    refreshing the page or clicking below to retry.
                </p>

                {/* Digest — shown only in development for quick debugging */}
                {/* {process.env.NODE_ENV === "development" && error.message && (
                    <pre className={styles.digest} aria-label="Error details">
                        {error.message}
                    </pre>
                )} */}

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        className={styles.buttonPrimary}
                        onClick={reset}
                        aria-label="Retry"
                    >
                        Try again
                    </button>

                    <Link
                        href="/"
                        className={styles.buttonSecondary}
                        aria-label="Return to home"
                    >
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}

function ErrorIcon() {
    return (
        <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
    );
}
