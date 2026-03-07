// components/SectionWrapper/SectionWrapper.tsx
//
// Generic layout wrapper applied to every content section.
//
// Wrapped in React.memo: label, title, subtitle are static strings
// passed from static section components. Without memo, every context
// update (e.g. scroll-spy activeId change) would cause all 8 section
// headers to re-render even though nothing about them changed.
//
// Note: children are included in memo's shallow comparison.
// Sections with dynamic children (e.g. CommentUI) will still re-render
// when their children change — memo correctly lets that through.

import { memo, type ReactNode } from "react";
import styles from "./SectionWrapper.module.scss";

type SectionWrapperProps = {
    id: string;
    label: string;
    title: string;
    subtitle?: string;
    children: ReactNode;
    fullWidth?: boolean;
};

const SectionWrapper = memo(function SectionWrapper({
    id,
    label,
    title,
    subtitle,
    children,
    fullWidth = false,
}: SectionWrapperProps) {
    return (
        <section
            id={`section-${id}`}
            className={styles.section}
            aria-labelledby={`heading-${id}`}
        >
            <div
                className={fullWidth ? styles.containerFull : styles.container}
            >
                <header className={styles.header}>
                    <span className={styles.label} aria-hidden="true">
                        {label}
                    </span>

                    <h2 id={`heading-${id}`} className={styles.title}>
                        {title}
                    </h2>

                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}

                    <hr className={styles.divider} aria-hidden="true" />
                </header>

                <div className={styles.body}>{children}</div>
            </div>
        </section>
    );
});

export default SectionWrapper;
