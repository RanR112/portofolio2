"use client";

// components/sections/Dashboard/Dashboard.tsx
// Step 16: Replaced "Recent Activity" with FeaturedProjects + EngineeringPrinciples.

import { useTranslations } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import FeaturedProjects from "@/components/FeaturedProjects/FeaturedProjects";
import EngineeringPrinciples from "@/components/EngineeringPrinciples/EngineeringPrinciples";
import styles from "./Dashboard.module.scss";

const STATS = [
    { valueKey: "2+", labelKey: "years" },
    { valueKey: "10+", labelKey: "projects" },
    { valueKey: "FS", labelKey: "focus" },
    { valueKey: "20+", labelKey: "stack" },
] as const;

export default function Dashboard() {
    const t = useTranslations("dashboard");

    return (
        <SectionWrapper
            id="dashboard"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            {/* Stat cards */}
            <div className={styles.statsGrid} aria-label="Career statistics">
                {STATS.map(({ valueKey, labelKey }) => (
                    <article key={labelKey} className={styles.statCard}>
                        <span className={styles.statValue}>{valueKey}</span>
                        <span className={styles.statLabel}>
                            {t(`stats.${labelKey}`)}
                        </span>
                    </article>
                ))}
            </div>

            {/* Featured Projects */}
            <div className={styles.block}>
                <FeaturedProjects />
            </div>

            {/* Engineering Principles */}
            <div className={styles.block}>
                <EngineeringPrinciples />
            </div>
        </SectionWrapper>
    );
}
