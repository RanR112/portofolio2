"use client";

// ─────────────────────────────────────────────────────────────────────────────
// SongPicker.tsx
//
// Daftar lagu yang muncul dari tombol PLAY di toolbar piano.
//
// Komponen ini MURNI presentasional: ia tidak memuat data, tidak menyimpan
// lagu yang sedang diputar, dan tidak tahu apa-apa soal scheduler. Semua itu
// urusan pemanggilnya. Alasannya, pada tahap berikutnya state playback akan
// pindah naik ke Piano.tsx (bareng state machine-nya) — kalau data/state-nya
// ikut di sini, komponen ini harus dibongkar lagi. Sekarang cuma prop-nya yang
// berganti sumber.
//
// Interaksi:
//   - Klik baris lagu  -> buka pilihan mode (Learn / Autoplay) di baris itu.
//   - Ikon play kecil di kanan baris muncul saat hover/fokus, sesuai permintaan
//     owner. Ikon itu BUKAN tombol terpisah, melainkan penanda di dalam tombol
//     barisnya: tombol di dalam tombol itu HTML tidak valid, dan baris penuh
//     jauh lebih mudah disentuh di layar sentuh maupun dinavigasi keyboard.
//     Mengklik ikonnya tetap bekerja karena ia berada di dalam area baris.
//   - Di perangkat tanpa hover, ikonnya ditampilkan permanen (lihat .module.scss).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, Play } from "lucide-react";
import styles from "./SongPicker.module.scss";
import type { SongDifficulty, SongIndexEntry } from "@/lib/piano/songIndex";
import type { PlaybackMode } from "@/lib/piano/playback";

type Filter = "all" | SongDifficulty;

const FILTERS: Filter[] = ["all", "easy", "medium", "hard", "insane"];

/** Kunci i18n dipetakan eksplisit, bukan dirangkai dari string. */
const FILTER_LABEL: Record<Filter, string> = {
    all: "filterAll",
    easy: "filterEasy",
    medium: "filterMedium",
    hard: "filterHard",
    insane: "filterInsane",
};
const DIFFICULTY_LABEL: Record<SongDifficulty, string> = {
    easy: "filterEasy",
    medium: "filterMedium",
    hard: "filterHard",
    insane: "filterInsane",
};

function formatDuration(ms: number): string {
    const total = Math.round(ms / 1000);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

interface SongPickerProps {
    /** null = daftar belum pernah dimuat */
    songs: SongIndexEntry[] | null;
    loading: boolean;
    error: string | null;
    onChoose: (song: SongIndexEntry, mode: PlaybackMode) => void;
}

export default function SongPicker({
    songs,
    loading,
    error,
    onChoose,
}: SongPickerProps) {
    const t = useTranslations("piano.player");
    const [filter, setFilter] = useState<Filter>("all");
    const [openId, setOpenId] = useState<string | null>(null);

    const visible = useMemo(
        () =>
            (songs ?? []).filter(
                (s) => filter === "all" || s.difficulty === filter,
            ),
        [songs, filter],
    );

    return (
        <div className={styles.panel} role="dialog" aria-label={t("title")}>
            <div className={styles.header}>
                <span className={styles.title}>{t("title")}</span>
                <div className={styles.filters} role="group" aria-label={t("title")}>
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            type="button"
                            className={`${styles.filterBtn}${filter === f ? ` ${styles.filterActive}` : ""}`}
                            onClick={() => {
                                setFilter(f);
                                setOpenId(null);
                            }}
                            aria-pressed={filter === f}
                        >
                            {t(FILTER_LABEL[f])}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.body}>
                {loading && <p className={styles.state}>{t("loading")}</p>}
                {error && <p className={styles.stateError}>{error}</p>}
                {!loading && !error && visible.length === 0 && (
                    <p className={styles.state}>{t("empty")}</p>
                )}

                {visible.length > 0 && (
                    <ul className={styles.list}>
                        {visible.map((song) => {
                            const open = openId === song.id;
                            return (
                                <li key={song.id} className={styles.item}>
                                    <button
                                        type="button"
                                        className={styles.row}
                                        onClick={() =>
                                            setOpenId(open ? null : song.id)
                                        }
                                        aria-expanded={open}
                                    >
                                        <span className={styles.rowText}>
                                            <span className={styles.rowTitle}>
                                                {song.title}
                                            </span>
                                            <span className={styles.rowMeta}>
                                                {t(
                                                    DIFFICULTY_LABEL[
                                                        song.difficulty
                                                    ],
                                                )}
                                                {" · "}
                                                {formatDuration(song.durationMs)}
                                                {" · "}
                                                {t("notes", {
                                                    count: song.noteCount,
                                                })}
                                            </span>
                                        </span>
                                        <span
                                            className={styles.rowPlay}
                                            aria-hidden="true"
                                        >
                                            <Play size={14} />
                                        </span>
                                    </button>

                                    {open && (
                                        <div
                                            className={styles.modes}
                                            role="group"
                                            aria-label={t("chooseMode", {
                                                title: song.title,
                                            })}
                                        >
                                            <button
                                                type="button"
                                                className={styles.modeBtn}
                                                onClick={() =>
                                                    onChoose(song, "learn")
                                                }
                                            >
                                                <GraduationCap size={14} />
                                                {t("learn")}
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.modeBtn} ${styles.modeAuto}`}
                                                onClick={() =>
                                                    onChoose(song, "autoplay")
                                                }
                                            >
                                                <Play size={14} />
                                                {t("autoplay")}
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
