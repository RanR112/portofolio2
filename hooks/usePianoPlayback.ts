"use client";

// ─────────────────────────────────────────────────────────────────────────────
// hooks/usePianoPlayback.ts
//
// State machine + scheduler pemutaran lagu di /piano — satu sumber kebenaran
// untuk "lagu apa yang sedang jalan, mode apa, dan sudah sampai mana".
//
// ── Pembagian tugas ─────────────────────────────────────────────────────────
//
// React state  : HANYA status kasar (idle / loading / running+paused / error).
//                Bentuknya discriminated union, jadi kombinasi mustahil —
//                misalnya "paused padahal tidak ada lagu" — tidak bisa
//                terbentuk sama sekali.
//
// Ref          : posisi lagu (elapsedRef), kursor event, dan daftar not yang
//                sedang ditahan. SENGAJA bukan state: semuanya dibaca/ditulis
//                ~40x per detik, dan kalau itu state, /piano akan re-render 40x
//                per detik dan menghancurkan kontrak performa halaman ini
//                (menekan tuts = nol re-render, lihat Piano.tsx & PianoKey.tsx).
//
// ── Dua mode ────────────────────────────────────────────────────────────────
//
// autoplay : scheduler membunyikan not yang jatuh tempo lewat pressNote —
//            bunyi, animasi tuts, dan bar naik semuanya lewat jalur engine yang
//            sudah ada. User tidak perlu menekan apa pun.
//
// learn    : scheduler TIDAK membunyikan apa pun. Ia hanya menurunkan bar
//            panduan dari atas kanvas ke tuts yang harus ditekan, dan MENAHAN
//            jam di not yang belum ditekan. Karena posisi semua bar diturunkan
//            dari satu angka (songTime), menahan angka itu otomatis membekukan
//            seluruh tampilan serempak — tanpa satu pun pembukuan per bar.
//            Tuts yang salah diabaikan total: tidak memajukan apa pun.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";
import { parseTab, type ParsedSong } from "@/lib/piano/parseTab";
import {
    loadSongIndex,
    loadSongTab,
    type SongIndexEntry,
} from "@/lib/piano/songIndex";
import {
    groupChords,
    learnPressResult,
    learnStep,
    LEARN_LEAD_MS,
    type Chord,
    type GuideState,
    type PlaybackMode,
} from "@/lib/piano/playback";
import { pianoEngine } from "@/lib/pianoEngine";
import { CATCHUP_LIMIT_MS, startTicker } from "@/lib/piano/ticker";

export interface LoadedSong {
    entry: SongIndexEntry;
    mode: PlaybackMode;
    /** tab mentah — yang ditampilkan di panel Sheets */
    tab: string;
    parsed: ParsedSong;
    /** hanya dipakai mode learn */
    chords: Chord[];
}

export type PlaybackState =
    | { status: "idle" }
    | { status: "loading"; entry: SongIndexEntry; mode: PlaybackMode }
    | { status: "running"; song: LoadedSong; paused: boolean }
    | {
          status: "error";
          entry: SongIndexEntry;
          message: string;
          /**
           * Kode sebab yang bisa diterjemahkan UI. `message` tetap diisi teks
           * mentah untuk kasus lain (mis. gagal unduh), tapi kalau `code` ada,
           * UI sebaiknya memakai terjemahannya sendiri.
           */
          code?: "needs-keyboard-lock";
      };

/** Status yang diratakan untuk UI, supaya tombol tidak perlu membongkar union. */
export type PlaybackUiStatus =
    | "idle"
    | "loading"
    | "playing"
    | "paused"
    | "error";

