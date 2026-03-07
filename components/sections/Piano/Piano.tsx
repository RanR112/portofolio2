"use client";

/**
 * Piano.tsx
 *
 * Performance contract
 * ─────────────────────
 * This component re-renders only when one of the four control values changes
 * (volume, transpose, sustain, barColor). Pressing piano keys does NOT cause
 * any re-renders anywhere in the tree.
 *
 * How the render budget is protected:
 *
 * 1. PianoKey receives pressNote + releaseNote directly — two stable function
 *    references that never change identity. PianoKey creates its own per-note
 *    handlers internally via useCallback. Because PianoKey's props are all
 *    stable constants after mount, React.memo gives a hard guarantee of zero
 *    re-renders per note press.
 *
 *    Before this change Piano passed handleMouseDown(note.label) in JSX —
 *    a factory call that produced a new closure on every render, completely
 *    defeating React.memo on PianoKey (61 keys × 5 handlers = 305 new
 *    functions allocated per Piano render).
 *
 * 2. The four control callbacks (onVolumeChange, onTransposeChange,
 *    onSustainToggle, onBarColorChange) are stable useCallback refs.
 *    React.memo on PianoControls therefore fires only when an actual value
 *    changes, not on every Piano render.
 *
 * 3. BarLayer receives ref objects that never change identity.
 *    React.memo on BarLayer means it never re-renders after mount.
 */

import React, { useCallback, useEffect } from "react";
import styles from "./Piano.module.scss";
import keyStyles from "@/components/piano/PianoKey/PianoKey.module.scss";

import { usePianoEngine } from "@/hooks/usePianoEngine";
import PianoControls from "@/components/piano/PianoControls/PianoControls";
import BarLayer from "@/components/piano/BarLayer/BarLayer";
import PianoKey from "@/components/piano/PianoKey/PianoKey";
import {
    ALL_NOTES,
    WHITE_NOTES,
    WHITE_NOTE_IDX,
    NOTE_TO_KEYS,
    getLeftWhiteLabel,
} from "@/lib/keyMap";
import { Smartphone } from "lucide-react";

// Module-level constants — computed once, never change
const BLACK_NOTES = ALL_NOTES.filter(
    (n) => n.isBlack && getLeftWhiteLabel(n) !== "",
);

// Pre-compute key-label strings once so JSX never allocates them on re-render
const WHITE_KEY_LABELS = WHITE_NOTES.map((note) => ({
    noteLabel: note.label,
    keyLabels: (NOTE_TO_KEYS[note.label] ?? []).slice(0, 2).join("/"),
    noteDisplay: note.label,
}));

const BLACK_KEY_LABELS = BLACK_NOTES.map((note) => ({
    noteLabel: note.label,
    keyLabels: (NOTE_TO_KEYS[note.label] ?? []).slice(0, 2).join("/"),
    noteDisplay: note.note,
    leftWhite: getLeftWhiteLabel(note),
}));

export default function Piano() {
    const engine = usePianoEngine({ activeClassName: keyStyles.active });

    const { state, refs, pressNote, releaseNote, repositionBlackKeys } = engine;

    const {
        volume,
        transpose,
        sustain,
        barColor,
        setVolume,
        setTranspose,
        setSustain,
        setBarColor,
    } = state;

    const { canvasRef, vizAreaRef, pianoRef, keyElementsRef } = refs;

    // ── Sync CSS custom prop for bar color ───────────────────────────────────
    useEffect(() => {
        document.documentElement.style.setProperty("--bar-color", barColor);
    }, [barColor]);

    // ── Stable control callbacks (passed to PianoControls) ───────────────────
    // These are stable because setVolume / setTranspose / setSustain / setBarColor
    // are themselves stable (React state dispatchers never change identity).
    const onVolumeChange = useCallback(
        (v: number) => setVolume(v),
        [setVolume],
    );
    const onTransposeChange = useCallback(
        (t: number) => setTranspose(t),
        [setTranspose],
    );
    const onSustainToggle = useCallback(
        () => setSustain((s) => !s),
        [setSustain],
    );
    const onBarColorChange = useCallback(
        (c: string) => setBarColor(c),
        [setBarColor],
    );

    // ── Piano callback ref: register DOM nodes + stamp data-wIdx ────────────
    const pianoCallbackRef = useCallback(
        (el: HTMLDivElement | null) => {
            pianoRef.current = el;
            if (!el) return;

            el.querySelectorAll<HTMLElement>("[data-note]").forEach((keyEl) => {
                keyElementsRef.current[keyEl.dataset.note!] = keyEl;
            });

            // data-is-black selector works here because it's a data attribute, not a class
            el.querySelectorAll<HTMLElement>("[data-is-black='true']").forEach(
                (bk) => {
                    bk.dataset.wIdx = String(
                        WHITE_NOTE_IDX[bk.dataset.leftWhite!] ?? "",
                    );
                },
            );

            requestAnimationFrame(() => repositionBlackKeys());
        },
        [pianoRef, keyElementsRef, repositionBlackKeys],
    );

    useEffect(() => {
        const enterFullscreen = async () => {
            if (!document.documentElement.requestFullscreen) return;

            try {
                await document.documentElement.requestFullscreen();
            } catch {}
        };

        enterFullscreen();

        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        };
    }, []);

    return (
        <div className={styles.root}>
            {/* Orientation overlay */}
            <div
                className={styles.orientationOverlay}
                role="alert"
                aria-live="polite"
            >
                <div className={styles.rotateIcon}>
                    <Smartphone />
                </div>
                <p className={styles.overlayText}>
                    Please rotate your device to landscape for the best
                    experience.
                </p>
            </div>

            {/* Header controls — React.memo'd, re-renders only when a value changes */}
            <PianoControls
                volume={volume}
                transpose={transpose}
                sustain={sustain}
                barColor={barColor}
                onVolumeChange={onVolumeChange}
                onTransposeChange={onTransposeChange}
                onSustainToggle={onSustainToggle}
                onBarColorChange={onBarColorChange}
            />

            {/* Visualization — React.memo'd, never re-renders after mount */}
            <BarLayer canvasRef={canvasRef} vizAreaRef={vizAreaRef} />

            {/* Piano keys */}
            <div className={styles.pianoWrapper}>
                <div className={styles.piano} ref={pianoCallbackRef}>
                    {/* White keys
              pressNote and releaseNote are stable refs from usePianoEngine.
              noteLabel, keyLabels, noteDisplay are pre-computed constants.
              React.memo on PianoKey guarantees zero re-renders after mount. */}
                    {WHITE_KEY_LABELS.map((k, idx) => (
                        <PianoKey
                            key={k.noteLabel}
                            noteLabel={k.noteLabel}
                            keyLabels={k.keyLabels}
                            noteDisplay={k.noteDisplay}
                            isBlack={false}
                            isFirst={idx === 0}
                            pressNote={pressNote}
                            releaseNote={releaseNote}
                        />
                    ))}

                    {/* Black keys — same guarantee */}
                    {BLACK_KEY_LABELS.map((k) => (
                        <PianoKey
                            key={k.noteLabel}
                            noteLabel={k.noteLabel}
                            keyLabels={k.keyLabels}
                            noteDisplay={k.noteDisplay}
                            isBlack={true}
                            leftWhite={k.leftWhite}
                            pressNote={pressNote}
                            releaseNote={releaseNote}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
