"use client";

/**
 * PlaybackProgress.tsx
 *
 * Progress bar interaktif untuk Autoplay.
 *
 * Performance contract
 * ─────────────────────
 * Selama lagu berjalan, komponen ini TIDAK PERNAH di-render ulang oleh React.
 * Posisi dibaca langsung dari `elapsedRef` milik usePianoPlayback (sumber jam
 * yang sama dengan scheduler) lewat SATU loop rAF, lalu ditulis ke DOM:
 *
 *   - isi track  → transform: scaleX() (compositor, tanpa layout)
 *   - thumb      → left: %
 *   - waktu      → textContent, hanya saat detiknya berubah
 *   - nilai input→ hanya saat posisi berubah (bukan tiap frame)
 *
 * Interaksinya memakai <input type="range"> transparan di atas track kustom,
 * jadi klik, drag, sentuh, keyboard, dan screen reader semuanya gratis. Saat
 * user menggeser, loop rAF ditahan supaya tidak berebut dengan jari; seek baru
 * di-commit sekali saat pointer/key dilepas.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import styles from "./PlaybackProgress.module.scss";

export interface PlaybackProgressProps {
    title: string;
    durationMs: number;
    /** posisi lagu (ms) — ref yang sama dengan scheduler */
    elapsedRef: React.MutableRefObject<number>;
    /** true = ticker sedang jalan; false = dijeda (indikator diam) */
    playing: boolean;
    /** commit seek (ms) */
    onSeek: (ms: number) => void;
    /**
     * Ref ke baris ini. Dipakai panel Sheets untuk tahu di mana baris progress
     * berakhir, supaya panelnya bisa diletakkan di bawah bar — bukan menimpa.
     */
    barRef?: React.Ref<HTMLDivElement>;
}

function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

function formatTime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}

const PlaybackProgress = React.memo(function PlaybackProgress({
    title,
    durationMs,
    elapsedRef,
    playing,
    onSeek,
    barRef,
}: PlaybackProgressProps) {
    const t = useTranslations("piano");

    const fillRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLSpanElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    /** true selama jari/panah sedang mengubah nilai slider */
    const scrubbingRef = useRef(false);
    const lastMsRef = useRef(-1);
    const lastSecondRef = useRef(-1);

    const paint = useCallback(
        (raw: number, preview = false) => {
            const ms = Math.max(0, Math.min(raw, durationMs));

            if (lastMsRef.current < 0 || ms !== lastMsRef.current) {
                lastMsRef.current = ms;
                const pct = durationMs > 0 ? (ms / durationMs) * 100 : 0;
                if (fillRef.current) {
                    fillRef.current.style.transform = `scaleX(${pct / 100})`;
                }
                if (thumbRef.current) thumbRef.current.style.left = `${pct}%`;
            }

            const second = Math.floor(ms / 1000);
            if (second !== lastSecondRef.current) {
                lastSecondRef.current = second;
                const label = formatTime(ms);
                if (currentRef.current) currentRef.current.textContent = label;
                inputRef.current?.setAttribute("aria-valuetext", label);
            }

            // Selagi preview, nilai input sudah dipegang user — jangan ditimpa.
            if (!preview && inputRef.current) {
                const value = String(Math.round(ms));
                if (inputRef.current.value !== value) {
                    inputRef.current.value = value;
                }
            }
        },
        [durationMs],
    );

    useEffect(() => {
        // Posisi saat mount / saat status berubah. Saat paused, hanya ini yang
        // terjadi: tidak ada loop yang membuat indikator terus bergerak.
        paint(elapsedRef.current);

        if (!playing) return;

        let rafId: number;
        const tick = () => {
            if (!scrubbingRef.current) paint(elapsedRef.current);
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [playing, paint, elapsedRef]);

    const commit = useCallback(() => {
        if (!scrubbingRef.current) return;
        scrubbingRef.current = false;

        const input = inputRef.current;
        if (!input) return;

        const ms = Number(input.value);
        // Klik pada thumb tanpa menggeser tidak boleh memicu seek sia-sia
        // (seek = bongkar semua nada lalu bunyikan ulang).
        if (Math.abs(ms - elapsedRef.current) < 300) {
            paint(elapsedRef.current);
            return;
        }

        onSeek(ms);
        // seek() memperbarui elapsedRef secara sinkron.
        paint(elapsedRef.current);
    }, [elapsedRef, onSeek, paint]);

    const handleInput = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            scrubbingRef.current = true;
            paint(Number(e.currentTarget.value), true);
        },
        [paint],
    );

    const beginScrub = useCallback(() => {
        scrubbingRef.current = true;
    }, []);

    /**
     * Hanya tombol yang memang mengubah nilai range yang dianggap scrub.
     * Tanpa filter ini, mengetik huruf saat slider kebetulan fokus akan
     * menghentikan loop rAF sampai keyup — dan kalau nilai input sempat basi,
     * keyup bisa memicu seek yang tidak diminta.
     */
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (
                e.key.startsWith("Arrow") ||
                e.key === "Home" ||
                e.key === "End" ||
                e.key === "PageUp" ||
                e.key === "PageDown"
            ) {
                scrubbingRef.current = true;
            }
        },
        [],
    );

    const totalLabel = formatTime(durationMs);

    return (
        <div className={styles.bar} ref={barRef}>
            <span className={styles.title} title={title}>
                {title}
            </span>

            <div className={styles.trackWrap}>
                <div className={styles.track}>
                    <div ref={fillRef} className={styles.fill} />
                </div>
                <div ref={thumbRef} className={styles.thumb} />
                <input
                    ref={inputRef}
                    data-piano-seek
                    className={styles.slider}
                    type="range"
                    min={0}
                    max={Math.max(1000, Math.round(durationMs))}
                    step={1000}
                    defaultValue={0}
                    onPointerDown={(e) => {
                        if (e.button === 0) beginScrub();
                    }}
                    onPointerUp={commit}
                    onPointerCancel={commit}
                    onLostPointerCapture={commit}
                    onKeyDown={handleKeyDown}
                    onKeyUp={commit}
                    onBlur={commit}
                    onChange={handleInput}
                    aria-label={t("player.progressAria")}
                    aria-valuetext="00:00"
                    suppressHydrationWarning
                />
            </div>

            <span className={styles.time}>
                <span ref={currentRef} className={styles.current}>
                    00:00
                </span>
                <span className={styles.separator}>/</span>
                <span>{totalLabel}</span>
            </span>
        </div>
    );
});

export default PlaybackProgress;
