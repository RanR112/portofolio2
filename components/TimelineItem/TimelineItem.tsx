"use client";

// components/TimelineItem/TimelineItem.tsx
// Step 21: Text resolved from next-intl translations.
// phase.title, phase.phase, phase.description, phase.highlights
// are all read from messages timeline.[mode].[id].
// The "Current" badge label is also translated.

import { memo } from "react";
import { useTranslations } from "next-intl";
import type { TimelinePhase, TimelineMode } from "@/lib/timeline";
import styles from "./TimelineItem.module.scss";

type TimelineItemProps = {
    phase: TimelinePhase;
    mode: TimelineMode;
    isLast: boolean;
};

const TimelineItem = memo(function TimelineItem({
    phase,
    mode,
    isLast,
}: TimelineItemProps) {
    const t = useTranslations("timeline");

    const phaseLabel = t(`${mode}.${phase.id}.phase`);
    const title = phase.company ? phase.company : t(`${mode}.${phase.id}.title`);
    const description = t(`${mode}.${phase.id}.description`);
    // highlights is a JSON array — next-intl returns it as an array via raw()
    // We use t.raw() which returns the raw value from messages without formatting
    const highlights = t.raw(`${mode}.${phase.id}.highlights`) as string[];
    const currentLabel = t("current");

    return (
        <li
            className={[styles.item, phase.isCurrent ? styles.itemCurrent : ""]
                .filter(Boolean)
                .join(" ")}
        >
            {/* Left column: marker + vertical connector */}
            <div className={styles.spine} aria-hidden="true">
                <div className={styles.marker}>
                    {phase.isCurrent && <span className={styles.markerPulse} />}
                </div>
                {!isLast && <div className={styles.connector} />}
            </div>

            {/* Right column: date label + card */}
            <div className={styles.content}>
                <div className={styles.meta}>
                    <span className={styles.period}>{phase.period}</span>
                    <span className={styles.phaseLabel}>{phaseLabel}</span>
                </div>

                <article className={styles.card} aria-label={title}>
                    <h3 className={styles.cardTitle}>{title}</h3>

                    <p className={styles.cardDescription}>{description}</p>

                    {Array.isArray(highlights) && highlights.length > 0 && (
                        <ul
                            className={styles.highlights}
                            aria-label="Key highlights"
                        >
                            {highlights.map((item, i) => (
                                <li key={i} className={styles.highlight}>
                                    <span
                                        className={styles.highlightDot}
                                        aria-hidden="true"
                                    />
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {phase.isCurrent && (
                        <div
                            className={styles.currentBadge}
                            aria-label={currentLabel}
                        >
                            {currentLabel}
                        </div>
                    )}
                </article>
            </div>
        </li>
    );
});

export default TimelineItem;
