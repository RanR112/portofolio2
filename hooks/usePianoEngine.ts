"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    ARROW_CODES,
    LOCK_KEYS,
    MIDI_BY_LABEL,
    resolveKeyToNote,
    type KeyMode,
} from "@/lib/keyMap";
import { pianoEngine } from "@/lib/pianoEngine";

// Keyboard Lock API — Chromium-only, requires fullscreen + secure context.
// Not in the TS DOM lib yet, so we describe the slice we use.
interface KeyboardLockNavigator {
    keyboard?: {
        lock: (keyCodes?: string[]) => Promise<void>;
        unlock: () => void;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation constants
// ─────────────────────────────────────────────────────────────────────────────

const GROW_RATE = 0.18; // px/ms
const SCROLL_SPEED = 2.5; // px/frame
const MAX_GROW_FRAC = 0.92;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Bar {
    x: number;
    width: number;
    height: number;
    yOffset: number;
    isReleased: boolean;
    keyEl: HTMLElement | null;
}

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
    keyMode: KeyMode;
    isFullscreen: boolean;
    lockActive: boolean;
    samplesReady: boolean;
    setVolume: React.Dispatch<React.SetStateAction<number>>;
    setTranspose: React.Dispatch<React.SetStateAction<number>>;
    setSustain: React.Dispatch<React.SetStateAction<boolean>>;
    setBarColor: React.Dispatch<React.SetStateAction<string>>;
    setKeyMode: React.Dispatch<React.SetStateAction<KeyMode>>;
    toggleFullscreen: () => void;
}

export interface UsePianoEngineOptions {
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

    // ── UI state (only these ever cause React re-renders) ─────────────────────
    const [volume, setVolume] = useState(100);
    const [transpose, setTranspose] = useState(0);
    const [sustain, setSustain] = useState(true);
    const [barColor, setBarColor] = useState("#f0a63a");
    const [keyMode, setKeyMode] = useState<KeyMode>(61);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [lockActive, setLockActive] = useState(false);

    // samplesReady drives the loading overlay in Piano.tsx
    const [samplesReady, setSamplesReady] = useState(false);

    // ── Shadow refs — stale-closure-safe copies of state ──────────────────────
    const transposeRef = useRef(0);
    const barColorRef = useRef("#f0a63a");
    // allowCtrl gates the Ctrl→note map inside the keydown closure. It is only
    // true when Keyboard Lock is active (Chromium + fullscreen + 88-key mode).
    const allowCtrlRef = useRef(false);

    useEffect(() => {
        transposeRef.current = transpose;
    }, [transpose]);
    useEffect(() => {
        barColorRef.current = barColor;
    }, [barColor]);
    useEffect(() => {
        allowCtrlRef.current = lockActive;
    }, [lockActive]);

    // ── Animation refs ─────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const vizAreaRef = useRef<HTMLDivElement | null>(null);
    const activeBarsRef = useRef<Record<string, Bar>>({});
    const releasedBarsRef = useRef<Bar[]>([]);
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef(0);

    // ── Piano DOM refs ─────────────────────────────────────────────────────────
    const pianoRef = useRef<HTMLDivElement | null>(null);
    const keyElementsRef = useRef<Record<string, HTMLElement>>({});

    // ── Keyboard tracking ──────────────────────────────────────────────────────
    const pressedPhysRef = useRef<Set<string>>(new Set());
    const keyCodeToNoteRef = useRef<Record<string, string>>({});

