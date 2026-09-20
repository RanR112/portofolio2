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

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./PianoControls.module.scss";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BAR_COLORS, isTextEntryTarget, type KeyMode } from "@/lib/keyMap";
import SongPicker from "@/components/piano/SongPicker/SongPicker";
import { loadSongIndex, type SongIndexEntry } from "@/lib/piano/songIndex";
import type { PlaybackMode } from "@/lib/piano/playback";
import type { PlaybackUiStatus } from "@/hooks/usePianoPlayback";
import type { TabToken } from "@/lib/piano/parseTab";
import Image from "next/image";
import { Logo } from "@/assets/index.assets";
import {
    ChevronDown,
    FileMusic,
    Info,
    Maximize,
    Minimize,
    Pause,
    Play,
    Square,
} from "lucide-react";

// [BARU] 5 tingkat kecepatan auto-scroll sheet, index 0 = level 1 (paling
// lambat) s/d index 4 = level 5 (paling cepat). Satu tempat ubah kalau nanti
// kecepatannya perlu di-tuning.
const SPEED_LEVEL_PX_PER_SEC = [5, 10, 20, 35, 55];

/**
 * [BARU] Pecah tab mentah jadi potongan teks biasa + <span> per token berbunyi,
 * supaya simbol yang sedang dimainkan bisa disorot satu per satu.
 *
 * Teks di ANTARA token (spasi, tanda jeda, ganti baris, baris anotasi) ikut
 * dirender apa adanya, jadi tata letak sheet persis seperti file aslinya.
 * Grup [..]/{..} sudah jadi satu token di parser, jadi akor otomatis tersorot
 * utuh — bukan sebagian karakternya.
 */