interface UsePianoPlaybackOptions {
    pressNote: (noteLabel: string) => void;
    releaseNote: (noteLabel: string) => void;
    /**
     * Transpose lagu (meta.json) diterapkan ke slider transpose user.
     * Keputusan owner: nilainya DIBIARKAN apa adanya saat lagu berhenti —
     * tidak dipulihkan ke nilai sebelumnya.
     */
    setTranspose: (t: number) => void;
    /** Dipanggil sekali saat tab lagu selesai diunduh, untuk panel Sheets. */
    onSheetLoaded: (tab: string) => void;
    /** Sampel audio harus siap dulu, kalau tidak not pertama tidak berbunyi. */
    samplesReady: boolean;
    /** Bar panduan mode learn — diisi di sini, digambar engine. */
    guideRef: React.MutableRefObject<GuideState>;
    /**
     * Dimatikan selagi mode learn: bar panduan sudah TURUN ke tuts, jadi bar
     * yang ikut NAIK dari tuts yang sama bikin tampilannya ramai.
     */
    barsEnabledRef: React.MutableRefObject<boolean>;
    /** Loop gambar engine bisa idle; mode learn harus menyalakannya sendiri. */
    kickLoop: () => void;
    /** Lagu 88 tuts butuh piano dipindah ke mode 88 sebelum diputar. */
    setKeyMode: (mode: 61 | 88) => void;
    /** Mode learn di lagu 88 tuts butuh fullscreen supaya Keyboard Lock aktif. */
    ensureFullscreen: () => void;
}

export interface PianoPlayback {
    state: PlaybackState;
    uiStatus: PlaybackUiStatus;
    /** Posisi lagu dalam ms. Ref, bukan state — lihat catatan di atas. */
    elapsedRef: React.MutableRefObject<number>;
    /** Indeks token sheet yang sedang disorot (-1 = tidak ada). */
    activeTokenRef: React.MutableRefObject<number>;
    start: (entry: SongIndexEntry, mode: PlaybackMode) => void;
    pause: () => void;
    resume: () => void;
    stop: () => void;
    /**
     * Dipasang ke usePianoEngine lewat ref. Mode learn memakainya untuk menilai
     * tuts yang ditekan user benar atau salah. Identitasnya stabil.
     */
    handleUserPress: (noteLabel: string) => void;
}

/** Not yang sedang berbunyi. */
interface HeldNote {
    note: string;
    /** posisi lagu (ms) saat not ini harus dilepas */
    releaseAt: number;
    /**
     * Jalur mana yang dipakai saat menekannya, supaya pelepasannya lewat jalur
     * yang sama. Not yang ditekan selagi tab tersembunyi tidak punya sorotan
     * tuts maupun bar untuk dibersihkan.
     */
    visual: boolean;
}

/**
 * Keyboard Lock API — satu-satunya cara kombinasi Ctrl bisa sampai ke halaman
 * alih-alih memicu shortcut browser (Ctrl+W menutup tab, Ctrl+T buka tab baru).
 * Chromium-only. Tanpa ini, 27 tuts ekstra di lagu 88 tuts MUSTAHIL ditekan
 * user — jadi mode learn akan membeku selamanya menunggu not yang tidak bisa
 * dimainkan. Autoplay tidak terpengaruh: scheduler memanggil pressNote
 * langsung, keyboard tidak terlibat.
 */
function keyboardLockSupported(): boolean {
    if (typeof navigator === "undefined") return false;
    const kb = (navigator as Navigator & { keyboard?: { lock?: unknown } })
        .keyboard;
    return typeof kb?.lock === "function";
}

/**
 * Override stepsPerBeat dari URL — dipakai untuk mengalibrasi lagu baru sambil
 * mendengarkan: /piano?spb=3, pilih lagunya, ganti angka, reload. Tanpa ini,
 * mencari angka yang pas berarti mengedit meta.json + menjalankan ulang
 * `npm run songs` tiap percobaan.
 *
 * Dibaca langsung dari window.location, SENGAJA bukan useSearchParams():
 * useSearchParams memaksa halaman keluar dari static rendering kalau tidak
 * dibungkus <Suspense> — masalah yang sudah pernah kena di Projects.tsx.
 */
function readSpbOverride(): number | undefined {
    if (typeof window === "undefined") return undefined;
    const v = Number(new URLSearchParams(window.location.search).get("spb"));
    return Number.isFinite(v) && v > 0 ? v : undefined;
}