    // ─────────────────────────────────────────────────────────────────────────
    // Load samples on mount — pianoEngine does all the work,
    // we just flip samplesReady when it's done so the overlay hides.
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        pianoEngine.loadSamples().then(() => {
            setSamplesReady(pianoEngine.samplesReady);
        });
        return () => {
            pianoEngine.destroy();
        };
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // Sync volume → pianoEngine (smooth ramp handled inside engine)
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        pianoEngine.setVolume(volume / 100);
    }, [volume]);

    // ─────────────────────────────────────────────────────────────────────────
    // Sync sustain → pianoEngine
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        pianoEngine.setSustain(sustain);
    }, [sustain]);

    // ─────────────────────────────────────────────────────────────────────────
    // Fullscreen + Keyboard Lock
    //
    // The Ctrl-based extended keys (88-key mode) collide with reserved browser
    // shortcuts (Ctrl+W close tab, Ctrl+T new tab, Ctrl+1–9 switch tab). The only
    // way to route those to the page is the Keyboard Lock API, which requires
    // fullscreen and is Chromium-only. We therefore lock ONLY while fullscreen +
    // 88-key mode, and gate the Ctrl map on the lock actually succeeding.
    // ─────────────────────────────────────────────────────────────────────────

    const toggleFullscreen = useCallback(() => {
        // Must run inside a user gesture (button click) to be allowed.
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }, []);

    useEffect(() => {
        const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFsChange);
        onFsChange();
        return () =>
            document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    useEffect(() => {
        const kb = (navigator as Navigator & KeyboardLockNavigator).keyboard;

        // Lock only when the feature is actually in use: fullscreen + 88 keys.
        if (isFullscreen && keyMode === 88 && kb?.lock) {
            let cancelled = false;
            kb.lock(LOCK_KEYS)
                .then(() => {
                    if (!cancelled) setLockActive(true);
                })
                .catch(() => {
                    if (!cancelled) setLockActive(false);
                });
            return () => {
                cancelled = true;
                kb.unlock?.();
                setLockActive(false);
            };
        }

        // Not eligible — make sure any prior lock is released.
        kb?.unlock?.();
        setLockActive(false);
    }, [isFullscreen, keyMode]);

    // ─────────────────────────────────────────────────────────────────────────
    // Canvas / animation helpers
    // ─────────────────────────────────────────────────────────────────────────

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    }, []);

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

    const animReleaseKey = useCallback((noteLabel: string) => {
        const bar = activeBarsRef.current[noteLabel];
        if (!bar) return;
        bar.isReleased = true;
        bar.keyEl = null;
        releasedBarsRef.current.push(bar);
        delete activeBarsRef.current[noteLabel];
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // RAF draw loop — outside React, direct canvas manipulation
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

            Object.values(activeBarsRef.current).forEach((bar) => {
                bar.height = Math.min(bar.height + GROW_RATE * delta, maxH);
                drawBar(ctx2d, bar, H);
            });

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
    // pressNote / releaseNote — stable callbacks, zero React state on note events
    // ─────────────────────────────────────────────────────────────────────────

    const pressNote = useCallback(
        (noteLabel: string) => {
            const el = keyElementsRef.current[noteLabel];
            if (!el || el.classList.contains(activeClassName)) return;
            el.classList.add(activeClassName);

            const baseMidi = MIDI_BY_LABEL[noteLabel];
            if (baseMidi !== undefined) {
                const targetMidi = baseMidi + transposeRef.current;
                pianoEngine.playNote(noteLabel, targetMidi);
            }

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
    // Keyboard listener
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent): void {
            if ((e.target as HTMLElement).tagName === "INPUT") return;

            if (ARROW_CODES.has(e.code)) {
                e.preventDefault();
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

            const noteLabel = resolveKeyToNote(e, allowCtrlRef.current);
            if (!noteLabel) return;
            // Ctrl combos resolved to a note: suppress the browser shortcut.
            // (Only reached when Keyboard Lock is active, so this is safe.)
            if (e.ctrlKey) e.preventDefault();
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
    // Black key repositioning + resize throttle
    // ─────────────────────────────────────────────────────────────────────────

    const repositionBlackKeys = useCallback(() => {
        const pianoEl = pianoRef.current;
        if (!pianoEl) return;

        // Count the white keys currently in the DOM so the layout adapts to the
        // active key mode (36 white in 61-key, 52 white in 88-key).
        const whiteCount =
            pianoEl.querySelectorAll("[data-note]:not([data-is-black])")
                .length || 1;
        const wkw = pianoEl.clientWidth / whiteCount;
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
    return {
        state: {
            volume,
            transpose,
            sustain,
            barColor,
            keyMode,
            isFullscreen,
            lockActive,
            samplesReady,
            setVolume,
            setTranspose,
            setSustain,
            setBarColor,
            setKeyMode,
            toggleFullscreen,
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
