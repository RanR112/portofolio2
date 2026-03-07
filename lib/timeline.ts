// lib/timeline.ts
// Step 21: Text fields moved to messages/[locale].json under
// timeline.journey.[id] and timeline.career.[id].
// Components resolve text via useTranslations('timeline').
// Only locale-invariant fields remain here.

export type TimelineMode = "journey" | "career";

export type TimelinePhase = {
    id: string;
    company?: string;
    period: string; // e.g. "2019 — 2020"  — dates are locale-invariant
    isCurrent?: boolean; // marks the active phase (drives visual badge)
};

// ── Journey dataset ────────────────────────────────────────────────────────
// Personal learning arc — 5 phases.
export const JOURNEY_PHASES: TimelinePhase[] = [
    { id: "exploration", period: "2023" },
    { id: "structured", period: "2023 — 2024" },
    { id: "creative", period: "2024" },
    { id: "systems", period: "2025" },
    { id: "production", period: "2025 — 2026", isCurrent: true },
];

// ── Career dataset ─────────────────────────────────────────────────────────
// Professional development arc — 4 phases.
export const CAREER_PHASES: TimelinePhase[] = [
    { id: "bala-teater-initial", company: "Bala Teater", period: "Jun 2024" },
    { id: "bimba-ife", company: "Bimba IFE", period: "Jul 2024" },
    { id: "bala-teater-redesign", company: "Bala Teater", period: "Feb 2025" },
    { id: "kanban-request", company: "PT Automotive Fasteners Aoyama Indonesia", period: "Apr 2025 — Mei 2025"},
    { id: "kaizen-code", company: "KaizenCode", period: "Jan 2025 — Jun 2025"},
    { id: "enerkomp-intern", company: "PT Enerkomp Persada Raya", period: "Jul 2025 — Jan 2026"},
    { id: "segaratech", company: "SegaraTech", period: "Jun 2025 — Present", isCurrent: true },
];

// Convenience map — index by mode for clean lookup in the component
export const PHASES_BY_MODE: Record<TimelineMode, TimelinePhase[]> = {
    journey: JOURNEY_PHASES,
    career: CAREER_PHASES,
};
