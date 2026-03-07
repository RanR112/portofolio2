"use client";

// components/sections/CareerTimeline/CareerTimeline.tsx
// Step 21: Mode toggle (Journey | Career) + full i18n.
// Default mode: journey (personal learning arc).

import { useState } from "react";
import { useTranslations } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import TimelineItem from "@/components/TimelineItem/TimelineItem";
import { PHASES_BY_MODE, type TimelineMode } from "@/lib/timeline";
import styles from "./CareerTimeline.module.scss";

const MODES: TimelineMode[] = ["journey", "career"];

export default function CareerTimeline() {
    const t = useTranslations("timeline");
    const [mode, setMode] = useState<TimelineMode>("journey");

    const phases = PHASES_BY_MODE[mode];

    return (
        <SectionWrapper
            id="timeline"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            {/* ── Mode toggle ── */}
            <div
                className={styles.toggleWrap}
                role="group"
                aria-label="Timeline mode"
            >
                {MODES.map((m) => (
                    <button
                        key={m}
                        className={[
                            styles.toggleBtn,
                            mode === m ? styles.toggleBtnActive : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        onClick={() => setMode(m)}
                        aria-pressed={mode === m}
                    >
                        {t(`mode.${m}`)}
                    </button>
                ))}
            </div>

            {/* ── Timeline list ── */}
            <ol
                className={styles.list}
                aria-label={`${t(`mode.${mode}`)} timeline`}
                aria-live="polite"
            >
                {phases.map((phase, index) => (
                    <TimelineItem
                        key={`${mode}-${phase.id}`}
                        phase={phase}
                        mode={mode}
                        isLast={index === phases.length - 1}
                    />
                ))}
            </ol>
        </SectionWrapper>
    );
}
