// app/not-found.tsx
//
// Rendered when Next.js cannot match a route.
// Kept intentionally minimal — same card pattern as error.tsx.

import type { Metadata } from "next";
import styles from "./error.module.scss"; // reuse error card styles
import Link from "next/link";

export const metadata: Metadata = {
    title: "404 — Page not found",
};

export default function NotFound() {
    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <div
                    className={styles.iconWrap}
                    style={
                        {
                            color: "var(--color-accent)",
                            backgroundColor: "var(--color-accent-dim)",
                            borderColor: "rgba(201,168,108,0.2)",
                        } as React.CSSProperties
                    }
                    aria-hidden="true"
                >
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
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                </div>

                <h1 className={styles.title}>Page not found</h1>

                <p className={styles.message}>
                    The page you're looking for doesn't exist or has been moved.
                </p>

                <div className={styles.actions}>
                    <Link href="/" className={styles.buttonPrimary}>
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}
