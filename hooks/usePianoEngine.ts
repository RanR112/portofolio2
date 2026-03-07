/**
 * hooks/usePianoEngine.ts
 *
 * React bridge between the UI and the pure audio engine.
 *
 * What this hook does
 * ────────────────────
 * • Initialises pianoEngine once on first user interaction.
 * • Exposes pressNote / releaseNote to UI components — these are stable
 *   function references that NEVER change, so React.memo'd children never
 *   re-render because of them.
 * • Owns all DOM-touching animation logic (canvas RAF loop, black-key
 *   repositioning) via refs — this code runs completely outside React's
 *   render cycle.
 * • Owns the keyboard listener (keydown / keyup) — fires pianoEngine directly,
 *   never setState.
 * • useState is used ONLY for the four controls that must drive UI updates:
 *   volume, transpose, sustain, barColor.
 *
 * What this hook does NOT do
 * ────────────────────────────
 * • Touch Web Audio directly — delegated entirely to pianoEngine.
 * • setState on note press/release — active-class toggling is pure DOM.
 * • Re-render on every animation frame — RAF loop manipulates canvas directly.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { pianoEngine } from "../lib/pianoEngine";
import { WHITE_NOTES, ARROW_CODES, resolveKeyToNote } from "../lib/keyMap";

// ─────────────────────────────────────────────────────────────────────────────
// Bar shape (animation only — no audio data here)
// ─────────────────────────────────────────────────────────────────────────────

export interface Bar {
    x: number;
    width: number;
    height: number;
    yOffset: number;
    isReleased: boolean;
    keyEl: HTMLElement | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation constants
// ─────────────────────────────────────────────────────────────────────────────

const GROW_RATE = 0.14; // px/ms
const SCROLL_SPEED = 2.5; // px/frame
const MAX_GROW_FRAC = 0.92;

// ─────────────────────────────────────────────────────────────────────────────
// Public surface returned from the hook
// ─────────────────────────────────────────────────────────────────────────────

export interface PianoEngineRefs {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    vizAreaRef: React.RefObject<HTMLDivElement | null>;
    pianoRef: React.RefObject<HTMLDivElement | null>;
    keyElementsRef: React.MutableRefObject<Record<string, HTMLElement>>;
    activeBarsRef: React.MutableRefObject<Record<string, Bar>>;
    releasedBarsRef: React.MutableRefObject<Bar[]>;
    barColorRef: React.MutableRefObject<string>;
}

export interface PianoEngineState {
    volume: number;
    transpose: number;
    sustain: boolean;
    barColor: string;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    setTranspose: React.Dispatch<React.SetStateAction<number>>;
    setSustain: React.Dispatch<React.SetStateAction<boolean>>;
    setBarColor: React.Dispatch<React.SetStateAction<string>>;
}

export interface UsePianoEngineOptions {
    /**
     * The hashed SCSS-module class name for the "active" key state.
     * Passed from Piano.tsx so classList manipulation uses the correct name.
     */
    activeClassName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePianoEngine(options: UsePianoEngineOptions): {
    state: PianoEngineState;
    refs: PianoEngineRefs;
    pressNote: (label: string) => void;
    releaseNote: (label: string) => void;
    repositionBlackKeys: () => void;
    resizeCanvas: () => void;
} {
    const { activeClassName } = options;

    // ── React state — ONLY what must drive UI re-renders ─────────────────────
    const [volume, setVolume] = useState(75);
    const [transpose, setTranspose] = useState(0);
    const [sustain, setSustain] = useState(true);
    const [barColor, setBarColor] = useState("#f0a63a");

    const barColorRef = useRef("#f0a63a");

    // ── Animation refs (never trigger re-renders) ─────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const vizAreaRef = useRef<HTMLDivElement | null>(null);
    const activeBarsRef = useRef<Record<string, Bar>>({});
    const releasedBarsRef = useRef<Bar[]>([]);
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef(0);

    // ── Piano DOM refs ────────────────────────────────────────────────────────
    const pianoRef = useRef<HTMLDivElement | null>(null);
    const keyElementsRef = useRef<Record<string, HTMLElement>>({});

    // ── Keyboard tracking (physical, not musical state) ───────────────────────
    const pressedPhysRef = useRef<Set<string>>(new Set());
    const keyCodeToNoteRef = useRef<Record<string, string>>({});

    // ─────────────────────────────────────────────────────────────────────────
    // Sync state → engine (no audio re-init, just parameter updates)
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        pianoEngine.setVolume(volume);
    }, [volume]);
    useEffect(() => {
        pianoEngine.setTranspose(transpose);
    }, [transpose]);
    useEffect(() => {
        pianoEngine.setSustain(sustain);
    }, [sustain]);
    useEffect(() => {
        barColorRef.current = barColor;
    }, [barColor]);

    // ─────────────────────────────────────────────────────────────────────────
    // Canvas / animation helpers
    // ─────────────────────────────────────────────────────────────────────────

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }, []);

    // Register a bar when a key is pressed (pure DOM geometry, no audio)
    const animRegisterKey = useCallback(
        (noteLabel: string, keyEl: HTMLElement) => {
            if (activeBarsRef.current[noteLabel]) return;
            const wr = vizAreaRef.current?.getBoundingClientRect();
            if (!wr) return;
            const r = keyEl.getBoundingClientRect();
            activeBarsRef.current[noteLabel] = {
                x: r.left + r.width / 2 - wr.left,
                width: r.width * 0.72,
                height: 2,
                yOffset: 0,
                isReleased: false,
                keyEl,
            };
        },
        [],
    );

    // Freeze a bar's height and hand it to the scrolling pool
    const animReleaseKey = useCallback((noteLabel: string) => {
        const bar = activeBarsRef.current[noteLabel];
        if (!bar) return;
        bar.isReleased = true;
        bar.keyEl = null;
        releasedBarsRef.current.push(bar);
        delete activeBarsRef.current[noteLabel];
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // RAF draw loop — runs entirely outside React, manipulates canvas directly
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        resizeCanvas();

        function syncPositions(): void {
            const wr = vizAreaRef.current?.getBoundingClientRect();
            if (!wr) return;
            Object.values(activeBarsRef.current).forEach((bar) => {
                if (!bar.keyEl) return;
                const r = bar.keyEl.getBoundingClientRect();
                bar.x = r.left + r.width / 2 - wr.left;
                bar.width = r.width * 0.72;
            });
        }

        function drawBar(
            ctx2d: CanvasRenderingContext2D,
            bar: Bar,
            H: number,
        ): void {
            const { x, width, height, yOffset } = bar;
            const bx = x - width / 2;
            const bottom = H - yOffset;
            const top = bottom - height;
            if (bottom < 0) return;

            const color = barColorRef.current;
            const grad = ctx2d.createLinearGradient(
                0,
                Math.max(top, 0),
                0,
                Math.min(bottom, H),
            );
            grad.addColorStop(0, color + "00");
            grad.addColorStop(0.25, color + "bb");
            grad.addColorStop(1, color + "ff");

            ctx2d.save();
            ctx2d.shadowColor = color;
            ctx2d.shadowBlur = 14;
            ctx2d.fillStyle = grad;
            ctx2d.beginPath();
            (
                ctx2d as CanvasRenderingContext2D & {
                    roundRect: (
                        x: number,
                        y: number,
                        w: number,
                        h: number,
                        r: number[],
                    ) => void;
                }
            ).roundRect(bx, top, width, height, [3, 3, 0, 0]);
            ctx2d.fill();
            ctx2d.restore();
        }

        function draw(now: number): void {
            const canvas = canvasRef.current;
            if (!canvas) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            const ctx2d = canvas.getContext("2d");
            if (!ctx2d) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }

            const W = canvas.width;
            const H = canvas.height;
            const delta = now - lastTimeRef.current;
            lastTimeRef.current = now;

            ctx2d.clearRect(0, 0, W, H);
            syncPositions();

            const maxH = H * MAX_GROW_FRAC;

            // Growing bars (key held)
            Object.values(activeBarsRef.current).forEach((bar) => {
                bar.height = Math.min(bar.height + GROW_RATE * delta, maxH);
                drawBar(ctx2d, bar, H);
            });

            // Released bars scrolling upward
            const rel = releasedBarsRef.current;
            for (let i = rel.length - 1; i >= 0; i--) {
                const bar = rel[i];
                bar.yOffset += SCROLL_SPEED;
                if (bar.yOffset - bar.height > H) {
                    rel.splice(i, 1);
                    continue;
                }
                drawBar(ctx2d, bar, H);
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        lastTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(rafRef.current);
    }, [resizeCanvas]);

    // ─────────────────────────────────────────────────────────────────────────
    // pressNote / releaseNote
    //
    // These are STABLE references (deps are all refs, never re-created).
    // React.memo'd PianoKey children will NEVER re-render because of them.
    // Active-class toggling is pure DOM — zero setState, zero re-renders.
    // ─────────────────────────────────────────────────────────────────────────

    const pressNote = useCallback(
        (noteLabel: string) => {
            const el = keyElementsRef.current[noteLabel];
            if (!el || el.classList.contains(activeClassName)) return;

            // DOM mutation — no React state involved
            el.classList.add(activeClassName);

            // Fire audio engine — runs on audio thread, does not block UI
            pianoEngine.playNote(noteLabel);

            // Start growing bar for this key
            animRegisterKey(noteLabel, el);
        },
        [activeClassName, animRegisterKey],
    );

    const releaseNote = useCallback(
        (noteLabel: string) => {
            const el = keyElementsRef.current[noteLabel];
            if (el) el.classList.remove(activeClassName);

            pianoEngine.stopNote(noteLabel);
            animReleaseKey(noteLabel);
        },
        [activeClassName, animReleaseKey],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Keyboard listener — fires engine directly, never setState for note events
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent): void {
            if ((e.target as HTMLElement).tagName === "INPUT") return;

            if (ARROW_CODES.has(e.code)) {
                e.preventDefault();
                // These DO call setState because they must update visible control UI
                if (e.code === "ArrowRight")
                    setVolume((v) => Math.min(100, v + 5));
                if (e.code === "ArrowLeft")
                    setVolume((v) => Math.max(0, v - 5));
                if (e.code === "ArrowUp")
                    setTranspose((t) => Math.min(12, t + 1));
                if (e.code === "ArrowDown")
                    setTranspose((t) => Math.max(-12, t - 1));
                return;
            }

            if (e.code === "Space") {
                e.preventDefault();
                setSustain((s) => !s);
                return;
            }

            if (e.repeat) return;

            const noteLabel = resolveKeyToNote(e);
            if (!noteLabel) return;
            if (pressedPhysRef.current.has(e.code)) return;

            pressedPhysRef.current.add(e.code);
            keyCodeToNoteRef.current[e.code] = noteLabel;
            pressNote(noteLabel);
        }

        function onKeyUp(e: KeyboardEvent): void {
            if ((e.target as HTMLElement).tagName === "INPUT") return;
            if (ARROW_CODES.has(e.code)) return;

            pressedPhysRef.current.delete(e.code);
            const noteLabel = keyCodeToNoteRef.current[e.code];
            delete keyCodeToNoteRef.current[e.code];
            if (!noteLabel) return;
            releaseNote(noteLabel);
        }

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
        };
    }, [pressNote, releaseNote]);

    // ─────────────────────────────────────────────────────────────────────────
    // Black key repositioning + resize
    // Uses data-is-black attribute selector — immune to SCSS module class hashing
    // ─────────────────────────────────────────────────────────────────────────

    const repositionBlackKeys = useCallback(() => {
        const pianoEl = pianoRef.current;
        if (!pianoEl) return;

        const wkw = pianoEl.clientWidth / WHITE_NOTES.length;
        const wkh = pianoEl.clientHeight - 10;

        document.documentElement.style.setProperty("--wkw", `${wkw}px`);
        document.documentElement.style.setProperty("--wkh", `${wkh}px`);

        pianoEl
            .querySelectorAll<HTMLElement>("[data-is-black='true']")
            .forEach((bk) => {
                const wIdx = parseInt(bk.dataset.wIdx ?? "", 10);
                if (isNaN(wIdx)) return;
                bk.style.left = `${(wIdx + 1) * wkw}px`;
            });
    }, []);

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;

        function onResize(): void {
            resizeCanvas();
            repositionBlackKeys();
        }

        function throttled(): void {
            clearTimeout(timer);
            timer = setTimeout(onResize, 60);
        }

        window.addEventListener("resize", throttled);
        window.addEventListener("orientationchange", () =>
            setTimeout(onResize, 250),
        );

        const initTimer = setTimeout(onResize, 150);
        return () => {
            window.removeEventListener("resize", throttled);
            clearTimeout(timer);
            clearTimeout(initTimer);
        };
    }, [resizeCanvas, repositionBlackKeys]);

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup on unmount
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            pianoEngine.destroy();
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    return {
        state: {
            volume,
            transpose,
            sustain,
            barColor,
            setVolume,
            setTranspose,
            setSustain,
            setBarColor,
        },
        refs: {
            canvasRef,
            vizAreaRef,
            pianoRef,
            keyElementsRef,
            activeBarsRef,
            releasedBarsRef,
            barColorRef,
        },
        pressNote,
        releaseNote,
        repositionBlackKeys,
        resizeCanvas,
    };
}
