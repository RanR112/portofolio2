// app/loading.tsx
//
// Shown by Next.js App Router while the page chunk is loading.
// Renders the sidebar shell + content skeleton so the layout
// doesn't jump when the real page mounts.

import styles from "./loading.module.scss";

export default function Loading() {
    return (
        <div className={styles.shell}>
            {/* Mimic sidebar width so content doesn't shift */}
            <div className={styles.sidebarGhost} aria-hidden="true" />

            {/* Content skeleton */}
            <div
                className={styles.content}
                aria-busy="true"
                aria-label="Loading"
            >
                {/* Topbar ghost */}
                <div className={styles.topbarGhost} aria-hidden="true" />

                {/* Hero skeleton */}
                <div className={styles.section}>
                    <span className={styles.labelLine} />
                    <span
                        className={styles.titleLine}
                        style={{ width: "60%" } as React.CSSProperties}
                    />
                    <span
                        className={styles.titleLine}
                        style={{ width: "40%" } as React.CSSProperties}
                    />
                    <span
                        className={styles.bodyLine}
                        style={{ width: "85%" } as React.CSSProperties}
                    />
                    <span
                        className={styles.bodyLine}
                        style={{ width: "70%" } as React.CSSProperties}
                    />

                    {/* Stat cards */}
                    <div className={styles.cardRow}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <span key={i} className={styles.card} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
