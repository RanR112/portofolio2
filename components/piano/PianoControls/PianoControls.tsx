/**
 * PianoControls.tsx
 *
 * Performance contract
 * ─────────────────────
 * React.memo + stable callback props means this component only re-renders
 * when one of its value props actually changes (volume, transpose, sustain,
 * barColor, keyMode, isFullscreen, lockActive) or its local info-modal state.
 * Pressing piano keys never touches any of these, and the keys live in a
 * separate subtree, so re-rendering the header never re-renders a PianoKey.
 */

import React, { useCallback, useState } from "react";
import styles from "./PianoControls.module.scss";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BAR_COLORS, type KeyMode } from "@/lib/keyMap";
import Image from "next/image";
import { Logo } from "@/assets/index.assets";
import { Info, Maximize, Minimize } from "lucide-react";

interface PianoControlsProps {
    volume: number;
    transpose: number;
    sustain: boolean;
    barColor: string;
    keyMode: KeyMode;
    isFullscreen: boolean;
    lockActive: boolean;
    onVolumeChange: (v: number) => void;
    onTransposeChange: (t: number) => void;
    onSustainToggle: () => void;
    onBarColorChange: (color: string) => void;
    onKeyModeChange: (mode: KeyMode) => void;
    onToggleFullscreen: () => void;
}