function renderSheetTokens(
    raw: string,
    tokens: TabToken[],
): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    let cursor = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.start > cursor) out.push(raw.slice(cursor, t.start));
        out.push(
            <span key={i} data-token={i} className={styles.sheetToken}>
                {raw.slice(t.start, t.end)}
            </span>,
        );
        cursor = t.end;
    }
    if (cursor < raw.length) out.push(raw.slice(cursor));
    return out;
}

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

    // [BARU] Isi panel Sheets dimiliki Piano.tsx, karena yang mengisinya bisa
    // user (tempel manual) ATAU lagu yang dipilih. Tipenya dispatcher React
    // supaya pembaruan bentuk fungsi (setX(v => !v)) tetap bisa dipakai —
    // pola yang sama dengan state engine di usePianoEngine.
    sheetsOpen: boolean;
    onSheetsOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
    sheetText: string;
    onSheetTextChange: React.Dispatch<React.SetStateAction<string>>;

    // [BARU] Pemutaran lagu — state machine-nya ada di usePianoPlayback.
    playbackStatus: PlaybackUiStatus;
    playbackError: string | null;
    /**
     * Sebab error yang punya terjemahan sendiri. Kalau terisi, pesan
     * terjemahannya yang dipakai — bukan `playbackError` yang teks mentah.
     */
    playbackErrorCode: "needs-keyboard-lock" | null;
    /**
     * Token berbunyi lagu yang sedang dimuat, beserta posisinya di tab mentah.
     * null = tidak ada lagu (panel Sheets kembali jadi textarea biasa).
     */
    playbackTokens: TabToken[] | null;
    /** Indeks token yang sedang disorot. Ref — highlight digerakkan via DOM. */
    activeTokenRef: React.MutableRefObject<number>;
    onStartSong: (song: SongIndexEntry, mode: PlaybackMode) => void;
    onPausePlayback: () => void;
    onResumePlayback: () => void;
    onStopPlayback: () => void;
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
    sheetsOpen,
    onSheetsOpenChange: setSheetsOpen,
    sheetText: sheetsText,
    onSheetTextChange: setSheetsText,
    playbackStatus,
    playbackError,
    playbackErrorCode,
    playbackTokens,
    activeTokenRef,
    onStartSong,
    onPausePlayback,
    onResumePlayback,
    onStopPlayback,
}: PianoControlsProps) {
    const locale = useLocale();
    const t = useTranslations("piano");
    const transDisplay = transpose > 0 ? `+${transpose}` : String(transpose);

    const [infoOpen, setInfoOpen] = useState(false);
    const [seoOpen, setSeoOpen] = useState(false);

    // [BARU] Bar color dibungkus jadi dropdown — sebelumnya seluruh swatch
    // langsung tampil berjajar di toolbar. Dibungkus supaya ada ruang untuk
    // menambahkan opsi lain ke panel ini nanti (bukan cuma warna) tanpa
    // toolbar utama makin penuh.
    const [colorOpen, setColorOpen] = useState(false);
    const colorMenuRef = useRef<HTMLDivElement>(null);
    const currentColor =
        BAR_COLORS.find((c) => c.value === barColor) ?? BAR_COLORS[0];

    // Tutup saat klik di luar panel atau tekan Escape. Listener hanya
    // terpasang selagi panel terbuka, jadi nol biaya saat piano dimainkan
    // normal (dropdown tertutup).
    useEffect(() => {
        if (!colorOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            if (
                colorMenuRef.current &&
                !colorMenuRef.current.contains(e.target as Node)
            ) {
                setColorOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setColorOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [colorOpen]);

    // ── [BARU] Daftar lagu (tombol PLAY) ────────────────────────────────────
    const [pickerOpen, setPickerOpen] = useState(false);
    const isPlaying = playbackStatus === "playing";
    const isPaused = playbackStatus === "paused";
    /**
     * Ada lagu di panel Sheets (jalan atau dijeda). Selagi ini true, panel
     * menampilkan lapisan token yang bisa disorot, BUKAN textarea — dan kontrol
     * gulir manual disembunyikan supaya tidak ada dua penggulir yang berebut
     * menulis transform yang sama.
     */
    const songActive = isPlaying || isPaused;
    const [songs, setSongs] = useState<SongIndexEntry[] | null>(null);
    const [songsLoading, setSongsLoading] = useState(false);
    const [songsError, setSongsError] = useState<string | null>(null);
    const songsRequestedRef = useRef(false);
    const playMenuRef = useRef<HTMLDivElement>(null);

    // Index lagu baru diambil saat panel PERTAMA KALI dibuka — pengunjung yang
    // tidak pernah menyentuh PLAY tidak membayar request apa pun. Hasilnya
    // disimpan, jadi membuka-tutup panel tidak mengambil ulang.
    useEffect(() => {
        if (!pickerOpen || songsRequestedRef.current) return;
        songsRequestedRef.current = true;

        let cancelled = false;
        setSongsLoading(true);
        setSongsError(null);
        loadSongIndex()
            .then((list) => {
                if (!cancelled) setSongs(list);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setSongsError(e instanceof Error ? e.message : String(e));
                // Biarkan bisa dicoba lagi saat panel dibuka berikutnya.
                songsRequestedRef.current = false;
            })
            .finally(() => {
                if (!cancelled) setSongsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [pickerOpen]);

    // Tutup saat klik di luar atau Escape — pola yang sama dengan dropdown Bar
    // Color. (Panel Sheets sengaja TIDAK begitu, karena ia memang untuk dilihat
    // sambil bermain; daftar lagu justru menu sekali pakai.)
    useEffect(() => {
        if (!pickerOpen) return;

        const onPointerDown = (e: PointerEvent) => {
            if (
                playMenuRef.current &&
                !playMenuRef.current.contains(e.target as Node)
            ) {
                setPickerOpen(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") setPickerOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [pickerOpen]);

    // [BARU] Panel Sheets — box di kanan atas untuk paste sheet (notasi
    // QWERTY), dibuka lewat tombol Sheets atau shortcut "/". Untuk langkah
    // ini baru textarea-nya saja; parsing/pemutaran sheet menyusul.
    //
    // Sengaja TIDAK tertutup saat klik di luar panel (beda dari dropdown Bar
    // Color) — tujuan panel ini justru dilihat SAMBIL bermain, jadi klik di
    // tuts/kontrol lain tidak boleh menutupnya. Hanya tiga cara menutup:
    // tombol X, menekan tombol Sheets lagi, atau shortcut "/" saat fokus
    // tidak sedang di dalam textarea-nya sendiri (lihat guard isTextEntryTarget
    // di bawah). Escape juga sengaja tidak dipakai untuk menutup, supaya
    // ketiga cara itu konsisten menjadi satu-satunya jalan tertutup.
    const sheetsTextareaRef = useRef<HTMLTextAreaElement>(null);
    // [BARU] Lihat penjelasan lengkap di efek auto-scroll di bawah — dipakai
    // untuk mengukur tinggi viewport (sheetsBoxRef) dan menggerakkan teks
    // bayangan lewat transform (sheetsMirrorInnerRef) selagi auto-scroll aktif.
    const sheetsBoxRef = useRef<HTMLDivElement>(null);
    const sheetsMirrorInnerRef = useRef<HTMLDivElement>(null);

    /**
     * Apakah pembukaan panel berikutnya layak mengambil fokus keyboard.
     *
     * HANYA diisi oleh aksi user (tombol SHEETS / shortcut "/"). Saat panel
     * dibuka karena sebuah LAGU dipilih, fokus tidak boleh diambil: textarea
     * adalah tempat mengetik teks, jadi begitu ia fokus, isTextEntryTarget
     * memblokir seluruh input keyboard piano — pianonya tiba-tiba mati tanpa
     * penjelasan, dan di mode learn itu justru tuts yang harus ditekan.
     */
    const focusOnOpenRef = useRef(false);
    // Cermin sheetsOpen supaya handler dengan identitas stabil (mis. listener
    // "/" yang dipasang sekali) tidak memegang nilai basi.
    const sheetsOpenRef = useRef(sheetsOpen);
    useEffect(() => {
        sheetsOpenRef.current = sheetsOpen;
    }, [sheetsOpen]);

    const toggleSheets = useCallback(() => {
        // Catat niat hanya kalau ini aksi MEMBUKA, bukan menutup.
        focusOnOpenRef.current = !sheetsOpenRef.current;
        setSheetsOpen((v) => !v);
    }, [setSheetsOpen]);

    // Shortcut "/" — didengarkan terus (bukan cuma selagi terbuka), sama
    // seperti SPACE untuk sustain. isTextEntryTarget mencegah "/" yang
    // diketik di dalam textarea sheet itu sendiri (atau field teks lain)
    // ikut men-toggle panelnya alih-alih hanya mengetik karakternya — jadi
    // "/" hanya menutup panel saat ditekan DI LUAR textarea-nya.
    useEffect(() => {
        const onSlash = (e: KeyboardEvent) => {
            if (e.key !== "/") return;
            if (isTextEntryTarget(e.target)) return;
            e.preventDefault();
            toggleSheets();
        };
        document.addEventListener("keydown", onSlash);
        return () => document.removeEventListener("keydown", onSlash);
    }, [toggleSheets]);

    // Fokus otomatis ke textarea supaya user bisa langsung Ctrl+V tanpa
    // mengklik dulu — TAPI hanya kalau user sendiri yang membuka panelnya DAN
    // tidak ada lagu yang sedang jalan. Mengambil fokus di luar dua keadaan itu
    // akan mematikan keyboard piano secara diam-diam (lihat focusOnOpenRef).
    useEffect(() => {
        if (!sheetsOpen) return;
        const wanted = focusOnOpenRef.current;
        focusOnOpenRef.current = false;
        if (!wanted) return;
        if (playbackStatus !== "idle") return;
        sheetsTextareaRef.current?.focus();
    }, [sheetsOpen, playbackStatus]);

    // [BARU] Daftar lagu ditutup begitu pemutaran benar-benar mulai. Selagi
    // status masih "loading" panel dibiarkan terbuka, supaya kalau unduhan
    // tab-nya gagal, pesan errornya masih ada tempat untuk terlihat.
    useEffect(() => {
        if (playbackStatus === "playing") setPickerOpen(false);
    }, [playbackStatus]);

    // [BARU] Auto-scroll sheet — tombol Play/Stop + 5 bar tingkat kecepatan
    // (bukan slider kontinu). Tiap bar mewakili satu tingkat; px/detik untuk
    // tiap tingkat ada di SPEED_LEVEL_PX_PER_SEC di bawah.
    const [autoScroll, setAutoScroll] = useState(false);
    const [speedLevel, setSpeedLevel] = useState(3);

    // Tingkat disimpan juga di ref supaya klik bar tidak perlu me-restart
    // loop rAF di bawah — pola yang sama dipakai di seluruh usePianoEngine
    // (baca nilai terbaru dari ref, bukan dependency effect).
    const speedLevelRef = useRef(3);
    useEffect(() => {
        speedLevelRef.current = speedLevel;
    }, [speedLevel]);

    const onScrollToggle = useCallback(() => {
        setAutoScroll((v) => !v);
    }, []);

    // Panel tertutup (di-unmount, lihat conditional render di JSX) berarti
    // textarea-nya juga hilang dari DOM — hentikan auto-scroll supaya tidak
    // ada loop rAF yang jalan sia-sia menunggu textarea yang sudah tidak ada.
    useEffect(() => {
        if (!sheetsOpen) setAutoScroll(false);
    }, [sheetsOpen]);

    // Begitu ada lagu, auto-scroll manual dimatikan — gulir diambil alih oleh
    // yang mengikuti highlight.
    useEffect(() => {
        if (songActive) setAutoScroll(false);
    }, [songActive]);

    // Loop rAF hanya berjalan selagi autoScroll aktif — sama seperti disiplin
    // "idle saat tidak dipakai" dari optimasi bar layer piano. Delta time
    // dipakai (bukan increment tetap per frame) supaya kecepatan gulir
    // konsisten di refresh rate berapa pun, dan diclamp 100ms untuk kasus
    // tab di-background lalu kembali (sama seperti clamp di usePianoEngine).
    //
    // [PERBAIKAN #2] Percobaan pertama (akumulator float + el.scrollTop)
    // sudah presisi secara matematis, tapi tetap terlihat patah-patah di
    // level 1-2. Sebabnya bukan lagi presisi — itu sudah beres — melainkan
    // KEterbatasan native scrollTop: nilainya selalu dibulatkan ke piksel
    // bulat oleh browser, jadi PERUBAHAN YANG TERLIHAT hanya bisa terjadi
    // sekali per ~1px akumulasi. Di level 1 (mis. 5px/detik) itu berarti
    // lompatan 1px baru terlihat tiap ±200ms, di level 2 tiap ±100ms —
    // cukup jarang untuk terasa sebagai "lompatan", bukan gerakan menerus.
    // Level 3 ke atas melompat cukup sering (≤50ms) untuk terlihat mulus.
    //
    // Solusinya BUKAN mempercepat level 1-2 (itu akan mengubah kecepatan
    // yang sudah owner tentukan pas), melainkan pindah dari native scrollTop
    // (kuantisasi piksel bulat) ke CSS transform: translateY() pada elemen
    // "bayangan" (mirror) yang menampilkan teks yang sama. transform
    // di-composite GPU dengan presisi sub-piksel — persis alasan will-change:
    // transform dipakai di PianoKey.module.scss untuk masalah lain (isolasi
    // repaint), di sini dipakai untuk alasan render sub-piksel yang mulus di
    // kecepatan berapa pun.
    //
    // textarea asli TETAP ada di DOM (disembunyikan visibility:hidden, bukan
    // dilepas) supaya saat Stop ditekan, scrollTop-nya bisa disinkronkan ke
    // posisi bayangan terakhir (dibulatkan) — begitu textarea muncul lagi,
    // posisinya kira-kira pas melanjutkan dari mana bayangan berhenti.
    /**
     * Lapisan bayangan dipakai untuk DUA hal: gulir halus manual (auto-scroll)
     * dan highlight saat ada lagu. Keduanya butuh DOM teks sungguhan, yang
     * mustahil di dalam <textarea>.
     */
    const showMirror = autoScroll || songActive;
    /**
     * Lapisan bayangan BENAR-BENAR ada di DOM.
     *
     * Bedanya penting: panel Sheets di-unmount saat ditutup, sementara
     * showMirror tetap true selama lagu jalan. Kalau efek di bawah hanya
     * bergantung pada showMirror, menutup lalu membuka panel di tengah lagu
     * meninggalkan tokenElsRef menunjuk <span> yang sudah lepas dari DOM —
     * highlight-nya hilang permanen sampai lagu di-restart.
     */
    const mirrorMounted = sheetsOpen && showMirror;
    /** <span> per token, dikumpulkan sekali tiap lagu — bukan tiap frame. */
    const tokenElsRef = useRef<HTMLElement[]>([]);
    const lastTokenRef = useRef(-1);
    const followTargetRef = useRef(0);

    useEffect(() => {
        const inner = sheetsMirrorInnerRef.current;
        if (!mirrorMounted || !inner || !playbackTokens) {
            tokenElsRef.current = [];
            lastTokenRef.current = -1;
            return;
        }
        tokenElsRef.current = Array.from(
            inner.querySelectorAll<HTMLElement>("[data-token]"),
        );
        lastTokenRef.current = -1;
    }, [mirrorMounted, playbackTokens]);

    const scrollAccumRef = useRef(0);
    useEffect(() => {
        if (!mirrorMounted) return;

        // Posisi awal hanya diambil dari textarea untuk gulir manual. Selagi ada
        // lagu, textarea tersembunyi dan scrollTop-nya basi — posisinya diatur
        // oleh lompatan ke token aktif di bawah.
        if (!songActive) {
            scrollAccumRef.current = sheetsTextareaRef.current?.scrollTop ?? 0;
        }
        lastTokenRef.current = -1;

        let rafId: number;
        let lastTs: number | null = null;

        const tick = (ts: number) => {
            const box = sheetsBoxRef.current;
            const inner = sheetsMirrorInnerRef.current;
            if (lastTs === null) lastTs = ts;
            const dt = Math.min(ts - lastTs, 100);
            lastTs = ts;

            if (box && inner) {
                const maxScroll = Math.max(
                    0,
                    inner.scrollHeight - box.clientHeight,
                );

                if (songActive) {
                    // ── Highlight mengikuti playback ─────────────────────────
                    // Hanya bekerja SAAT BERPINDAH: satu classList.remove + satu
                    // add. Selama token aktif tidak berubah (termasuk saat mode
                    // learn menunggu tuts yang benar), frame ini nol kerja.
                    const active = activeTokenRef.current;
                    if (active !== lastTokenRef.current) {
                        // -1 berarti ini pemasangan PERTAMA setelah panel
                        // (di)buka. Di situ posisinya dilompati, bukan di-ease:
                        // kalau di-ease, membuka panel di tengah lagu akan
                        // terlihat menggulir dari awal sheet sampai ke posisi
                        // sekarang.
                        const snap = lastTokenRef.current === -1;
                        const els = tokenElsRef.current;
                        const prev = els[lastTokenRef.current];
                        if (prev) prev.classList.remove(styles.sheetTokenActive);
                        const next = els[active];
                        if (next) {
                            next.classList.add(styles.sheetTokenActive);
                            // offsetTop dibaca HANYA di sini — sekali per
                            // perpindahan token, bukan tiap frame. Kalau dibaca
                            // tiap frame, tiap frame memaksa layout sinkron.
                            followTargetRef.current = Math.max(
                                0,
                                Math.min(
                                    next.offsetTop - box.clientHeight * 0.35,
                                    maxScroll,
                                ),
                            );
                            if (snap) {
                                scrollAccumRef.current =
                                    followTargetRef.current;
                            }
                        }
                        lastTokenRef.current = active;
                    }

                    // Easing berbasis waktu (bukan per frame) supaya kecepatan
                    // gulirnya sama di refresh rate berapa pun.
                    const k = 1 - Math.exp(-dt / 140);
                    scrollAccumRef.current +=
                        (followTargetRef.current - scrollAccumRef.current) * k;
                } else {
                    // ── Auto-scroll manual, kecepatan konstan ────────────────
                    const pxPerSec =
                        SPEED_LEVEL_PX_PER_SEC[speedLevelRef.current - 1];
                    scrollAccumRef.current = Math.min(
                        scrollAccumRef.current + (pxPerSec * dt) / 1000,
                        maxScroll,
                    );
                }

                inner.style.transform = `translateY(-${scrollAccumRef.current}px)`;
            }

            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafId);
            // Sinkronkan textarea asli ke posisi bayangan terakhir sebelum ia
            // terlihat kembali (lihat toggle visibility di JSX).
            const el = sheetsTextareaRef.current;
            if (el) el.scrollTop = Math.round(scrollAccumRef.current);
        };
    }, [mirrorMounted, songActive, activeTokenRef]);

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
                <Image
                    src={Logo}
                    alt="Randy Rafael online piano"
                    width={40}
                    height={40}
                />
            </button>
            <div className={styles.divider} />

            {/* Volume */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>VOL</span>
                <button
                    className={styles.ctrlBtn}
                    onClick={onVolDown}
                    suppressHydrationWarning
                >
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
                <button
                    className={styles.ctrlBtn}
                    onClick={onVolUp}
                    suppressHydrationWarning
                >
                    +
                </button>
                <span className={styles.ctrlValue}>{volume}</span>
            </div>

            <div className={styles.divider} />

            {/* Transpose */}
            <div className={styles.controlGroup}>
                <span className={styles.ctrlLabel}>TRANSPOSE</span>
                <button
                    className={styles.ctrlBtn}
                    onClick={onTranDown}
                    suppressHydrationWarning
                >
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
                <button
                    className={styles.ctrlBtn}
                    onClick={onTranUp}
                    suppressHydrationWarning
                >
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

            {/* [BARU] Slot transport. Saat ada lagu jalan, tombol PLAY
                diganti PAUSE + STOP. Pembungkusnya tetap dirender di kedua
                keadaan supaya panel daftar lagu (yang menggantung padanya)
                tidak kehilangan jangkarnya saat status berubah. */}
            <div className={styles.playWrap} ref={playMenuRef}>
                {isPlaying || isPaused ? (
                    <div className={styles.transport}>
                        <button
                            type="button"
                            className={styles.toolBtn}
                            onClick={isPaused ? onResumePlayback : onPausePlayback}
                            suppressHydrationWarning
                        >
                            {isPaused ? (
                                <Play size={14} />
                            ) : (
                                <Pause size={14} />
                            )}
                            {isPaused ? t("player.resume") : t("player.pause")}
                        </button>
                        <button
                            type="button"
                            className={styles.stopBtn}
                            onClick={onStopPlayback}
                            suppressHydrationWarning
                        >
                            <Square size={14} />
                            {t("player.stop")}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        className={styles.playBtn}
                        onClick={() => setPickerOpen((v) => !v)}
                        title={t("player.openAria")}
                        aria-haspopup="dialog"
                        aria-expanded={pickerOpen}
                        suppressHydrationWarning
                    >
                        <Play size={14} />
                        PLAY
                    </button>
                )}

                {pickerOpen && (
                    <SongPicker
                        songs={songs}
                        loading={songsLoading || playbackStatus === "loading"}
                        error={
                            songsError ??
                            (playbackErrorCode === "needs-keyboard-lock"
                                ? t("player.needsKeyboardLock")
                                : playbackError)
                        }
                        onChoose={onStartSong}
                    />
                )}
            </div>
            <div className={styles.divider} />
            <button
                type="button"
                className={styles.toolBtn}
                onClick={toggleSheets}
                aria-haspopup="true"
                aria-expanded={sheetsOpen}
                suppressHydrationWarning
            >
                <FileMusic size={14} />
                SHEETS
                <span className={styles.keyHint}>/</span>
            </button>

            {/* [BARU] Panel Sheets — box di kanan atas. Textarea saja untuk
                sekarang: tempat paste sheet (notasi QWERTY), belum ada
                parsing/pemutaran. */}
            {sheetsOpen && (
                <div
                    className={styles.sheetsPanel}
                    role="dialog"
                    aria-label="Sheets"
                >
                    <div className={styles.sheetsPanelHeader}>
                        <span className={styles.sheetsPanelTitle}>
                            SHEETS
                        </span>
                        <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => setSheetsOpen(false)}
                            aria-label="Close sheets panel"
                        >
                            <CloseIcon />
                        </button>
                    </div>
                    {/* [BARU] Wrapper ini membungkus textarea asli (interaktif,
                        disembunyikan selagi auto-scroll) + "bayangan" —
                        klon visualnya yang digerakkan lewat CSS transform
                        untuk gulir sub-piksel yang mulus. Keduanya menumpuk
                        persis (position:absolute inset:0) di box yang sama.
                        Alasan lengkap ada di efek auto-scroll. */}
                    <div className={styles.sheetsTextareaWrap} ref={sheetsBoxRef}>
                        <textarea
                            ref={sheetsTextareaRef}
                            className={`${styles.sheetsTextarea}${showMirror ? ` ${styles.sheetsTextareaHidden}` : ""}`}
                            value={sheetsText}
                            onChange={(e) => setSheetsText(e.target.value)}
                            placeholder="Paste your sheets here"
                            spellCheck={false}
                            readOnly={songActive}
                        />
                        {showMirror && (
                            <div className={styles.sheetsScrollMirror}>
                                <div
                                    ref={sheetsMirrorInnerRef}
                                    className={styles.sheetsScrollMirrorInner}
                                >
                                    {playbackTokens
                                        ? renderSheetTokens(
                                              sheetsText,
                                              playbackTokens,
                                          )
                                        : sheetsText}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* [BARU] Auto-scroll manual. Disembunyikan selagi ada lagu:
                        gulir sudah mengikuti highlight, dan dua penggulir yang
                        menulis transform yang sama akan saling berebut. */}
                    {!songActive && (
                        <div className={styles.sheetsScrollControls}>
                        <button
                            type="button"
                            className={`${styles.sustainBtn}${autoScroll ? ` ${styles.active}` : ""}`}
                            onClick={onScrollToggle}
                            aria-pressed={autoScroll}
                            suppressHydrationWarning
                        >
                            <span className={styles.led} />
                            {autoScroll ? (
                                <>
                                    <Square size={13} />
                                    STOP
                                </>
                            ) : (
                                <>
                                    <Play size={13} />
                                    PLAY
                                </>
                            )}
                        </button>
                        <div className={styles.sheetsSpeedGroup}>
                            <span className={styles.ctrlLabel}>SPEED</span>
                            <div
                                className={styles.speedBars}
                                role="group"
                                aria-label="Scroll speed"
                            >
                                {SPEED_LEVEL_PX_PER_SEC.map((_, i) => {
                                    const level = i + 1;
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            className={`${styles.speedBar}${level <= speedLevel ? ` ${styles.speedBarActive}` : ""}`}
                                            onClick={() =>
                                                setSpeedLevel(level)
                                            }
                                            aria-pressed={
                                                level === speedLevel
                                            }
                                            aria-label={`Speed level ${level}`}
                                            suppressHydrationWarning
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            )}

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

            {/* Bar Color
                [LAMA] Sebelumnya seluruh 8 swatch tampil berjajar langsung di
                toolbar (lihat .colorSwatches lama di .module.scss). Sekarang
                dibungkus jadi dropdown supaya ada ruang menambah fitur lain
                ke panel ini nanti tanpa toolbar utama makin sesak.
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
            */}
            <div className={styles.controlGroup} ref={colorMenuRef}>
                <span className={styles.ctrlLabel}>BAR COLOR</span>
                <div className={styles.colorDropdown}>
                    <button
                        type="button"
                        className={styles.colorTrigger}
                        onClick={() => setColorOpen((v) => !v)}
                        aria-haspopup="true"
                        aria-expanded={colorOpen}
                        aria-label={`Bar color: ${currentColor.label}`}
                        title={currentColor.label}
                        suppressHydrationWarning
                    >
                        <span
                            className={styles.colorSwatchPreview}
                            style={{ background: currentColor.value }}
                        />
                        <ChevronDown
                            size={14}
                            className={`${styles.chevron}${colorOpen ? ` ${styles.chevronOpen}` : ""}`}
                        />
                    </button>

                    {colorOpen && (
                        <div className={styles.colorPanel} role="menu">
                            <span className={styles.colorPanelHeading}>
                                Bar Color
                            </span>
                            <div className={styles.colorSwatches}>
                                {BAR_COLORS.map((c) => (
                                    <div
                                        key={c.value}
                                        role="menuitemradio"
                                        aria-checked={barColor === c.value}
                                        aria-label={c.label}
                                        className={`${styles.swatch}${barColor === c.value ? ` ${styles.selected}` : ""}`}
                                        style={{ background: c.value }}
                                        title={c.label}
                                        onClick={() => {
                                            onBarColorChange(c.value);
                                            setColorOpen(false);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right-aligned actions: fullscreen · info · close */}
            <div className={styles.rightCluster}>
                <button
                    className={styles.iconBtn}
                    onClick={onToggleFullscreen}
                    title={
                        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                    aria-label={
                        isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                    }
                    suppressHydrationWarning
                >
                    {isFullscreen ? (
                        <Minimize size={20} />
                    ) : (
                        <Maximize size={20} />
                    )}
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
