"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    ARROW_CODES,
    isTextEntryTarget,
    LOCK_KEYS,
    MIDI_BY_LABEL,
    resolveKeyToNote,
    type KeyMode,
} from "@/lib/keyMap";
import { pianoEngine } from "@/lib/pianoEngine";
import {
    createGuideState,
    type GuideState,
} from "@/lib/piano/playback";

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

// ── Satu skala waktu untuk SEMUA bar ────────────────────────────────────────
// Bar yang ditahan tumbuh dan bar yang sudah dilepas naik memakai laju yang
// SAMA (px/ms, bukan px/frame). Dulu tumbuh 0.18 px/ms sementara naik
// 2.5 px/frame (~0.15 px/ms di 60Hz, 0.30 di 120Hz), jadi not yang mulai
// bersamaan tidak pernah benar-benar sejajar dan bar baru menyusul bar lama.
// Dengan satu laju, posisi vertikal murni fungsi waktu:
//   y = H - PX_PER_MS * (sekarang - waktu event)
// sehingga not yang dimainkan bersamaan selalu sejajar, tanpa perlu dorongan
// per tuts, dan durasi not otomatis jadi panjang bar yang jujur.
const PX_PER_MS = 0.15; // 150 px/detik (sama dengan 2.5px/frame @60fps)

// Celah visual antar not berurutan. Dipotong dari ujung ATAS (onset) tiap bar
// saat menggambar — bukan dari ujung bawah (release). Karena potongannya
// konstan untuk semua bar, sumbu waktu tetap konsisten: semua ujung atas
// bergeser PX yang sama, semua ujung bawah tetap presisi. Not yang bersambung
// persis (legato) mendapat celah NOTE_GAP; not yang punya jeda mendapat
// jeda + NOTE_GAP.
const NOTE_GAP = 3;

const MAX_GROW_FRAC = 0.92;

// Bar di tuts hitam memakai versi warna yang lebih gelap. Tujuannya supaya
// bar yang berada di antara dua tuts putih tidak terlihat "mengambang" dan
// tetap terbaca sebagai bagian dari tuts hitam. Bar tuts putih tidak berubah.
const BLACK_BAR_DARKEN = 0.72;

/**
 * Perkecil komponen RGB dari warna hex 6 digit. Dipakai sekali setiap kali
 * barColor berubah, bukan per frame. Warna non-hex dikembalikan apa adanya.
 */
function darkenHex(hex: string, factor: number): string {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
    const n = Number.parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 0xff) * factor);
    const g = Math.round(((n >> 8) & 0xff) * factor);
    const b = Math.round((n & 0xff) * factor);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// [PINDAH] isTextEntryTarget() sekarang di lib/keyMap.ts (di-import di atas) —
// PianoControls butuh guard yang sama persis untuk shortcut "/" panel Sheets,
// jadi dipindah ke satu tempat bersama alih-alih diduplikasi.

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Geometri satu tuts: untuk posisi bar DAN untuk hit-test glissando. */
export interface KeyGeom {
    /** titik tengah tuts relatif viz area — dipakai menempatkan bar */
    x: number;
    /**
     * Lebar bar = 0.5 x lebar tuts. Bukan 0.72 lagi: tuts hitam berpusat
     * tepat di batas dua tuts putih (jarak pusat cuma 0.5 x lebar tuts
     * putih), sehingga bar putih 0.72 dan bar hitam 0.72 x 0.62 saling
     * bertumpuk ~0.08 x lebar tuts. Dengan 0.5, celah minimum putih-hitam
     * tetap ~0.095 x lebar tuts (≈3px pada 88 tuts desktop).
     */
    width: number;
    /** batas tuts dalam koordinat viewport — dipakai hit-test glissando */
    left: number;
    right: number;
    top: number;
    bottom: number;
    isBlack: boolean;
}

export interface Bar {
    x: number;
    width: number;
    height: number;
    yOffset: number;
    isReleased: boolean;
    keyEl: HTMLElement | null;
    /** Tuts fisik tempat bar ini berada — menentukan varian warna bar. */
    isBlackKey: boolean;
}

/** Tiga stop gradient untuk satu warna bar. */
interface BarStops {
    c0: string;
    c25: string;
    c1: string;
}

