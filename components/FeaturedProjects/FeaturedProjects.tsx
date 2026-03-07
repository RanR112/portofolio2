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
