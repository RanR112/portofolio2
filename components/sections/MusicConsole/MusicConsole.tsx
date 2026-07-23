"use client";

// components/sections/MusicConsole/MusicConsole.tsx
//
// Step 14:
//   - Removed "Now Playing" label text from card
//   - Removed active note display under piano
//   - Wired real Web Audio to every key via usePianoAudio
//   - Black keys (C# D# F# G# A#) are interactive + produce sound
//   - "Full Mode" button navigates to /[locale]/piano

import { useState, useCallback } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import SectionWrapper from "@/components/SectionWrapper/SectionWrapper";
import { usePianoAudio } from "@/hooks/usePianoAudio";
import styles from "./MusicConsole.module.scss";

// Full chromatic octave C4–C5
type PianoKey = {
    note: string;
    label: string;
    isBlack: boolean;
};

const PIANO_KEYS: PianoKey[] = [
    { note: "C4", label: "C", isBlack: false },
    { note: "Cs4", label: "C♯", isBlack: true },
    { note: "D4", label: "D", isBlack: false },
    { note: "Ds4", label: "D♯", isBlack: true },
    { note: "E4", label: "E", isBlack: false },
    { note: "F4", label: "F", isBlack: false },
    { note: "Fs4", label: "F♯", isBlack: true },
    { note: "G4", label: "G", isBlack: false },
    { note: "Gs4", label: "G♯", isBlack: true },
    { note: "A4", label: "A", isBlack: false },
    { note: "As4", label: "A♯", isBlack: true },
    { note: "B4", label: "B", isBlack: false },
    { note: "C5", label: "C", isBlack: false },
];

export default function MusicConsole() {
    const { playNote } = usePianoAudio();
    const locale = useLocale();
    const [activeKey, setActiveKey] = useState<string | null>(null);

    const t = useTranslations("music");

    const handleKeyPress = useCallback(
        (note: string) => {
            playNote(note);
            setActiveKey(note);
            setTimeout(() => setActiveKey(null), 180);
        },
        [playNote],
    );

    return (
        <SectionWrapper
            id="music"
            label={t("label")}
            title={t("title")}
            subtitle={t("subtitle")}
        >
            <div className={styles.layout}>
                {/* Piano keyboard — real audio, black + white keys */}
                <div className={styles.pianoWrap}>
                    <div
                        className={styles.piano}
                        role="group"
                        aria-label="Interactive piano keyboard, one octave"
                    >
                        {PIANO_KEYS.map((key) => (
                            <button
                                key={key.note}
                                className={[
                                    styles.key,
                                    key.isBlack
                                        ? styles.keyBlack
                                        : styles.keyWhite,
                                    activeKey === key.note
                                        ? styles.keyActive
                                        : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                                onClick={() => handleKeyPress(key.note)}
                                onMouseDown={(e) => e.preventDefault()} // prevent focus outline on click
                                aria-label={`${key.label} key`}
                                title={key.label}
                            >
                                {!key.isBlack && (
                                    <span
                                        className={styles.keyLabel}
                                        aria-hidden="true"
                                    >
                                        {key.label}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Full Mode button — flags the intent to go fullscreen.
                        The piano page reads this flag on mount and requests
                        fullscreen there (the click's transient activation is
                        still valid across the same-document client navigation),
                        so fullscreen applies to /piano, not /music. */}
                    <Link
                        href={`/${locale}/piano`}
                        className={styles.fullModeButton}
                        aria-label="Open full piano mode"
                        onClick={() => {
                            try {
                                sessionStorage.setItem("piano:fullscreen", "1");
                            } catch {}
                        }}
                    >
                        <ExpandIcon />
                        {t("full")}
                    </Link>
                </div>

                {/* Copy block */}
                <div className={styles.copyBlock}>
                    <p className={styles.copyText}>
                        {t("journey1")}
                    </p>
                    <p className={styles.copyText}>
                        {t("journey2")}
                    </p>
                </div>
            </div>
        </SectionWrapper>
    );
}

function ExpandIcon() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
    );
}
