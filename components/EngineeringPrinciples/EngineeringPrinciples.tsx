"use client";

// components/EngineeringPrinciples/EngineeringPrinciples.tsx

import { useTranslations } from "next-intl";
import styles from "./EngineeringPrinciples.module.scss";

// Icon map — inline SVG, no library dependency
function PrincipleIcon({ name }: { name: string }) {
    const icons: Record<string, React.ReactNode> = {
        performance: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden="true"
            >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
        ),
        architecture: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden="true"
            >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
        ),
        userCentered: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden="true"
            >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
        ),
        learning: (
            <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                aria-hidden="true"
            >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
            </svg>
        ),
    };

    return <span className={styles.icon}>{icons[name]}</span>;
}

const PRINCIPLES = [
    "performance",
    "architecture",
    "userCentered",
    "learning",
] as const;

export default function EngineeringPrinciples() {
    const t = useTranslations("engineeringPrinciples");

    return (
        <section
            className={styles.section}
            aria-labelledby="engineering-principles-heading"
        >
            <h3 id="engineering-principles-heading" className={styles.heading}>
                {t("heading")}
            </h3>

            <ul className={styles.list}>
                {PRINCIPLES.map((key, index) => (
                    <li key={key} className={styles.item}>
                        <div className={styles.itemLeft}>
                            <PrincipleIcon name={key} />
                            <span className={styles.number} aria-hidden="true">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                        </div>
                        <div className={styles.itemBody}>
                            <h4 className={styles.itemTitle}>
                                {t(`principles.${key}.title`)}
                            </h4>
                            <p className={styles.itemDesc}>
                                {t(`principles.${key}.description`)}
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    );
}
