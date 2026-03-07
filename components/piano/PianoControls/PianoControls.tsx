/**
 * PianoControls.tsx
 *
 * Performance contract
 * ─────────────────────
 * React.memo + stable callback props means this component only re-renders
 * when one of its four value props actually changes (volume, transpose,
 * sustain, barColor). Pressing piano keys never touches any of these.
 */

import React, { useCallback } from "react";
import styles from "./PianoControls.module.scss";
import Link from "next/link";
import { useLocale } from "next-intl";
import { BAR_COLORS } from "@/lib/keyMap";
import Image from "next/image";
import { Logo } from "@/assets/index.assets";

interface PianoControlsProps {
    volume: number;
    transpose: number;
    sustain: boolean;
    barColor: string;
    onVolumeChange: (v: number) => void;
    onTransposeChange: (t: number) => void;
    onSustainToggle: () => void;
    onBarColorChange: (color: string) => void;
}

const PianoControls = React.memo(function PianoControls({
    volume,
    transpose,
    sustain,
    barColor,
    onVolumeChange,
    onTransposeChange,
    onSustainToggle,
    onBarColorChange,
}: PianoControlsProps) {
    const locale = useLocale();
    const transDisplay = transpose > 0 ? `+${transpose}` : String(transpose);

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
            <div className={styles.logo}>
                <Image src={Logo} alt="Logo Website" width={40} height={40} />
            </div>
            <div className={styles.divider} />

            {/* Volume */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>VOL</span>
                <button className={styles.ctrlBtn} onClick={onVolDown}>
                    −
                </button>
                <input
                    type="range"
                    className={styles.volumeSlider}
                    min={0}
                    max={100}
                    value={volume}
                    onChange={onVolSlide}
                />
                <button className={styles.ctrlBtn} onClick={onVolUp}>
                    +
                </button>
                <span className={styles.ctrlValue}>{volume}</span>
            </div>

            <div className={styles.divider} />

            {/* Transpose */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>TRANSPOSE</span>
                <button className={styles.ctrlBtn} onClick={onTranDown}>
                    −
                </button>
                <input
                    type="range"
                    className={styles.transposeSlider}
                    min={-12}
                    max={12}
                    value={transpose}
                    onChange={onTranSlide}
                />
                <button className={styles.ctrlBtn} onClick={onTranUp}>
                    +
                </button>
                <span className={styles.ctrlValue}>{transDisplay}</span>
            </div>

            <div className={styles.divider} />

            {/* Sustain */}
            <button
                className={`${styles.sustainBtn}${sustain ? ` ${styles.active}` : ""}`}
                onClick={onSustainToggle}
            >
                <span className={styles.led} />
                SUSTAIN
                <span className={styles.keyHint}>SPACE</span>
            </button>

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
            <div className={styles.close}>
                <Link href={`/${locale}/music`}>
                    <CloseIcon />
                </Link>
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
