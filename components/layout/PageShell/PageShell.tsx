// components/layout/PageShell/PageShell.tsx
//
// Shared wrapper used by every page.
// Replaces the single-page MainContent role:
//   - Renders the sticky Topbar
//   - Provides the #main-content skip-nav target
//   - Passes children through (each page renders its own section)
//
// No scroll spy — active state is now pathname-driven.
"use client";
import Topbar from "@/components/layout/Topbar/Topbar";
import styles from "./PageShell.module.scss";

export default function PageShell({ children }: { children: React.ReactNode }) {
    return (
        <div className={styles.wrapper}>
            <Topbar />
            <main id="main-content" className={styles.content}>
                {children}
            </main>
        </div>
    );
}
