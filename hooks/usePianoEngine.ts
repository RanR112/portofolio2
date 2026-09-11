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

/**
 * [BARU] Apakah event keyboard ini sedang ditujukan ke tempat mengetik?
 *
 * Guard lama `tagName === "INPUT"` terlalu luas: slider volume & transpose
 * adalah <input type="range">, sehingga SELAMA slider masih fokus (yaitu
 * setelah user menggesernya) seluruh tuts piano ikut mati — user harus
 * mengklik di luar slider dulu baru bisa main lagi.
 *
 * Yang sebenarnya perlu dilindungi hanyalah tempat user mengetik teks.
 * Range/checkbox/radio/tombol tidak termasuk — dan tabrakan tombol panah
 * atau spasi dengan perilaku bawaan kontrol itu sudah dicegah oleh
 * preventDefault() di handler keydown.
 */
function isTextEntryTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;

    const tag = el.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag !== "INPUT") return false;

    const type = (el as HTMLInputElement).type;
    return (
        type !== "range" &&
        type !== "checkbox" &&
        type !== "radio" &&
        type !== "button" &&
        type !== "submit" &&
        type !== "reset" &&
        type !== "color"
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Geometri satu tuts: untuk posisi bar DAN untuk hit-test glissando. */
export interface KeyGeom {
    /** titik tengah tuts relatif viz area — dipakai menempatkan bar */
    x: number;
    /** lebar bar (0.72 x lebar tuts) */
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
    // [BARU] Handler mouse untuk glissando — dipasang di tiap tuts.
    handleKeyMouseDown: (label: string) => void;
    handleKeyMouseEnter: (label: string) => void;
    handleKeyMouseLeave: (label: string) => void;
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
    const stopsCacheRef = useRef<{
        key: string;
        c0: string;
        c25: string;
        c1: string;
    } | null>(null);

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
                width: r.width * 0.72,
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
                    width: r.width * 0.72,
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
        function getStops(color: string) {
            const cur = stopsCacheRef.current;
            if (cur && cur.key === color) return cur;
            const next = {
                key: color,
                c0: color + "00",
                c25: color + "bb",
                c1: color + "ff",
            };
            stopsCacheRef.current = next;
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
            const top = bottom - height;
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
            // lewat setTransform. shadowColor/shadowBlur TIDAK disetel di sini
            // — sudah di-hoist ke luar loop (nilainya sama untuk semua bar),
            // jadi glow-nya identik tapi propertinya tidak ditulis ulang 39x
            // per frame. setTransform dipakai menggantikan save/restore supaya
            // tidak ada drift matriks dan tanpa operasi stack per bar.
            ctx2d.setTransform(1, 0, 0, 1, 0, gTop);
            ctx2d.fillStyle = getGradient(ctx2d, barColorRef.current, gLen);
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
            ).roundRect(bx, top - gTop, width, height, [3, 3, 0, 0]);
            ctx2d.fill();
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

            // [BARU — perf 1.3] Glow disetel SEKALI per frame, bukan per bar.
            // Nilainya sama untuk semua bar, jadi hasil visualnya identik.
            ctx2d.shadowColor = barColorRef.current;
            ctx2d.shadowBlur = 14;

            const maxH = H * MAX_GROW_FRAC;

            // [BARU — perf 1.3] for...in tidak mengalokasikan array; dulu
            // Object.values() bikin array baru tiap frame (dua kali, karena
            // syncPositions juga memanggilnya).
            const active = activeBarsRef.current;
            // hasActive dikumpulkan di loop yang sudah ada — tidak perlu
            // iterasi tambahan hanya untuk mengecek kosong/tidak.
            let hasActive = false;
            for (const label in active) {
                hasActive = true;
                const bar = active[label];
                bar.height = Math.min(bar.height + GROW_RATE * delta, maxH);
                drawBar(ctx2d, bar, H);
            }

            const rel = releasedBarsRef.current;
            for (let i = rel.length - 1; i >= 0; i--) {
                const bar = rel[i];
                bar.yOffset += SCROLL_SPEED;
                // [LAMA — pre perf] Dibuang saat yOffset - height > H, padahal
                // bar sudah BERHENTI DIGAMBAR sejak yOffset > H. Sisanya cuma
                // diiterasi percuma — sampai ~4,5 detik per bar.
                // if (bar.yOffset - bar.height > H) { rel.splice(i, 1); continue; }
                // [BARU — perf 1.3] Dibuang tepat saat tidak terlihat lagi.
                if (bar.yOffset > H) {
                    rel.splice(i, 1);
                    continue;
                }
                drawBar(ctx2d, bar, H);
            }

            // Kembalikan transform ke identitas untuk clearRect frame berikutnya.
            ctx2d.setTransform(1, 0, 0, 1, 0, 0);

            // [BARU — perf 1.4] Tidak ada bar aktif maupun bar yang sedang
            // naik: hentikan loop. Frame ini sudah menjalankan clearRect, jadi
            // kanvas dipastikan bersih sebelum berhenti. pressNote() akan
            // menyalakannya lagi lewat kickLoopRef.
            if (!hasActive && rel.length === 0) {
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
            // [BARU — perf 1.4] Nyalakan loop kalau sedang idle. Aman
            // dipanggil berulang — kickLoop() langsung keluar kalau loop
            // sudah berjalan.
            kickLoopRef.current();
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
        },
        pressNote,
        releaseNote,
        handleKeyMouseDown,
        handleKeyMouseEnter,
        handleKeyMouseLeave,
        repositionBlackKeys,
        resizeCanvas,
    };
}
