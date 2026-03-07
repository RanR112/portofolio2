/**
 * PianoKey.tsx
 *
 * Performance contract
 * ─────────────────────
 * This component receives ONLY stable props:
 *   • noteLabel   — a string constant, never changes
 *   • keyLabels   — a string constant, never changes
 *   • noteDisplay — a string constant, never changes
 *   • isBlack     — a boolean constant, never changes
 *   • isFirst     — a boolean constant, never changes
 *   • leftWhite   — a string constant or undefined, never changes
 *   • pressNote   — a stable ref from usePianoEngine (useCallback with [] deps)
 *   • releaseNote — a stable ref from usePianoEngine (useCallback with [] deps)
 *
 * Because ALL props are either primitives that never change or stable function
 * references, React.memo provides a hard guarantee: this component re-renders
 * ZERO times after mount, regardless of what the parent is doing.
 *
 * Event handlers are created ONCE via useCallback inside the component.
 * They close over noteLabel (constant string) and pressNote/releaseNote
 * (stable refs), so they are themselves stable and never recreated.
 *
 * Active-state styling is handled by the parent engine via classList.add/remove
 * directly on the DOM node — zero React state, zero re-renders.
 */

import React, { useCallback } from "react";
import styles from "./PianoKey.module.scss";

interface PianoKeyProps {
    noteLabel: string;
    keyLabels: string;
    noteDisplay: string;
    isBlack: boolean;
    isFirst?: boolean;
    leftWhite?: string;
    // Stable function refs from usePianoEngine — never change identity
    pressNote: (noteLabel: string) => void;
    releaseNote: (noteLabel: string) => void;
}

const PianoKey = React.memo(function PianoKey({
    noteLabel,
    keyLabels,
    noteDisplay,
    isBlack,
    isFirst = false,
    leftWhite,
    pressNote,
    releaseNote,
}: PianoKeyProps) {
    // ── Handlers created once per mount — deps are all constants or stable refs ──
    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            pressNote(noteLabel);
        },
        [pressNote, noteLabel],
    );

    const onMouseUp = useCallback(() => {
        releaseNote(noteLabel);
    }, [releaseNote, noteLabel]);

    const onMouseLeave = useCallback(() => {
        releaseNote(noteLabel);
    }, [releaseNote, noteLabel]);

    const onTouchStart = useCallback(
        (e: React.TouchEvent) => {
            e.preventDefault();
            pressNote(noteLabel);
        },
        [pressNote, noteLabel],
    );

    const onTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            e.preventDefault();
            releaseNote(noteLabel);
        },
        [releaseNote, noteLabel],
    );

    // ── Class name computed once — never changes after mount ─────────────────
    const className = isBlack
        ? styles.blackKey
        : [styles.whiteKey, isFirst ? styles.firstKey : ""]
              .filter(Boolean)
              .join(" ");

    return (
        <div
            className={className}
            data-note={noteLabel}
            data-is-black={isBlack ? "true" : undefined}
            data-left-white={leftWhite}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseLeave}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            onTouchCancel={onTouchEnd}
        >
            <span className={styles.keyLabel}>{keyLabels}</span>
            <span className={styles.noteLabel}>{noteDisplay}</span>
        </div>
    );
});

export default PianoKey;
