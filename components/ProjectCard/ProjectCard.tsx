"use client";

// components/ProjectCard/ProjectCard.tsx
// Step 20: Text resolved from next-intl translations keyed by project.id.
// Locale-invariant fields (tags, status, year, thumbnail, links) read
// directly from the Project object — unchanged from Step 19.

import { memo, useRef } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Project } from "@/lib/projects";
import styles from "./ProjectCard.module.scss";

type ProjectCardProps = {
    project: Project;
    onViewDetails?: (id: string, ref: React.RefObject<HTMLElement>) => void;
};

const ProjectCard = memo(function ProjectCard({
    project,
    onViewDetails,
}: ProjectCardProps) {
    const {
        id,
        title,
        tags,
        category,
        status,
        year,
        thumbnail,
        repoUrl,
        liveUrl,
    } = project;
    const t = useTranslations("projects");
    const detailsBtnRef = useRef<HTMLButtonElement>(null);

    // Text resolved from messages — fallback is the key itself if missing
    const description = t(`items.${id}.description`);
    const statusLabel = t(`status.${status}`);

    const handleCardClick = () => {
        if (!onViewDetails) return;

        onViewDetails(id, detailsBtnRef as React.RefObject<HTMLElement>);
    };

    return (
        <article
            className={styles.card}
            aria-label={`Project: ${title}`}
            onClick={handleCardClick}
        >
            <span className={styles.cardAccentLine} aria-hidden="true" />

            {/* Thumbnail */}
            <div className={styles.thumbnailWrap}>
                <Image
                    src={thumbnail}
                    alt={`${title} preview`}
                    fill
                    className={styles.thumbnail}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                />
            </div>

            {/* Body */}
            <div className={styles.body}>
                {/* Meta row */}
                <div className={styles.cardHeader}>
                    <div className={styles.cardMeta}>
                        <span className={styles.cardYear}>{year}</span>
                        <span className={styles.cardDot}>•</span>
                        <span className={styles.cardCategory}>{category}</span>
                        <span
                            className={[
                                styles.cardStatus,
                                styles[`cardStatus--${status}`],
                            ].join(" ")}
                        >
                            {statusLabel}
                        </span>
                    </div>

                    <div className={styles.cardLinks}>
                        {repoUrl && (
                            <a
                                href={repoUrl}
                                className={styles.cardLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${title} repository`}
                                title="Repository"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <RepoIcon />
                            </a>
                        )}
                        {liveUrl && (
                            <a
                                href={liveUrl}
                                className={styles.cardLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`${title} live site`}
                                title="Live site"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <ExternalLinkIcon />
                            </a>
                        )}
                    </div>
                </div>

                {/* Title + description */}
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDescription}>{description}</p>

                {/* Footer */}
                <footer className={styles.cardFooter}>
                    <ul
                        className={styles.tagList}
                        aria-label="Technologies used"
                    >
                        {tags.slice(0, 2).map((tag) => (
                            <li key={tag} className={styles.tag}>
                                {tag}
                            </li>
                        ))}

                        {tags.length > 2 && (
                            <li className={styles.tagMore}>
                                +{tags.length - 2}
                            </li>
                        )}
                    </ul>

                    {onViewDetails && (
                        <button
                            ref={detailsBtnRef}
                            className={styles.detailsButton}
                            onClick={() =>
                                onViewDetails(
                                    id,
                                    detailsBtnRef as React.RefObject<HTMLElement>,
                                )
                            }
                            aria-label={`${t("viewDetails")} — ${title}`}
                        >
                            {t("viewDetails")}
                            <ArrowIcon />
                        </button>
                    )}
                </footer>
            </div>
        </article>
    );
});

export default ProjectCard;

function RepoIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
    );
}

function ExternalLinkIcon() {
    return (
        <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

function ArrowIcon() {
    return (
        <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
        </svg>
    );
}
