"use client";

// components/FeaturedProjects/FeaturedProjects.tsx

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { PROJECTS } from "@/lib/projects";
import styles from "./FeaturedProjects.module.scss";

export default function FeaturedProjects() {
    const t = useTranslations("projects");
    const locale = useLocale();

    const projects = PROJECTS.filter((p) => p.featured);

    return (
        <section
            className={styles.section}
            aria-labelledby="featured-projects-heading"
        >
            <h3 id="featured-projects-heading" className={styles.heading}>
                {t("heading")}
            </h3>

            {/* [LAMA — pre kinetic-console] Grid 3-kartu seragam.
            <div className={styles.grid}>
                {projects.map((project) => (
                    <article key={project.id} className={styles.card}>
                        <div className={styles.cardTop}>
                            <span
                                className={styles.cardAccent}
                                aria-hidden="true"
                            />

                            <h4 className={styles.cardTitle}>
                                {project.title}
                            </h4>

                            <p className={styles.cardDesc}>
                                {t(`items.${project.id}.description`)}
                            </p>
                        </div>

                        <ul className={styles.tagList} aria-label="Tech stack">
                            {project.tags.map((tag) => (
                                <li key={tag} className={styles.tag}>
                                    {tag}
                                </li>
                            ))}
                        </ul>
                    </article>
                ))}
            </div>
            */}

            {/* [BARU — kinetic-console, Step 3, direvisi] Tracklist bernomor —
            proyek dibaca seperti daftar lagu, deskripsi dapat ruang penuh
            (tidak terpotong seperti di grid 3 kolom lama).
            Awalnya baris sengaja dibuat non-interaktif (lihat catatan lama
            di NOTES step 3) karena belum ada cara membuka detail spesifik
            dari sini. Sekarang baris JADI link ke /projects?project=<id> —
            Projects.tsx membaca query param itu dan otomatis membuka modal
            proyek yang sama, jadi klik dari sini langsung ke listing +
            detail, bukan cuma mendarat di listing kosong. */}
            <ol className={styles.tracks}>
                {projects.map((project, index) => (
                    <li key={project.id}>
                        <Link
                            href={`/${locale}/projects?project=${project.id}`}
                            className={styles.trackLink}
                            aria-label={`${t("viewDetails")} — ${project.title}`}
                        >
                            <article className={styles.track}>
                                <span
                                    className={styles.trackIndex}
                                    aria-hidden="true"
                                >
                                    {String(index + 1).padStart(2, "0")}
                                </span>

                                <div className={styles.trackMain}>
                                    <div className={styles.trackTop}>
                                        <h4 className={styles.trackTitle}>
                                            {project.title}
                                        </h4>
                                        <span
                                            className={[
                                                styles.badge,
                                                styles[
                                                    `badge--${project.status}`
                                                ],
                                            ].join(" ")}
                                        >
                                            {t(`status.${project.status}`)}
                                        </span>
                                        <span className={styles.trackMeta}>
                                            {project.year}
                                            <span aria-hidden="true"> · </span>
                                            {project.category}
                                        </span>
                                    </div>

                                    <p className={styles.trackDesc}>
                                        {t(`items.${project.id}.description`)}
                                    </p>
                                </div>

                                <ul
                                    className={styles.tagList}
                                    aria-label="Tech stack"
                                >
                                    {project.tags.map((tag, index) => (
                                        <li key={tag} className={styles.tag}>
                                            {index === 0 ? tag : ", " + tag}
                                        </li>
                                    ))}
                                </ul>

                                <span
                                    className={styles.trackArrow}
                                    aria-hidden="true"
                                >
                                    <ArrowIcon />
                                </span>
                            </article>
                        </Link>
                    </li>
                ))}
            </ol>

            <Link
                href={`/${locale}/projects`}
                className={styles.viewAll}
                aria-label={t("viewAll")}
            >
                {t("viewAll")}
                <ArrowIcon />
            </Link>
        </section>
    );
}

function ArrowIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
        </svg>
    );
}
