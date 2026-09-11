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
 *   • onKeyMouseDown / onKeyMouseEnter / onKeyMouseLeave
 *                 — stable refs from usePianoEngine (useCallback, stable deps)
 *
 * Mouse vs touch
 * ──────────────
 * Hanya jalur MOUSE yang ditangani di sini. Sentuhan ditangani engine di
 * level kontainer piano, karena event sentuh terkunci ke elemen pertama yang
 * disentuh — menggeser jari ke tuts lain tidak pernah memicu event di tuts
 * itu, sehingga glissando mustahil dideteksi per-tuts.
 *
 * onMouseUp juga tidak dipasang di sini: tombol mouse bisa dilepas di mana
 * saja (termasuk di luar piano), jadi engine mendengarkannya di dokumen.
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
    /** true → this key is reachable via Ctrl (render its hint underlined) */
    underline?: boolean;
    noteDisplay: string;
    isBlack: boolean;
    isFirst?: boolean;
    leftWhite?: string;
    /** index of the left-adjacent white key — used to position black keys */
    wIdx?: number;
    // Stable function refs from usePianoEngine — never change identity.
    // [BARU] Sejak glissando, jalur mouse memakai handler khusus dari engine
    // (yang melacak status tombol mouse) alih-alih pressNote/releaseNote
    // langsung. Sentuhan TIDAK lagi ditangani di sini — seluruhnya di level
    // kontainer piano, karena event sentuh terkunci ke elemen pertama yang
    // disentuh sehingga menggeser jari tidak pernah memicu event di tuts lain.
    onKeyMouseDown: (noteLabel: string) => void;
    onKeyMouseEnter: (noteLabel: string) => void;
    onKeyMouseLeave: (noteLabel: string) => void;
}

const PianoKey = React.memo(function PianoKey({
    noteLabel,
    keyLabels,
    underline = false,
    noteDisplay,
    isBlack,
    isFirst = false,
    leftWhite,
    wIdx,
    onKeyMouseDown,
    onKeyMouseEnter,
    onKeyMouseLeave,
}: PianoKeyProps) {
    // ── Handlers created once per mount — deps are all constants or stable refs ──
    const onMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            onKeyMouseDown(noteLabel);
        },
        [onKeyMouseDown, noteLabel],
    );

    // [BARU] Masuk ke tuts ini sambil tombol mouse ditahan = glissando.
    // Engine yang memutuskan apakah ini benar-benar glissando atau sekadar
    // kursor lewat; di sini kita cuma melaporkan kejadiannya.
    const onMouseEnter = useCallback(() => {
        onKeyMouseEnter(noteLabel);
    }, [onKeyMouseEnter, noteLabel]);

    const onMouseLeave = useCallback(() => {
        onKeyMouseLeave(noteLabel);
    }, [onKeyMouseLeave, noteLabel]);

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
            data-w-idx={wIdx}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <span
                className={`${styles.keyLabel}${underline ? ` ${styles.underline}` : ""}`}
            >
                {keyLabels}
            </span>
            <span className={styles.noteLabel}>{noteDisplay}</span>
        </div>
    );
});

export default PianoKey;
