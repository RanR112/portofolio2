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

import React, { useCallback, useEffect, useMemo } from "react";
import styles from "./Piano.module.scss";
import keyStyles from "@/components/piano/PianoKey/PianoKey.module.scss";

import { usePianoEngine } from "@/hooks/usePianoEngine";
import PianoControls from "@/components/piano/PianoControls/PianoControls";
import BarLayer from "@/components/piano/BarLayer/BarLayer";
import PianoKey from "@/components/piano/PianoKey/PianoKey";
import { buildKeyboard, KEY_GRADIENTS, type KeyMode } from "@/lib/keyMap";
import { Smartphone } from "lucide-react";

export default function Piano() {
    const engine = usePianoEngine({ activeClassName: keyStyles.active });

    const { state, refs, pressNote, releaseNote, repositionBlackKeys } = engine;

    const {
        volume,
        transpose,
        sustain,
        barColor,
        keyMode,
        isFullscreen,
        lockActive,
        setVolume,
        setTranspose,
        setSustain,
        setBarColor,
        setKeyMode,
        toggleFullscreen,
    } = state;

    // Rendered keyboard for the active mode (61 or 88). Recomputed only on
    // mode change — pressing keys never touches this.
    const layout = useMemo(() => buildKeyboard(keyMode), [keyMode]);

    const { canvasRef, vizAreaRef, pianoRef, keyElementsRef } = refs;

    const currentGradients =
        KEY_GRADIENTS[barColor] || KEY_GRADIENTS["#f0a63a"];

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
    const onKeyModeChange = useCallback(
        (mode: KeyMode) => setKeyMode(mode),
        [setKeyMode],
    );

    // ── Register key DOM nodes into the engine ref + reposition black keys ───
    // wIdx (left-white index) is rendered directly onto each black key as
    // data-w-idx by PianoKey, so this only collects nodes + triggers layout.
    const registerKeys = useCallback(
        (el: HTMLDivElement) => {
            keyElementsRef.current = {};
            el.querySelectorAll<HTMLElement>("[data-note]").forEach((keyEl) => {
                keyElementsRef.current[keyEl.dataset.note!] = keyEl;
            });
            requestAnimationFrame(() => repositionBlackKeys());
        },
        [keyElementsRef, repositionBlackKeys],
    );

    const pianoCallbackRef = useCallback(
        (el: HTMLDivElement | null) => {
            pianoRef.current = el;
            if (el) registerKeys(el);
        },
        [pianoRef, registerKeys],
    );

    // Re-register + reposition whenever the key mode changes (keys added/removed).
    useEffect(() => {
        if (pianoRef.current) registerKeys(pianoRef.current);
    }, [keyMode, registerKeys, pianoRef]);

    // Enter fullscreen when arriving via the "Full Mode" button, which sets a
    // sessionStorage flag. Because Next.js does a same-document client
    // navigation, the click's transient activation is still valid here, so
    // requestFullscreen() is permitted — and it applies to /piano, not /music.
    // The flag is cleared immediately so a StrictMode double-mount won't
    // re-request. No exit-on-unmount cleanup: it would fire during StrictMode's
    // dev double-invoke and cancel the fullscreen we just entered. Leaving
    // fullscreen is handled by the close button, the fullscreen toggle, or Esc.
    useEffect(() => {
        let shouldEnter = false;
        try {
            if (sessionStorage.getItem("piano:fullscreen") === "1") {
                sessionStorage.removeItem("piano:fullscreen");
                shouldEnter = true;
            }
        } catch {}

        if (
            shouldEnter &&
            !document.fullscreenElement &&
            document.documentElement.requestFullscreen
        ) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
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
                keyMode={keyMode}
                isFullscreen={isFullscreen}
                lockActive={lockActive}
                onVolumeChange={onVolumeChange}
                onTransposeChange={onTransposeChange}
                onSustainToggle={onSustainToggle}
                onBarColorChange={onBarColorChange}
                onKeyModeChange={onKeyModeChange}
                onToggleFullscreen={toggleFullscreen}
            />

            {/* Visualization — React.memo'd, never re-renders after mount */}
            <BarLayer canvasRef={canvasRef} vizAreaRef={vizAreaRef} />

            {/* Piano keys */}
            <div className={styles.pianoWrapper}>
                <div
                    className={styles.piano}
                    style={
                        {
                            "--white-key-active": currentGradients.white,
                            "--black-key-active": currentGradients.black,
                        } as React.CSSProperties
                    }
                    ref={pianoCallbackRef}
                >
                    {/* White keys
              pressNote and releaseNote are stable refs from usePianoEngine.
              The layout is stable per key mode; keys remount only when the
              user switches between 61 and 88 keys. */}
                    {layout.whiteKeys.map((k) => (
                        <PianoKey
                            key={k.noteLabel}
                            noteLabel={k.noteLabel}
                            keyLabels={k.keyLabels}
                            underline={k.underline}
                            noteDisplay={k.noteDisplay}
                            isBlack={false}
                            isFirst={k.isFirst}
                            pressNote={pressNote}
                            releaseNote={releaseNote}
                        />
                    ))}

                    {/* Black keys — positioned via data-w-idx (left white index) */}
                    {layout.blackKeys.map((k) => (
                        <PianoKey
                            key={k.noteLabel}
                            noteLabel={k.noteLabel}
                            keyLabels={k.keyLabels}
                            underline={k.underline}
                            noteDisplay={k.noteDisplay}
                            isBlack={true}
                            leftWhite={k.leftWhite}
                            wIdx={k.wIdx}
                            pressNote={pressNote}
                            releaseNote={releaseNote}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
