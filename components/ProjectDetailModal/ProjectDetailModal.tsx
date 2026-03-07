"use client";

// components/ProjectDetailModal/ProjectDetailModal.tsx
// Step 20: All UI strings resolved via useTranslations('projects').
// Project text (title, description, longDescription) read from
// messages projects.items.[id] keyed by project.id.

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Project } from "@/lib/projects";
import styles from "./ProjectDetailModal.module.scss";

type Props = {
    project: Project | null;
    onClose: () => void;
    triggerRef: React.RefObject<HTMLElement>;
};

export default function ProjectDetailModal({
    project,
    onClose,
    triggerRef,
}: Props) {
    const t = useTranslations("projects");
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);
    const isOpen = project !== null;

    // ---- Focus trap + ESC ----
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!dialogRef.current) return;

            if (e.key === "Escape") {
                onClose();
                return;
            }
            if (e.key !== "Tab") return;

            const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
                ),
            );
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        },
        [onClose],
    );

    useEffect(() => {
        if (!isOpen) return;

        const triggerEl = triggerRef.current;

        // Lock body scroll
        document.body.style.overflow = "hidden";

        // Focus close button
        requestAnimationFrame(() => closeBtnRef.current?.focus());

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = "";
            document.removeEventListener("keydown", handleKeyDown);

            // Return focus to trigger element
            triggerEl?.focus();
        };
    }, [isOpen, handleKeyDown, triggerRef]);

    if (!project) return null;

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

    // Translated text — all keyed by project id
    const description = t(`items.${id}.description`);
    const longDescription = t(`items.${id}.longDescription`);
    const statusLabel = t(`status.${status}`);

    // Modal UI labels
    const labelOverview = t("modal.overview");
    const labelTechStack = t("modal.techStack");
    const labelLinks = t("modal.links");
    const labelGithub = t("modal.github");
    const labelLiveDemo = t("modal.liveDemo");
    const labelClose = t("modal.close");

    return (
        <div
            className={styles.backdrop}
            onClick={onClose}
            role="presentation"
            aria-hidden="true"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                className={styles.dialog}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close */}
                <button
                    ref={closeBtnRef}
                    className={styles.closeBtn}
                    onClick={onClose}
                    aria-label={labelClose}
                >
                    <CloseIcon />
                </button>

                <div className={styles.content}>
                    {/* Thumbnail */}
                    <div className={styles.thumbnailWrap}>
                        <Image
                            src={thumbnail}
                            alt={`${title} screenshot`}
                            fill
                            className={styles.thumbnail}
                            sizes="(max-width: 900px) 100vw, 900px"
                            priority
                        />
                    </div>

                    {/* Header */}
                    <div className={styles.header}>
                        <div className={styles.meta}>
                            <span className={styles.year}>{year}</span>
                            <span className={styles.dot}>•</span>
                            <span className={styles.category}>
                                {category}
                            </span>
                            <span
                                className={[
                                    styles.status,
                                    styles[`status--${status}`],
                                ].join(" ")}
                            >
                                {statusLabel}
                            </span>
                        </div>
                        <h2 id="modal-title" className={styles.title}>
                            {title}
                        </h2>
                        <p className={styles.description}>{description}</p>
                    </div>

                    <div className={styles.divider} aria-hidden="true" />

                    {/* Long description */}
                    <div className={styles.body}>
                        <h3 className={styles.sectionLabel}>{labelOverview}</h3>
                        <p className={styles.bodyText}>{longDescription}</p>
                    </div>

                    {/* Tech stack */}
                    <div className={styles.stack}>
                        <h3 className={styles.sectionLabel}>
                            {labelTechStack}
                        </h3>
                        <ul
                            className={styles.tagList}
                            aria-label={labelTechStack}
                        >
                            {tags.map((tag) => (
                                <li key={tag} className={styles.tag}>
                                    {tag}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Links */}
                    {(repoUrl || liveUrl) && (
                        <div className={styles.links}>
                            <h3 className={styles.sectionLabel}>
                                {labelLinks}
                            </h3>
                            <div className={styles.linkRow}>
                                {repoUrl && (
                                    <a
                                        href={repoUrl}
                                        className={styles.linkBtn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`${title} — ${labelGithub}`}
                                    >
                                        <GithubIcon />
                                        {labelGithub}
                                    </a>
                                )}
                                {liveUrl && (
                                    <a
                                        href={liveUrl}
                                        className={[
                                            styles.linkBtn,
                                            styles.linkBtnPrimary,
                                        ].join(" ")}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label={`${title} — ${labelLiveDemo}`}
                                    >
                                        <ExternalIcon />
                                        {labelLiveDemo}
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CloseIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function GithubIcon() {
    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
    );
}

function ExternalIcon() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
        >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}
