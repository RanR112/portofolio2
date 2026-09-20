"use client";

// components/sections/Dashboard/Dashboard.tsx
// Step 16: Replaced "Recent Activity" with FeaturedProjects + EngineeringPrinciples.

import { useTranslations } from "next-intl";
import Image from "next/image";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import FeaturedProjects from "@/components/FeaturedProjects/FeaturedProjects";
import EngineeringPrinciples from "@/components/EngineeringPrinciples/EngineeringPrinciples";
import Reveal from "@/components/ui/Reveal/Reveal";
import { ProfilePhoto } from "@/assets/index.assets";
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
            size="hero" // [BARU — kinetic-console, Step 2]
            titleAside={
                // [BARU] Foto profil di sebelah kanan "Randy Rafael". Above
                // the fold (bagian pertama yang terlihat di halaman), jadi
                // priority di-set — beda dari pemakaian Image lain di situs
                // yang semuanya di bawah lipatan.
                <div className={styles.photoWrap}>
                    <Image
                        src={ProfilePhoto}
                        alt={t("photoAlt")}
                        fill
                        className={styles.photo}
                        sizes="(max-width: 640px) 112px, 180px"
                        priority
                    />
                </div>
            }
        >
            {/* Stat cards */}
            <Reveal>
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
            </Reveal>

            {/* Featured Projects */}
            <Reveal delay={80} className={styles.block}>
                <FeaturedProjects />
            </Reveal>

            {/* Engineering Principles */}
            <Reveal delay={160} className={styles.block}>
                <EngineeringPrinciples />
            </Reveal>
        </SectionWrapper>
    );
}