const PianoControls = React.memo(function PianoControls({
    volume,
    transpose,
    sustain,
    barColor,
    keyMode,
    isFullscreen,
    lockActive,
    onVolumeChange,
    onTransposeChange,
    onSustainToggle,
    onBarColorChange,
    onKeyModeChange,
    onToggleFullscreen,
}: PianoControlsProps) {
    const locale = useLocale();
    const t = useTranslations("piano");
    const transDisplay = transpose > 0 ? `+${transpose}` : String(transpose);

    const [infoOpen, setInfoOpen] = useState(false);
    const [seoOpen, setSeoOpen] = useState(false);

    // Rich-text tag renderers shared by the info modal lines.
    const richTags = {
        kbd: (chunks: React.ReactNode) => <kbd>{chunks}</kbd>,
        u: (chunks: React.ReactNode) => (
            <span className={styles.ul}>{chunks}</span>
        ),
    };

    // ── Stable handlers — close over stable prop callbacks ───────────────────
    const onVolDown = useCallback(
        () => onVolumeChange(Math.max(0, volume - 5)),
        [onVolumeChange, volume],
    );
    const onVolUp = useCallback(
        () => onVolumeChange(Math.min(100, volume + 5)),
        [onVolumeChange, volume],
    );
    const onTranDown = useCallback(
        () => onTransposeChange(Math.max(-12, transpose - 1)),
        [onTransposeChange, transpose],
    );
    const onTranUp = useCallback(
        () => onTransposeChange(Math.min(12, transpose + 1)),
        [onTransposeChange, transpose],
    );
    const onVolSlide = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onVolumeChange(parseInt(e.target.value)),
        [onVolumeChange],
    );
    const onTranSlide = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
            onTransposeChange(parseInt(e.target.value)),
        [onTransposeChange],
    );

    return (
        <div className={styles.header}>
            <button
                type="button"
                className={styles.logo}
                onClick={() => setSeoOpen((v) => !v)}
                title={t("seo.aria")}
                aria-label={t("seo.aria")}
                aria-expanded={seoOpen}
                suppressHydrationWarning
            >
                <Image src={Logo} alt="Randy Rafael online piano" width={40} height={40} />
            </button>
            <div className={styles.divider} />

            {/* Volume */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>VOL</span>
                <button className={styles.ctrlBtn} onClick={onVolDown} suppressHydrationWarning>
                    -
                </button>
                <input
                    type="range"
                    className={styles.volumeSlider}
                    min={0}
                    max={100}
                    value={volume}
                    onChange={onVolSlide}
                />
                <button className={styles.ctrlBtn} onClick={onVolUp} suppressHydrationWarning>
                    +
                </button>
                <span className={styles.ctrlValue}>{volume}</span>
            </div>

            <div className={styles.divider} />

            {/* Transpose */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>TRANSPOSE</span>
                <button className={styles.ctrlBtn} onClick={onTranDown} suppressHydrationWarning>
                    -
                </button>
                <input
                    type="range"
                    className={styles.transposeSlider}
                    min={-12}
                    max={12}
                    value={transpose}
                    onChange={onTranSlide}
                />
                <button className={styles.ctrlBtn} onClick={onTranUp} suppressHydrationWarning>
                    +
                </button>
                <span className={styles.ctrlValue}>{transDisplay}</span>
            </div>

            <div className={styles.divider} />

            {/* Sustain */}
            <button
                className={`${styles.sustainBtn}${sustain ? ` ${styles.active}` : ""}`}
                onClick={onSustainToggle}
                suppressHydrationWarning
            >
                <span className={styles.led} />
                SUSTAIN
                <span className={styles.keyHint}>SPACE</span>
            </button>

            <div className={styles.divider} />

            {/* Keys — 61 / 88 */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>KEYS</span>
                <div className={styles.keyModeToggle}>
                    <button
                        className={`${styles.modeBtn}${keyMode === 61 ? ` ${styles.modeActive}` : ""}`}
                        onClick={() => onKeyModeChange(61)}
                        suppressHydrationWarning
                    >
                        61
                    </button>
                    <button
                        className={`${styles.modeBtn}${keyMode === 88 ? ` ${styles.modeActive}` : ""}`}
                        onClick={() => onKeyModeChange(88)}
                        suppressHydrationWarning
                    >
                        88
                    </button>
                </div>
            </div>

            <div className={styles.divider} />

            {/* Bar Color */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>BAR COLOR</span>
                <div className={styles.colorSwatches}>
                    {BAR_COLORS.map((c) => (
                        <div
                            key={c.value}
                            className={`${styles.swatch}${barColor === c.value ? ` ${styles.selected}` : ""}`}
                            style={{ background: c.value }}
                            title={c.label}
                            onClick={() => onBarColorChange(c.value)}
                        />
                    ))}
                </div>
            </div>

            {/* Right-aligned actions: fullscreen · info · close */}
            <div className={styles.rightCluster}>
                <button
                    className={styles.iconBtn}
                    onClick={onToggleFullscreen}
                    title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                    suppressHydrationWarning
                >
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>

                <button
                    className={styles.iconBtn}
                    onClick={() => setInfoOpen(true)}
                    title="Help"
                    aria-label="Show help"
                    suppressHydrationWarning
                >
                    <Info size={20} />
                </button>

                <Link
                    className={styles.close}
                    href={`/${locale}/music`}
                    onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen().catch(() => {});
                        }
                    }}
                >
                    <CloseIcon />
                </Link>
            </div>

            {/* Info modal */}
            {infoOpen && (
                <div
                    className={styles.infoBackdrop}
                    onClick={() => setInfoOpen(false)}
                >
                    <div
                        className={styles.infoPanel}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t("info.title")}
                    >
                        <div className={styles.infoHeader}>
                            <h2 className={styles.infoTitle}>
                                {t("info.title")}
                            </h2>
                            <button
                                className={styles.iconBtn}
                                onClick={() => setInfoOpen(false)}
                                aria-label="Close"
                            >
                                <CloseIcon />
                            </button>
                        </div>

                        <div className={styles.infoBody}>
                            <section className={styles.infoSection}>
                                <h3 className={styles.infoHeading}>
                                    {t("info.keysHeading")}
                                </h3>
                                <p>{t("info.keysIntro")}</p>
                                <ul className={styles.infoList}>
                                    <li>{t.rich("info.shift", richTags)}</li>
                                    <li>{t.rich("info.ctrl", richTags)}</li>
                                </ul>
                                <p className={styles.infoNote}>
                                    {t.rich("info.ctrlNote", richTags)}
                                    {lockActive ? " ✓" : ""}
                                </p>
                            </section>

                            <section className={styles.infoSection}>
                                <h3 className={styles.infoHeading}>
                                    {t("info.transposeHeading")}
                                </h3>
                                <p>{t.rich("info.transpose", richTags)}</p>
                            </section>

                            <section className={styles.infoSection}>
                                <h3 className={styles.infoHeading}>
                                    {t("info.sustainHeading")}
                                </h3>
                                <p>{t.rich("info.sustain", richTags)}</p>
                            </section>
                        </div>
                    </div>
                </div>
            )}

            {/*
              SEO content — revealed by clicking the logo. Rendered UNCONDITIONALLY
              (only visibility is toggled via CSS) so it is present in the
              server-rendered HTML and stays crawlable/indexable by search engines.
            */}
            <div
                className={`${styles.seoBackdrop}${seoOpen ? ` ${styles.seoOpen}` : ""}`}
                onClick={() => setSeoOpen(false)}
                aria-hidden={!seoOpen}
            >
                <article
                    className={styles.seoPanel}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className={styles.infoHeader}>
                        <h1 className={styles.infoTitle}>{t("seo.heading")}</h1>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => setSeoOpen(false)}
                            aria-label="Close"
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    <div className={styles.infoBody}>
                        <p className={styles.seoText}>{t("seo.p1")}</p>
                        <p className={styles.seoText}>{t("seo.p2")}</p>
                        <p className={styles.seoText}>{t("seo.p3")}</p>
                    </div>
                </article>
            </div>
        </div>
    );
});

function CloseIcon() {
    return (
        <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

export default PianoControls;