export function usePianoPlayback({
    pressNote,
    releaseNote,
    setTranspose,
    onSheetLoaded,
    samplesReady,
    guideRef,
    barsEnabledRef,
    kickLoop,
    setKeyMode,
    ensureFullscreen,
}: UsePianoPlaybackOptions): PianoPlayback {
    const [state, setState] = useState<PlaybackState>({ status: "idle" });

    const elapsedRef = useRef(0);
    const lastTickRef = useRef<number | null>(null);
    const transposeIdxRef = useRef(0);
    const eventIdxRef = useRef(0);
    /**
     * Token sheet yang sedang disorot (-1 = tidak ada). Ref, bukan state: panel
     * Sheets menukar class langsung di DOM dari loop rAF-nya, jadi highlight
     * berpindah tanpa satu pun re-render React.
     */
    const activeTokenRef = useRef(-1);
    /** Token berikutnya yang akan jadi aktif (khusus autoplay, berbasis waktu). */
    const tokenCursorRef = useRef(0);
    const heldRef = useRef<HeldNote[]>([]);
    /**
     * Membatalkan pemuatan yang sudah tidak relevan — user menekan Stop atau
     * memilih lagu lain selagi tab-nya masih diunduh. Tanpa ini, hasil unduhan
     * lama bisa mendarat dan menimpa lagu yang baru dipilih.
     */
    const loadTokenRef = useRef(0);

    /**
     * Keadaan mode learn yang dibaca dari handler input. Disimpan di ref supaya
     * handleUserPress bisa punya identitas STABIL — ia dipasang ke engine lewat
     * ref, jadi kalau identitasnya berubah-ubah, penyadap tekan-tuts di engine
     * bisa memegang closure basi.
     */
    const learnRef = useRef<{
        active: boolean;
        chords: Chord[];
        /** indeks akor yang sedang ditunggu */
        idx: number;
        /** not dari akor itu yang sudah ditekan user */
        pressed: Set<string>;
    }>({ active: false, chords: [], idx: 0, pressed: new Set() });

    // Handler terbaru disimpan di ref supaya loop ticker tidak perlu
    // dibongkar-pasang tiap kali identitas callback berubah.
    const pressRef = useRef(pressNote);
    const releaseRef = useRef(releaseNote);
    useEffect(() => {
        pressRef.current = pressNote;
        releaseRef.current = releaseNote;
    }, [pressNote, releaseNote]);

    const releaseAllHeld = useCallback(() => {
        for (const h of heldRef.current) {
            if (h.visual) releaseRef.current(h.note);
            else pianoEngine.stopNote(h.note);
        }
        heldRef.current = [];
    }, []);

    const clearGuide = useCallback(() => {
        const g = guideRef.current;
        g.active = false;
        g.clockAt = null;
        g.notes = [];
        // Bar naik dinyalakan kembali: di luar mode learn, menekan tuts memang
        // harus memunculkan bar seperti biasa.
        barsEnabledRef.current = true;
    }, [guideRef, barsEnabledRef]);

    const resetCursor = useCallback(() => {
        elapsedRef.current = 0;
        lastTickRef.current = null;
        transposeIdxRef.current = 0;
        eventIdxRef.current = 0;
        activeTokenRef.current = -1;
        tokenCursorRef.current = 0;
        learnRef.current.active = false;
        learnRef.current.idx = 0;
        learnRef.current.pressed.clear();
    }, []);

    const start = useCallback(
        (entry: SongIndexEntry, mode: PlaybackMode) => {
            // Mode learn di lagu 88 tuts mustahil dimainkan tanpa Keyboard
            // Lock: tuts ctrl-nya tidak akan pernah sampai ke halaman, dan bar
            // panduan akan membeku selamanya menunggu not yang tidak bisa
            // ditekan. Lebih baik ditolak dengan alasan jelas daripada
            // membiarkan user tersangkut.
            if (mode === "learn" && entry.keyMode === 88 && !keyboardLockSupported()) {
                setState({
                    status: "error",
                    entry,
                    code: "needs-keyboard-lock",
                    message: "Keyboard Lock tidak tersedia di browser ini.",
                });
                return;
            }

            // Keduanya WAJIB dijalankan sebelum await apa pun di bawah:
            // requestFullscreen hanya diizinkan selama gesture user (klik
            // tombol) masih berlaku, dan itu kedaluwarsa begitu kita menunggu
            // unduhan tab.
            setKeyMode(entry.keyMode);
            if (mode === "learn" && entry.keyMode === 88) ensureFullscreen();

            const token = ++loadTokenRef.current;
            releaseAllHeld();
            resetCursor();
            setState({ status: "loading", entry, mode });

            void (async () => {
                try {
                    const tab = await loadSongTab(entry);
                    if (loadTokenRef.current !== token) return;

                    const spbOverride = readSpbOverride();
                    const stepsPerBeat = spbOverride ?? entry.stepsPerBeat;
                    const parsed = parseTab(tab, {
                        bpm: entry.bpm,
                        transpose: entry.transpose,
                        stepsPerBeat,
                    });

                    if (spbOverride !== undefined) {
                        console.info(
                            `[piano] "${entry.title}" — stepsPerBeat ditimpa URL: ${spbOverride} ` +
                                `(meta.json: ${entry.stepsPerBeat}) → 1 slot = ${Math.round(parsed.stepMs)}ms, ` +
                                `durasi ${(parsed.durationMs / 1000).toFixed(1)}s`,
                        );
                    }
                    if (parsed.warnings.length) {
                        console.warn(
                            `[piano] "${entry.title}" punya ${parsed.warnings.length} warning parse:`,
                            parsed.warnings,
                        );
                    }

                    onSheetLoaded(tab);

                    // Transpose awal lagu langsung diterapkan ke slider user.
                    // Entri [0] selalu ada (lihat parseTab), dan sudah terpakai
                    // di sini — jadi kursornya mulai dari 1.
                    setTranspose(parsed.transposeChanges[0].transpose);
                    transposeIdxRef.current = 1;

                    const chords =
                        mode === "learn" ? groupChords(parsed.events) : [];

                    // Mode learn mulai dari waktu NEGATIF sebesar lead time,
                    // supaya bar not pertama punya kesempatan jatuh dari atas
                    // dulu. Tanpa ini, not pertama langsung nongkrong di garis
                    // tuts begitu lagu dipilih.
                    elapsedRef.current = mode === "learn" ? -LEARN_LEAD_MS : 0;

                    // Mode learn: bar naik dimatikan supaya hanya bar panduan
                    // yang turun yang terlihat.
                    barsEnabledRef.current = mode !== "learn";

                    learnRef.current.active = mode === "learn";
                    learnRef.current.chords = chords;
                    learnRef.current.idx = 0;
                    learnRef.current.pressed.clear();

                    setState({
                        status: "running",
                        song: { entry, mode, tab, parsed, chords },
                        paused: false,
                    });
                } catch (e) {
                    if (loadTokenRef.current !== token) return;
                    setState({
                        status: "error",
                        entry,
                        message: e instanceof Error ? e.message : String(e),
                    });
                }
            })();
        },
        [
            onSheetLoaded,
            releaseAllHeld,
            resetCursor,
            setTranspose,
            barsEnabledRef,
            setKeyMode,
            ensureFullscreen,
        ],
    );

    const pause = useCallback(() => {
        // Not yang sedang ditahan dilepas, kalau tidak sorotan tutsnya akan
        // membeku menyala selama jeda.
        releaseAllHeld();
        // Bar panduan dibiarkan TERLIHAT tapi dibekukan. clockAt wajib di-null
        // di sini: selagi dijeda, ticker berhenti, jadi kalau clockAt masih
        // berisi angka, engine akan terus menginterpolasi maju dan barnya jalan
        // sendiri padahal lagunya berhenti.
        guideRef.current.clockAt = null;
        learnRef.current.active = false;
        setState((s) =>
            s.status === "running" && !s.paused ? { ...s, paused: true } : s,
        );
    }, [releaseAllHeld, guideRef]);

    const resume = useCallback(() => {
        // Titik acuan dibuang supaya durasi jeda tidak terhitung sebagai
        // kemajuan lagu; tick pertama setelah resume hanya menetapkan acuan baru.
        lastTickRef.current = null;
        setState((s) => {
            if (s.status !== "running" || !s.paused) return s;
            learnRef.current.active = s.song.mode === "learn";
            return { ...s, paused: false };
        });
    }, []);

    const stop = useCallback(() => {
        // Batalkan pemuatan yang mungkin masih berjalan, lalu reset total.
        // Memilih lagu lain setelah ini = start bersih, tanpa sisa state.
        loadTokenRef.current++;
        releaseAllHeld();
        clearGuide();
        resetCursor();
        setState({ status: "idle" });
    }, [releaseAllHeld, clearGuide, resetCursor]);

    /**
     * User menekan sebuah tuts (keyboard / mouse / sentuh / glissando).
     *
     * Aturan mode learn: hanya not dari akor yang sedang ditunggu yang dihitung.
     * Tuts SALAH sengaja diabaikan total — tidak memajukan apa pun, tidak ada
     * penalti — jadi barnya tetap menggantung di garis tuts sampai not yang
     * benar ditekan, persis seperti yang diminta.
     *
     * Identitasnya stabil (nol dependency): ia dipasang ke engine lewat ref,
     * dan seluruh keadaan yang dibutuhkannya dibaca dari learnRef saat dipanggil.
     */
    const handleUserPress = useCallback((noteLabel: string) => {
        const l = learnRef.current;
        if (!l.active) return;

        const result = learnPressResult(l.chords[l.idx], l.pressed, noteLabel);
        if (result === "wrong") return;
        if (result === "partial") {
            l.pressed.add(noteLabel);
            return;
        }
        // Akor lengkap → maju, jam jalan lagi.
        l.idx++;
        l.pressed.clear();
    }, []);

    // ── Jam + scheduler ──────────────────────────────────────────────────────
    const isTicking = state.status === "running" && !state.paused;
    const song = state.status === "running" ? state.song : null;

    useEffect(() => {
        if (!isTicking || !song) return;

        const { events, tokens, transposeChanges, durationMs } = song.parsed;
        const isAutoplay = song.mode === "autoplay";

        /** Satu langkah mode learn — aturannya ada di learnStep (lib, murni). */
        function advanceLearn(now: number): void {
            const l = learnRef.current;
            const r = learnStep({
                chords: l.chords,
                idx: l.idx,
                songTime: elapsedRef.current,
                leadMs: LEARN_LEAD_MS,
            });
            elapsedRef.current = r.songTime;

            const g = guideRef.current;
            g.active = true;
            g.songTime = r.songTime;
            g.clockAt = r.frozen ? null : now;
            g.leadMs = LEARN_LEAD_MS;
            g.notes = r.notes;

            // Loop gambar engine berhenti sendiri saat kanvas kosong, dan di
            // mode learn bisa jadi belum ada satu pun tuts ditekan — jadi ia
            // harus dinyalakan dari sini. Murah: langsung keluar kalau loopnya
            // sudah jalan.
            kickLoop();
        }

        return startTicker(() => {
            const now = performance.now();
            const prev = lastTickRef.current;
            lastTickRef.current = now;
            if (prev === null) return; // tick pertama: cuma tetapkan acuan

            // Delta diclamp, BUKAN dikejar. Efeknya: kalau jam sempat beku
            // (laptop sleep, throttling ekstrem), lagu ikut berhenti di tempat
            // lalu lanjut — bukan melompat ke depan lalu memuntahkan puluhan
            // not serempak. Untuk mode learn ini wajib (not yang harus ditekan
            // user tidak boleh terlewat), dan untuk autoplay pun lebih enak:
            // lagunya utuh, cuma bergeser.
            elapsedRef.current += Math.min(now - prev, CATCHUP_LIMIT_MS);

            if (!isAutoplay) advanceLearn(now);

            // `elapsed` dibaca SETELAH mode learn berkesempatan menahan jam.
            // Kalau dibaca sebelumnya, perubahan transpose bisa berlaku lebih
            // awal — bahkan langsung — padahal barnya masih menggantung
            // menunggu tuts yang benar.
            const elapsed = elapsedRef.current;

            // Perubahan transpose di tengah lagu (baris "Transpose by:" di tab).
            while (
                transposeIdxRef.current < transposeChanges.length &&
                transposeChanges[transposeIdxRef.current].time <= elapsed
            ) {
                setTranspose(transposeChanges[transposeIdxRef.current].transpose);
                transposeIdxRef.current++;
            }

            // Highlight di panel Sheets. Autoplay: maju mengikuti waktu, dan
            // SENGAJA tetap diam di not terakhir yang berbunyi selama jeda
            // (`-` `,` `...`) — kalau ikut berjalan melewati simbol jeda,
            // sorotannya akan terlihat berkedip-kedip. Learn: selalu not yang
            // sedang ditunggu, jadi ia otomatis diam di tempat selama user belum
            // menekan tuts yang benar.
            if (isAutoplay) {
                while (
                    tokenCursorRef.current < tokens.length &&
                    tokens[tokenCursorRef.current].time <= elapsed
                ) {
                    activeTokenRef.current = tokenCursorRef.current;
                    tokenCursorRef.current++;
                }
            } else {
                const idx = learnRef.current.idx;
                activeTokenRef.current = idx < tokens.length ? idx : -1;
            }

            if (isAutoplay) {
                const held = heldRef.current;

                // Lepas dulu, baru tekan. Urutan ini penting: not yang sama di
                // dua slot berurutan (mis. "1 1") punya waktu lepas dan waktu
                // tekan yang persis sama, dan pressNote mengabaikan tuts yang
                // masih ditahan.
                for (let i = held.length - 1; i >= 0; i--) {
                    if (held[i].releaseAt > elapsed) continue;
                    const h = held[i];
                    if (h.visual) releaseRef.current(h.note);
                    else pianoEngine.stopNote(h.note);
                    held.splice(i, 1);
                }

                while (
                    eventIdxRef.current < events.length &&
                    events[eventIdxRef.current].time <= elapsed
                ) {
                    const e = events[eventIdxRef.current++];
                    if (document.hidden) {
                        // Audio saja: jangan sentuh DOM/bar selagi tab
                        // tersembunyi. Loop gambar engine juga ikut berhenti di
                        // tab belakang, jadi kalau bar tetap didaftarkan,
                        // ribuan bar akan menumpuk dan muncul serentak sebagai
                        // "dinding" begitu tab dibuka lagi. midi dari parser
                        // sudah memuat transpose lagu, jadi tidak perlu lewat
                        // transpose engine.
                        pianoEngine.playNote(e.note, e.midi);
                        held.push({
                            note: e.note,
                            releaseAt: e.time + e.duration,
                            visual: false,
                        });
                    } else {
                        pressRef.current(e.note);
                        held.push({
                            note: e.note,
                            releaseAt: e.time + e.duration,
                            visual: true,
                        });
                    }
                }
            }

            if (elapsedRef.current >= durationMs) {
                // Selesai natural → balik ke idle, tombol PLAY muncul lagi.
                releaseAllHeld();
                clearGuide();
                resetCursor();
                setState({ status: "idle" });
            }
        });
    }, [
        isTicking,
        song,
        setTranspose,
        resetCursor,
        releaseAllHeld,
        clearGuide,
        guideRef,
        kickLoop,
    ]);

    // Jangan tinggalkan not menggantung kalau halaman ditutup/berpindah.
    useEffect(() => releaseAllHeld, [releaseAllHeld]);

    // ── Auto-start lewat ?tab=<song-id> ──────────────────────────────────────
    //
    // Menggantikan hook kalibrasi lama yang punya scheduler-nya sendiri. Dengan
    // dipindah ke sini, hanya ada SATU scheduler di codebase — perbaikan
    // pindah-tab dan perilaku pause/stop otomatis berlaku untuk kalibrasi juga.
    //
    // Mengikuti pola alat diagnostik yang sudah terbukti di halaman ini
    // (?perf=1 / ?edges=1): tanpa query param-nya, nol dampak untuk pengunjung.
    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (!samplesReady || autoStartedRef.current) return;
        const songId = new URLSearchParams(window.location.search).get("tab");
        if (!songId) return;
        autoStartedRef.current = true;

        let cancelled = false;
        void (async () => {
            try {
                const index = await loadSongIndex();
                if (cancelled) return;
                const entry = index.find((s) => s.id === songId);
                if (!entry) {
                    console.warn(
                        `[piano] lagu "${songId}" tidak ada. Pilihan: ${index.map((s) => s.id).join(", ")}`,
                    );
                    return;
                }
                start(entry, "autoplay");
            } catch (e) {
                console.error("[piano] gagal auto-start:", e);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [samplesReady, start]);

    const uiStatus: PlaybackUiStatus =
        state.status === "running"
            ? state.paused
                ? "paused"
                : "playing"
            : state.status;

    return {
        state,
        uiStatus,
        elapsedRef,
        activeTokenRef,
        start,
        pause,
        resume,
        stop,
        handleUserPress,
    };
}