export interface PianoEngineRefs {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    vizAreaRef: React.RefObject<HTMLDivElement | null>;
    pianoRef: React.RefObject<HTMLDivElement | null>;
    keyElementsRef: React.MutableRefObject<Record<string, HTMLElement>>;
    activeBarsRef: React.MutableRefObject<Record<string, Bar>>;
    releasedBarsRef: React.MutableRefObject<Bar[]>;
    barColorRef: React.MutableRefObject<string>;
    /**
     * [BARU] Bar panduan mode learn. Diisi usePianoPlayback, dibaca loop gambar
     * di sini. Lihat GuideState di lib/piano/playback.ts untuk kontraknya.
     */
    guideRef: React.MutableRefObject<GuideState>;
    /**
     * [BARU] Apakah menekan tuts memunculkan bar yang naik ke atas.
     *
     * Dimatikan selagi mode learn berjalan: di sana sudah ada bar panduan yang
     * TURUN ke tuts, dan bar yang naik dari tuts yang sama secara bersamaan
     * membuat tampilannya ramai dan membingungkan (permintaan owner). Sorotan
     * tuts dan suaranya tetap jalan — yang dimatikan hanya barnya.
     */
    barsEnabledRef: React.MutableRefObject<boolean>;
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
    /**
     * [BARU] Dipanggil tiap kali sebuah not DITEKAN, dipakai mode learn untuk
     * menilai tuts yang ditekan user benar atau salah.
     *
     * Bentuknya ref supaya identitas callback yang berubah tidak pernah
     * membongkar-pasang handler input. Aman dipanggil dari pressNote: di mode
     * learn scheduler tidak pernah menekan tuts sendiri, jadi semua yang sampai
     * ke sini memang berasal dari user (keyboard, mouse, sentuh, glissando).
     */
    onNotePressRef?: React.MutableRefObject<(noteLabel: string) => void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePianoEngine(options: UsePianoEngineOptions): {
    state: PianoEngineState;
    refs: PianoEngineRefs;
    pressNote: (label: string) => void;
    releaseNote: (label: string) => void;
    /**
     * Lepas BAR saja, tanpa menghentikan audio atau sorotan tuts. Dipakai
     * autoplay ber-timing: bar boleh lebih pendek dari not yang berbunyi.
     */
    releaseBar: (label: string) => void;
    // [BARU] Handler mouse untuk glissando — dipasang di tiap tuts.
    handleKeyMouseDown: (label: string) => void;
    handleKeyMouseEnter: (label: string) => void;
    handleKeyMouseLeave: (label: string) => void;
    repositionBlackKeys: () => void;
    resizeCanvas: () => void;
    /** [BARU] Nyalakan loop gambar dari luar — dipakai bar panduan mode learn. */
    kickLoop: () => void;
    /** [BARU] Masuk fullscreen kalau belum — wajib dipanggil dari gesture user. */
    ensureFullscreen: () => void;
} {
    const { activeClassName, onNotePressRef } = options;

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
    const blackBarColorRef = useRef(
        darkenHex("#f0a63a", BLACK_BAR_DARKEN),
    );
    // allowCtrl gates the Ctrl→note map inside the keydown closure. It is only
    // true when Keyboard Lock is active (Chromium + fullscreen + 88-key mode).
    const allowCtrlRef = useRef(false);

    useEffect(() => {
        transposeRef.current = transpose;
    }, [transpose]);
    useEffect(() => {
        barColorRef.current = barColor;
        blackBarColorRef.current = darkenHex(barColor, BLACK_BAR_DARKEN);
    }, [barColor]);
    useEffect(() => {
        allowCtrlRef.current = lockActive;
    }, [lockActive]);

    // ── Animation refs ─────────────────────────────────────────────────────────
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const vizAreaRef = useRef<HTMLDivElement | null>(null);
    const activeBarsRef = useRef<Record<string, Bar>>({});
    const releasedBarsRef = useRef<Bar[]>([]);
    const guideRef = useRef<GuideState>(createGuideState());
    const barsEnabledRef = useRef(true);
    const rafRef = useRef<number>(0);
    const lastTimeRef = useRef(0);

    // [BARU — perf 1.3] Context di-cache; getContext() tidak perlu dipanggil
    // ulang tiap frame.
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    // [BARU — perf 1.4] Loop rAF dulu berjalan 60fps selamanya, bahkan saat
    // nol bar di layar — termasuk clearRect 1,39 Mpx per frame. Sekarang loop
    // berhenti sendiri saat tidak ada yang digambar dan dinyalakan lagi oleh
    // pressNote(). kickLoopRef dipakai karena fungsi penyalanya hidup di dalam
    // useEffect, sementara pressNote didefinisikan di luar.
    const loopRunningRef = useRef(false);
    const kickLoopRef = useRef<() => void>(() => {});


    // [BARU — perf 1.2] Cache objek gradient + string warna. Dulu tiap bar tiap
    // frame membuat 1 CanvasGradient baru + 3 string baru (color+"00" dst) —
    // pada 8 nada/detik itu ~2.300 objek + ~7.000 string PER DETIK, murni jadi
    // beban garbage collector. Isinya hanya berubah saat --bar-color diganti.
    const gradCacheRef = useRef<Map<string, CanvasGradient>>(new Map());
    const stopsCacheRef = useRef<Map<string, BarStops>>(new Map());

    // ── Piano DOM refs ─────────────────────────────────────────────────────────
    const pianoRef = useRef<HTMLDivElement | null>(null);
    const keyElementsRef = useRef<Record<string, HTMLElement>>({});

    // [BARU — perf 1.1] Cache geometri tiap tuts (titik tengah + lebar bar),
    // relatif terhadap viz area. Posisi tuts TIDAK pernah berubah saat piano
    // dimainkan — hanya saat resize / ganti mode 61-88 / fullscreen — jadi
    // nilai ini cukup diukur pada event-event itu, bukan tiap frame.
    // Sejak glissando ditambahkan, cache ini juga menyimpan batas tuts dalam
    // koordinat viewport (left/right/top/bottom) + isBlack, sehingga deteksi
    // "tuts mana yang ada di bawah jari" bisa dihitung aritmetika murni —
    // tanpa document.elementFromPoint() yang memaksa hit-test DOM tiap gerakan.
    const keyGeomRef = useRef<Record<string, KeyGeom>>({});

    // ── Keyboard tracking ──────────────────────────────────────────────────────
    const pressedPhysRef = useRef<Set<string>>(new Set());
    const keyCodeToNoteRef = useRef<Record<string, string>>({});

    // ── [BARU] Glissando ───────────────────────────────────────────────────────
    // Mouse: satu "jari" saja — kita cukup ingat tuts mana yang sedang ditekan
    // mouse, plus apakah tombolnya sedang ditahan.
    const mouseDownRef = useRef(false);
    const mouseNoteRef = useRef<string | null>(null);
    // Touch: bisa banyak jari sekaligus, jadi dipetakan per identifier sentuhan.
    const touchNotesRef = useRef<Map<number, string>>(new Map());

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

    /**
     * [BARU] Masuk fullscreen KALAU belum — beda dari toggleFullscreen yang
     * juga bisa keluar. Dipakai mode learn pada lagu 88 tuts: Keyboard Lock
     * (satu-satunya cara tuts ctrl bisa ditekan) hanya aktif saat fullscreen.
     *
     * Sama seperti toggleFullscreen, HARUS dipanggil di dalam gesture user —
     * jadi pemanggilnya wajib melakukannya sebelum await apa pun, kalau tidak
     * izin gesture-nya sudah kedaluwarsa dan browser menolak.
     */
    const ensureFullscreen = useCallback(() => {
        if (document.fullscreenElement) return;
        document.documentElement.requestFullscreen().catch(() => {});
    }, []);

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
        // Catatan: SENGAJA tidak di-scale ke devicePixelRatio. Menaikkannya
        // akan menajamkan bar (perubahan visual) SEKALIGUS memperberat render
        // — dua hal yang sama-sama di luar batasan tugas ini.
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        // [BARU — perf 1.2/1.3] Mengubah canvas.width me-reset state context.
        // Ambil ulang context dan buang cache gradient (objeknya terikat ke
        // context lama) supaya tidak ada yang basi.
        ctxRef.current = canvas.getContext("2d");
        gradCacheRef.current.clear();
    }, []);

    // [BARU — perf 1.1] Ukur ulang geometri SEMUA tuts dalam satu batch.
    // Satu kali baca rect viz area, lalu semua tuts berurutan: browser cukup
    // sekali flush layout untuk seluruh batch ini, bukan sekali per tuts.
    // Dipanggil dari repositionBlackKeys() — satu-satunya titik sinkronisasi
    // layout yang sudah ada — jadi semua pemanggil lama otomatis ikut benar.
    const measureKeyGeometry = useCallback(() => {
        const viz = vizAreaRef.current;
        if (!viz) return;
        const keys = keyElementsRef.current;
        const wr = viz.getBoundingClientRect();
        const geom: Record<string, KeyGeom> = {};
        for (const label in keys) {
            const el = keys[label];
            const r = el.getBoundingClientRect();
            geom[label] = {
                x: r.left + r.width / 2 - wr.left,
                // 0.5 (dulu 0.72) — lihat KeyGeom.width: bar putih dan hitam
                // harus tidak saling menimpa secara horizontal.
                width: r.width * 0.5,
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
                isBlack: el.dataset.isBlack === "true",
            };
        }
        keyGeomRef.current = geom;
    }, []);

    const animRegisterKey = useCallback(
        (noteLabel: string, keyEl: HTMLElement) => {
            if (activeBarsRef.current[noteLabel]) return;

            // [LAMA — pre perf] Mengukur ulang tiap kali tuts ditekan:
            // const wr = vizAreaRef.current?.getBoundingClientRect();
            // if (!wr) return;
            // const r = keyEl.getBoundingClientRect();
            // ...x: r.left + r.width / 2 - wr.left, width: r.width * 0.72

            // [BARU — perf 1.1] Baca dari cache. Ini juga menghapus forced
            // reflow dari jalur tekan-tuts, jadi latensi input ikut turun.
            let g = keyGeomRef.current[noteLabel];
            if (!g) {
                // Fallback: tuts ditekan sebelum pengukuran batch sempat jalan
                // (mis. langsung main begitu halaman muncul). Ukur satu tuts
                // ini saja lalu simpan, supaya tidak terulang.
                const viz = vizAreaRef.current;
                if (!viz) return;
                const wr = viz.getBoundingClientRect();
                const r = keyEl.getBoundingClientRect();
                g = {
                    x: r.left + r.width / 2 - wr.left,
                    // Sama dengan measureKeyGeometry: 0.5, bukan 0.72.
                    width: r.width * 0.5,
                    left: r.left,
                    right: r.right,
                    top: r.top,
                    bottom: r.bottom,
                    isBlack: keyEl.dataset.isBlack === "true",
                };
                keyGeomRef.current[noteLabel] = g;
            }

            activeBarsRef.current[noteLabel] = {
                x: g.x,
                width: g.width,
                // Mulai dari 0, bukan 2px. Tambahan tinggi konstan akan
                // membuat not bersambung saling menimpa 2px lagi meskipun
                // laju tumbuh dan naik sudah sama.
                height: 0,
                yOffset: 0,
                isReleased: false,
                keyEl,
                // Warna bar mengikuti tuts fisik, bukan pitch yang berbunyi:
                // transposisi tidak memindahkan bar ke tuts lain.
                isBlackKey: g.isBlack,
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

        // [LAMA — pre perf] syncPositions() dipanggil TIAP FRAME dan memanggil
        // getBoundingClientRect() untuk viz area + tiap tuts yang ditahan.
        // Tiap panggilan itu memaksa layout sinkron (forced reflow) — dan
        // karena pressNote() baru saja melakukan classList.add() pada tuts yang
        // sama, style-nya "dirty" sehingga browser harus flush style recalc +
        // layout tiap kali. Tahan 10 jari = ~660 forced reflow per detik,
        // padahal posisi tuts tidak pernah berubah saat dimainkan.
        // Digantikan keyGeomRef + measureKeyGeometry() yang berbasis event.
        //
        // function syncPositions(): void {
        //     const wr = vizAreaRef.current?.getBoundingClientRect();
        //     if (!wr) return;
        //     Object.values(activeBarsRef.current).forEach((bar) => {
        //         if (!bar.keyEl) return;
        //         const r = bar.keyEl.getBoundingClientRect();
        //         bar.x = r.left + r.width / 2 - wr.left;
        //         bar.width = r.width * 0.72;
        //     });
        // }

        // [BARU — perf 1.2] Tiga string warna dihitung sekali per warna, bukan
        // 3x per bar per frame.
        function getStops(color: string): BarStops {
            const cache = stopsCacheRef.current;
            const hit = cache.get(color);
            if (hit) return hit;

            const next: BarStops = {
                // Dulu c0 = "00" (transparan total). Saat bar bertumpuk, ujung
                // atas yang bening itu memperlihatkan bar di belakangnya dan
                // muncullah pita fade yang membuat not tampak menyatu. Dengan
                // NOTE_GAP bar sudah terpisah, alpha 0x55 membuat tiap segmen
                // tetap terbaca sebagai satu balok utuh.
                c0: color + "55",
                c25: color + "cc",
                c1: color + "ff",
            };
            cache.set(color, next);
            return next;
        }

        // [BARU — perf 1.2] Gradient di-cache per (warna, panjang dibulatkan
        // 4px) dan dibuat di ruang lokal 0..len, lalu dipindahkan ke posisi
        // bar lewat transform saat menggambar. Pembulatan 4px dari maksimum
        // ~666px = 0,6% — tidak kasat mata pada gradient yang memang lembut.
        function getGradient(
            ctx2d: CanvasRenderingContext2D,
            color: string,
            len: number,
        ): CanvasGradient {
            const bucket = Math.max(4, Math.round(len / 4) * 4);
            const key = color + "|" + bucket;
            const cache = gradCacheRef.current;
            const hit = cache.get(key);
            if (hit) return hit;

            // Batasi pertumbuhan cache (jumlah warna x jumlah bucket tinggi).
            // Membangun ulang jauh lebih murah daripada membiarkan bocor.
            if (cache.size > 512) cache.clear();

            const stops = getStops(color);
            const grad = ctx2d.createLinearGradient(0, 0, 0, bucket);
            grad.addColorStop(0, stops.c0);
            grad.addColorStop(0.25, stops.c25);
            grad.addColorStop(1, stops.c1);
            cache.set(key, grad);
            return grad;
        }

        function drawBar(
            ctx2d: CanvasRenderingContext2D,
            bar: Bar,
            H: number,
        ): void {
            const { x, width, height, yOffset } = bar;
            const bx = x - width / 2;
            const bottom = H - yOffset;
            // Potong dari ujung ATAS (onset), bukan bawah. Ujung bawah adalah
            // waktu release dan harus tetap presisi; ujung atas yang bergeser
            // NOTE_GAP konstan untuk semua bar sehingga not yang mulai
            // bersamaan tetap sejajar satu sama lain.
            const drawH = Math.max(1, height - NOTE_GAP);
            const top = bottom - drawH;
            const radius = Math.min(3, drawH / 2);
            if (bottom < 0) return;

            // Gradient lama di-anchor ke bagian bar yang TERLIHAT saja
            // (koordinatnya di-clamp ke 0..H), bukan ke tinggi penuh bar.
            // Perilaku itu dipertahankan persis: saat bar mulai keluar di atas
            // layar, gradient ikut memampat ke sisa yang terlihat.
            const gTop = top > 0 ? top : 0;
            const gBottom = bottom < H ? bottom : H;
            const gLen = gBottom - gTop > 1 ? gBottom - gTop : 1;

            // [LAMA — pre perf] 1 gradient + 3 string baru per bar per frame:
            // const grad = ctx2d.createLinearGradient(0, Math.max(top, 0), 0, Math.min(bottom, H));
            // grad.addColorStop(0, color + "00");
            // grad.addColorStop(0.25, color + "bb");
            // grad.addColorStop(1, color + "ff");
            // ctx2d.save(); ctx2d.shadowColor = color; ctx2d.shadowBlur = 14; ...; ctx2d.restore();

            // [BARU — perf 1.2/1.3] Gradient dari cache, digeser ke posisi bar
            // lewat setTransform. shadowBlur tetap di-hoist ke luar loop (3
            // untuk released, 10 untuk active), tetapi shadowColor sekarang
            // per bar: bar di tuts hitam memakai varian warna yang lebih
            // gelap. setTransform dipakai menggantikan save/restore supaya
            // tidak ada drift matriks dan tanpa operasi stack per bar.
            const color = bar.isBlackKey
                ? blackBarColorRef.current
                : barColorRef.current;
            ctx2d.shadowColor = color;
            ctx2d.setTransform(1, 0, 0, 1, 0, gTop);
            ctx2d.fillStyle = getGradient(ctx2d, color, gLen);
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
            ).roundRect(bx, top - gTop, width, drawH, [
                radius,
                radius,
                // Ujung bawah hanya dibulatkan setelah dilepas. Selagi
                // ditekan, ujung itu menempel di garis tuts dan harus rata;
                // setelah naik, kapsul penuh terbaca sebagai satu not selesai.
                bar.isReleased ? radius : 0,
                bar.isReleased ? radius : 0,
            ]);
            ctx2d.fill();
        }

        /**
         * [BARU] Bar panduan mode learn — arah TERBALIK dari bar biasa: turun
         * dari atas kanvas menuju garis tuts.
         *
         * Posisinya dihitung murni dari songTime (lihat GuideState), jadi tidak
         * ada state per bar yang perlu dirawat: saat jam beku menunggu tuts yang
         * benar, seluruh bar otomatis ikut diam.
         *
         * progress 1 = baru muncul di atas, 0 = persis di garis tuts.
         */
        function drawGuide(ctx2d: CanvasRenderingContext2D, H: number): void {
            const g = guideRef.current;
            if (!g.active || g.notes.length === 0) return;

            // clockAt null = jam beku (menunggu user) -> jangan interpolasi maju.
            const t =
                g.clockAt === null
                    ? g.songTime
                    : g.songTime + (performance.now() - g.clockAt);

            const geom = keyGeomRef.current;
            const color = barColorRef.current;
            // Bar panduan tanpa glow: ia latar, bukan sorotan. Glow untuk bar
            // hasil tekanan user disetel ulang setelah fungsi ini.
            ctx2d.setTransform(1, 0, 0, 1, 0, 0);
            ctx2d.shadowBlur = 0;

            for (const n of g.notes) {
                const gk = geom[n.note];
                if (!gk) continue;

                const raw = (n.time - t) / g.leadMs;
                const progress = raw < 0 ? 0 : raw; // overdue -> berhenti di tuts
                const bottom = H * (1 - progress);
                const height = Math.max(4, (n.duration / g.leadMs) * H);
                const top = bottom - height;
                if (bottom < 0 || top > H) continue;

                // Yang sedang ditunggu digambar tegas, sisanya samar.
                // Tuts hitam memakai varian gelap; alpha dinaikkan satu
                // tingkat supaya bar panduan tetap terlihat di atas kanvas
                // yang juga gelap.
                const guideColor = gk.isBlack
                    ? blackBarColorRef.current
                    : color;
                const alpha = gk.isBlack
                    ? n.pending
                        ? "dd"
                        : "55"
                    : n.pending
                      ? "cc"
                      : "3d";
                ctx2d.fillStyle = guideColor + alpha;
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
                ).roundRect(gk.x - gk.width / 2, top, gk.width, height, [
                    3, 3, 3, 3,
                ]);
                ctx2d.fill();
            }
        }

        function draw(now: number): void {
            const canvas = canvasRef.current;
            if (!canvas) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            // [BARU — perf 1.3] Context dari cache; getContext() dulu dipanggil
            // ulang tiap frame tanpa alasan.
            const ctx2d = ctxRef.current ?? canvas.getContext("2d");
            if (!ctx2d) {
                rafRef.current = requestAnimationFrame(draw);
                return;
            }
            if (!ctxRef.current) ctxRef.current = ctx2d;

            const W = canvas.width;
            const H = canvas.height;

            // [BARU — perf 1.3] Clamp delta. Saat tab di-background rAF
            // berhenti, dan begitu kembali aktif delta bisa ribuan ms —
            // tanpa clamp, bar yang sedang ditahan melompat langsung ke
            // tinggi maksimum. Di pemakaian normal (delta ~16ms) tidak
            // berpengaruh sama sekali.
            const rawDelta = now - lastTimeRef.current;
            lastTimeRef.current = now;
            const delta = rawDelta > 100 ? 100 : rawDelta;

            ctx2d.setTransform(1, 0, 0, 1, 0, 0);
            ctx2d.clearRect(0, 0, W, H);
            // [BARU — perf 1.1] syncPositions() dihapus dari sini; posisi bar
            // sudah benar sejak dibuat dan hanya perlu diperbarui saat layout
            // berubah (lihat measureKeyGeometry / repositionBlackKeys).

            // Bar panduan digambar lebih dulu supaya bar hasil tekanan
            // user menimpanya, bukan sebaliknya.
            drawGuide(ctx2d, H);

            const maxH = H * MAX_GROW_FRAC;

            // [BARU — perf 1.3] for...in tidak mengalokasikan array; dulu
            // Object.values() bikin array baru tiap frame (dua kali, karena
            // syncPositions juga memanggilnya).
            const active = activeBarsRef.current;
            // hasActive dikumpulkan di loop yang sudah ada — tidak perlu
            // iterasi tambahan hanya untuk mengecek kosong/tidak.
            let hasActive = false;
            // Tinggi diperbarui lebih dulu, terpisah dari menggambar.
            for (const label in active) {
                hasActive = true;
                const bar = active[label];
                bar.height = Math.min(bar.height + PX_PER_MS * delta, maxH);
            }

            const rel = releasedBarsRef.current;
            for (let i = rel.length - 1; i >= 0; i--) {
                const bar = rel[i];
                // Laju yang sama dengan pertumbuhan bar aktif (px/ms), bukan
                // px/frame: posisi jadi fungsi waktu yang konsisten di semua
                // refresh rate dan sejajar dengan bar tuts lain.
                bar.yOffset += PX_PER_MS * delta;
                // [LAMA — pre perf] Dibuang saat yOffset - height > H, padahal
                // bar sudah BERHENTI DIGAMBAR sejak yOffset > H. Sisanya cuma
                // diiterasi percuma — sampai ~4,5 detik per bar.
                // if (bar.yOffset - bar.height > H) { rel.splice(i, 1); continue; }
                // [BARU — perf 1.3] Dibuang tepat saat tidak terlihat lagi.
                if (bar.yOffset > H) {
                    rel.splice(i, 1);
                }
            }

            // ── Gambar ──────────────────────────────────────────────────────
            // Tidak ada lagi pass "dorong bar" per tuts: dengan laju tumbuh =
            // laju naik, not berurutan tidak mungkin saling menyusul. Urutan
            // gambar tetap released paling lama → terbaru, lalu bar aktif,
            // supaya bar terbaru selalu di atas.
            // Glow kecil untuk bar released: blur besar (dulu 8) mengisi celah
            // 3px dan membuat bar berbeda tuts terlihat menyambung lagi.
            ctx2d.shadowBlur = 3;
            for (let i = 0; i < rel.length; i++) {
                drawBar(ctx2d, rel[i], H);
            }

            // Bar aktif tetap punya glow lebih kuat sebagai fokus visual.
            ctx2d.shadowBlur = 10;
            for (const label in active) {
                drawBar(ctx2d, active[label], H);
            }

            // Kembalikan transform ke identitas untuk clearRect frame berikutnya.
            ctx2d.setTransform(1, 0, 0, 1, 0, 0);

            // [BARU — perf 1.4] Tidak ada bar aktif maupun bar yang sedang
            // naik: hentikan loop. Frame ini sudah menjalankan clearRect, jadi
            // kanvas dipastikan bersih sebelum berhenti. pressNote() akan
            // menyalakannya lagi lewat kickLoopRef.
            if (!hasActive && rel.length === 0 && !guideRef.current.active) {
                loopRunningRef.current = false;
                return;
            }

            rafRef.current = requestAnimationFrame(draw);
        }

        // [BARU — perf 1.4] Penyala loop. Reset basis waktu itu WAJIB: tanpa
        // itu, delta dihitung dari frame terakhir sebelum idle (bisa hitungan
        // detik) sehingga bar pertama langsung melompat ke tinggi maksimum.
        function kickLoop(): void {
            if (loopRunningRef.current) return;
            loopRunningRef.current = true;
            lastTimeRef.current = performance.now();
            rafRef.current = requestAnimationFrame(draw);
        }
        kickLoopRef.current = kickLoop;

        loopRunningRef.current = true;
        lastTimeRef.current = performance.now();
        rafRef.current = requestAnimationFrame(draw);
        return () => {
            cancelAnimationFrame(rafRef.current);
            loopRunningRef.current = false;
            // Lumpuhkan penyala loop setelah unmount. Tanpa ini, pressNote()
            // yang terlanjur terpanggil sesudahnya akan menjadwalkan frame
            // yang tidak ada lagi yang membatalkannya (canvas sudah null,
            // loop-nya menjadwal ulang selamanya).
            kickLoopRef.current = () => {};
        };
    }, [resizeCanvas]);

    // ─────────────────────────────────────────────────────────────────────────
    // pressNote / releaseNote — stable callbacks, zero React state on note events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * [BARU] Nyalakan loop gambar dari luar.
     *
     * Loop sengaja berhenti sendiri saat tidak ada yang digambar (optimasi
     * 1.4). Mode learn memunculkan bar panduan TANPA ada tuts yang ditekan,
     * jadi ia butuh cara menyalakan loop itu sendiri — kalau tidak, bar
     * panduannya tidak akan pernah tergambar sampai user menekan tuts pertama.
     *
     * Aman dipanggil berulang: kickLoop() langsung keluar kalau loop sudah jalan.
     */
    const kickLoop = useCallback(() => {
        kickLoopRef.current();
    }, []);

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

            // [BARU] Di mode learn bar naik dimatikan — lihat barsEnabledRef.
            // releaseNote tetap aman dipanggil nanti: animReleaseKey langsung
            // keluar kalau tidak ada bar untuk not itu.
            if (barsEnabledRef.current) animRegisterKey(noteLabel, el);

            // [BARU — perf 1.4] Nyalakan loop kalau sedang idle. Aman
            // dipanggil berulang — kickLoop() langsung keluar kalau loop
            // sudah berjalan.
            kickLoopRef.current();

            // [BARU] Beri tahu mode learn bahwa user menekan tuts ini.
            onNotePressRef?.current(noteLabel);
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

    /**
     * Hanya bar yang dilepas. Tuts tetap menyala dan audio tetap berbunyi
     * sampai releaseNote(), supaya durasi visual bisa dipendekkan tanpa
     * memotong suara.
     */
    const releaseBar = useCallback(
        (noteLabel: string) => {
            animReleaseKey(noteLabel);
        },
        [animReleaseKey],
    );

    // ─────────────────────────────────────────────────────────────────────────
    // [BARU] Glissando — menggeser mouse/jari melintasi tuts
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Tuts mana yang berada di titik (x, y) koordinat viewport.
     *
     * Sengaja TIDAK memakai document.elementFromPoint(): itu hit-test DOM yang
     * bisa memaksa flush style/layout, dan dipanggil tiap touchmove (~60-120x
     * per detik per jari). Karena geometri tuts sudah di-cache dan hanya
     * berubah saat resize/ganti mode/fullscreen, pencarian ini cukup
     * aritmetika murni atas 61-88 entri — jauh lebih murah dan tidak
     * menyentuh layout sama sekali.
     *
     * Tuts hitam diperiksa lebih dulu karena posisinya menimpa tuts putih.
     */
    const noteAtPoint = useCallback((x: number, y: number): string | null => {
        const geom = keyGeomRef.current;
        let whiteHit: string | null = null;
        for (const label in geom) {
            const g = geom[label];
            if (x < g.left || x >= g.right || y < g.top || y >= g.bottom) {
                continue;
            }
            if (g.isBlack) return label; // tuts hitam menang — ada di atas
            whiteHit = label;
        }
        return whiteHit;
    }, []);

    /** Pindah "jari" ke tuts lain: lepas yang lama, tekan yang baru. */
    const glissTo = useCallback(
        (prev: string | null, next: string | null) => {
            if (prev === next) return;
            if (prev) releaseNote(prev);
            if (next) pressNote(next);
        },
        [pressNote, releaseNote],
    );

    // ── Mouse: tekan lalu geser melintasi tuts ────────────────────────────────

    const handleKeyMouseDown = useCallback(
        (noteLabel: string) => {
            mouseDownRef.current = true;
            mouseNoteRef.current = noteLabel;
            pressNote(noteLabel);
        },
        [pressNote],
    );

    /** Masuk ke tuts lain sambil tombol mouse ditahan → glissando. */
    const handleKeyMouseEnter = useCallback(
        (noteLabel: string) => {
            if (!mouseDownRef.current) return;
            glissTo(mouseNoteRef.current, noteLabel);
            mouseNoteRef.current = noteLabel;
        },
        [glissTo],
    );

    /**
     * Keluar dari tuts. Hanya melepas kalau tuts ini memang yang sedang
     * dipegang mouse — supaya tidak ikut mematikan not yang sedang ditahan
     * lewat keyboard saat kursor kebetulan melintas di atasnya.
     */
    const handleKeyMouseLeave = useCallback(
        (noteLabel: string) => {
            if (mouseNoteRef.current !== noteLabel) return;
            releaseNote(noteLabel);
            mouseNoteRef.current = null;
        },
        [releaseNote],
    );

    // Tombol mouse bisa dilepas di mana saja — termasuk di luar piano — jadi
    // pelepasannya harus didengarkan di level dokumen, bukan per tuts.
    useEffect(() => {
        function onMouseUp(): void {
            mouseDownRef.current = false;
            const held = mouseNoteRef.current;
            if (held) {
                releaseNote(held);
                mouseNoteRef.current = null;
            }
        }
        document.addEventListener("mouseup", onMouseUp);
        return () => document.removeEventListener("mouseup", onMouseUp);
    }, [releaseNote]);

    // ── Touch: seluruhnya ditangani di level kontainer ────────────────────────
    //
    // Event sentuh tetap "terkunci" ke elemen tempat jari pertama menyentuh —
    // menggeser jari ke tuts lain TIDAK memicu touchstart di tuts itu. Karena
    // itu touchmove didengarkan di kontainer piano, lalu tuts di bawah jari
    // dicari sendiri lewat noteAtPoint(). Multi-jari didukung: tiap sentuhan
    // dilacak terpisah lewat identifier-nya.
    useEffect(() => {
        const pianoEl = pianoRef.current;
        if (!pianoEl) return;

        function onTouchStart(e: TouchEvent): void {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const note = noteAtPoint(t.clientX, t.clientY);
                if (!note) continue;
                touchNotesRef.current.set(t.identifier, note);
                pressNote(note);
            }
            // Cegah scroll/zoom dan emulasi mouse-event bawaan.
            e.preventDefault();
        }

        function onTouchMove(e: TouchEvent): void {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const prev = touchNotesRef.current.get(t.identifier) ?? null;
                const next = noteAtPoint(t.clientX, t.clientY);
                if (prev === next) continue;

                glissTo(prev, next);
                if (next) {
                    touchNotesRef.current.set(t.identifier, next);
                } else {
                    // Jari keluar dari area tuts — not sudah dilepas glissTo.
                    touchNotesRef.current.delete(t.identifier);
                }
            }
            e.preventDefault();
        }

        function onTouchEnd(e: TouchEvent): void {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                const held = touchNotesRef.current.get(t.identifier);
                if (held) releaseNote(held);
                touchNotesRef.current.delete(t.identifier);
            }
        }

        pianoEl.addEventListener("touchstart", onTouchStart, {
            passive: false,
        });
        pianoEl.addEventListener("touchmove", onTouchMove, { passive: false });
        pianoEl.addEventListener("touchend", onTouchEnd);
        pianoEl.addEventListener("touchcancel", onTouchEnd);

        return () => {
            pianoEl.removeEventListener("touchstart", onTouchStart);
            pianoEl.removeEventListener("touchmove", onTouchMove);
            pianoEl.removeEventListener("touchend", onTouchEnd);
            pianoEl.removeEventListener("touchcancel", onTouchEnd);

            // Jangan tinggalkan not menggantung kalau komponen dilepas
            // saat jari masih menyentuh layar.
            touchNotesRef.current.forEach((note) => releaseNote(note));
            touchNotesRef.current.clear();
        };
    }, [noteAtPoint, glissTo, pressNote, releaseNote, keyMode]);

    // ─────────────────────────────────────────────────────────────────────────
    // Keyboard listener
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        function onKeyDown(e: KeyboardEvent): void {
            if (isTextEntryTarget(e.target)) return;

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
                // Selagi lagu ber-timing memegang pedal, Space tidak boleh
                // mengubah toggle: nilainya tidak berpengaruh dan LED-nya akan
                // berbohong tentang pedal yang sebenarnya berbunyi.
                if (pianoEngine.sustainLocked) return;
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
            if (isTextEntryTarget(e.target)) return;
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

        // [BARU — perf 1.1] Ini SATU-SATUNYA titik di mana layout tuts berubah,
        // jadi ukur ulang geometri di sini — semua pemanggil lama (resize,
        // orientationchange, registerKeys saat ganti mode 61/88) otomatis ikut
        // benar tanpa perlu diubah satu per satu.
        measureKeyGeometry();
    }, [measureKeyGeometry]);

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

        // [LAMA — pre perf] Listener orientationchange dipasang sebagai arrow
        // function anonim sehingga TIDAK pernah dilepas di cleanup — handler
        // menumpuk tiap remount (dan dobel di StrictMode dev).
        // window.addEventListener("orientationchange", () =>
        //     setTimeout(onResize, 250),
        // );

        // [BARU — perf 1.1] Named handler supaya bisa dilepas, + fullscreen.
        // Masuk/keluar fullscreen mengubah ukuran viewport total, jadi geometri
        // tuts WAJIB diukur ulang — kalau tidak, bar akan meleset dari tutsnya
        // karena cache-nya masih memakai ukuran layar yang lama.
        let orientTimer: ReturnType<typeof setTimeout>;
        function onOrientation(): void {
            clearTimeout(orientTimer);
            orientTimer = setTimeout(onResize, 250);
        }

        let fsTimer: ReturnType<typeof setTimeout>;
        function onFsResize(): void {
            clearTimeout(fsTimer);
            fsTimer = setTimeout(onResize, 120);
        }

        window.addEventListener("resize", throttled);
        window.addEventListener("orientationchange", onOrientation);
        document.addEventListener("fullscreenchange", onFsResize);

        const initTimer = setTimeout(onResize, 150);
        return () => {
            window.removeEventListener("resize", throttled);
            window.removeEventListener("orientationchange", onOrientation);
            document.removeEventListener("fullscreenchange", onFsResize);
            clearTimeout(timer);
            clearTimeout(orientTimer);
            clearTimeout(fsTimer);
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
            guideRef,
            barsEnabledRef,
        },
        pressNote,
        releaseNote,
        releaseBar,
        handleKeyMouseDown,
        handleKeyMouseEnter,
        handleKeyMouseLeave,
        repositionBlackKeys,
        resizeCanvas,
        kickLoop,
        ensureFullscreen,
    };
}
