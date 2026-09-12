// ─────────────────────────────────────────────────────────────────────────────
// lib/piano/playback.ts
//
// Tipe bersama untuk pemutaran lagu di /piano. Untuk sekarang baru mode-nya;
// state machine playback (idle / browsing / running / paused) akan menyusul di
// sini pada tahap berikutnya, supaya UI dan scheduler memakai satu definisi
// yang sama dan tidak ada state kembar.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * - `autoplay` — piano memainkan lagunya sendiri (not, suara, animasi tuts).
 * - `learn`    — lagu TIDAK dimainkan; hanya bar panduan yang turun ke tuts
 *                yang harus ditekan, dan menunggu sampai user menekannya.
 */
export type PlaybackMode = "learn" | "autoplay";

/** Berapa lama bar panduan jatuh dari atas kanvas sampai ke garis tuts. */
export const LEARN_LEAD_MS = 2000;

/** Satu bar panduan yang sedang terlihat di mode learn. */
export interface GuideNote {
    /** label tuts — engine mencari x/lebarnya sendiri dari keyGeomRef */
    note: string;
    /** posisi lagu (ms) saat not ini harus ditekan */
    time: number;
    /** panjang not (ms) — menentukan tinggi barnya */
    duration: number;
    /** true = inilah not yang sedang ditunggu (digambar lebih tegas) */
    pending: boolean;
}

/**
 * Kontrak antara scheduler (usePianoPlayback) dan penggambar (usePianoEngine).
 *
 * Posisi bar SENGAJA tidak disimpan per-bar. Semuanya diturunkan dari satu
 * angka, `songTime` — jadi "bar berhenti menunggu user" cukup dikerjakan
 * dengan berhenti menaikkan angka itu, dan seluruh bar otomatis diam serempak
 * tanpa pembukuan apa pun per bar.
 *
 * `clockAt` memisahkan dua laju yang berbeda: scheduler memperbarui songTime
 * ~40x/detik, sementara kanvas menggambar ~60x/detik. Engine memakai
 * `songTime + (now - clockAt)` supaya barnya tetap mulus di antara dua update
 * scheduler. `clockAt = null` berarti jam sedang BEKU (menunggu tuts yang
 * benar), jadi engine tidak boleh menginterpolasi maju sama sekali.
 */
export interface GuideState {
    active: boolean;
    songTime: number;
    clockAt: number | null;
    leadMs: number;
    notes: GuideNote[];
}

export function createGuideState(): GuideState {
    return {
        active: false,
        songTime: 0,
        clockAt: null,
        leadMs: LEARN_LEAD_MS,
        notes: [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inti mode learn
//
// Dipisah dari hook-nya dan dibuat MURNI (tanpa React, tanpa ref, tanpa DOM)
// karena ini bagian paling rumit dari fitur ini: aturan "bar berhenti menunggu
// tuts yang benar" mustahil diuji lewat build atau type-check. Dengan bentuk
// begini, seluruh aturannya bisa dijalankan dan dibuktikan dari terminal
// (scripts/checkLearn.mjs) memakai lagu yang sesungguhnya.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Not-not yang jatuh pada waktu yang SAMA, digabung jadi satu akor.
 *
 * Mode learn butuh bentuk ini, bukan daftar not datar: barnya menunggu sampai
 * SELURUH not pada satu waktu ditekan, baru lanjut ke waktu berikutnya.
 */
export interface Chord {
    time: number;
    duration: number;
    notes: string[];
}

export function groupChords(
    events: readonly { note: string; time: number; duration: number }[],
): Chord[] {
    // Event dari parseTab sudah urut waktu, jadi cukup sekali lewat.
    const out: Chord[] = [];
    for (const e of events) {
        const last = out[out.length - 1];
        if (last && last.time === e.time) {
            if (!last.notes.includes(e.note)) last.notes.push(e.note);
            if (e.duration > last.duration) last.duration = e.duration;
            continue;
        }
        out.push({ time: e.time, duration: e.duration, notes: [e.note] });
    }
    return out;
}

export interface LearnStepInput {
    chords: readonly Chord[];
    /** indeks akor yang sedang ditunggu */
    idx: number;
    /** posisi lagu setelah delta ditambahkan, SEBELUM ditahan */
    songTime: number;
    leadMs: number;
}

export interface LearnStepResult {
    /** posisi lagu setelah ditahan di akor yang belum ditekan */
    songTime: number;
    /** true = jam sedang beku menunggu tuts yang benar */
    frozen: boolean;
    notes: GuideNote[];
}

/**
 * Satu langkah mode learn.
 *
 * Jam TIDAK PERNAH boleh melewati akor yang belum ditekan — itulah seluruh
 * mekanisme "bar berhenti tepat di atas tuts yang seharusnya ditekan". Tidak
 * ada flag beku per bar dan tidak ada animasi per bar: karena posisi semua bar
 * diturunkan dari songTime, menahan satu angka ini membekukan seluruh tampilan
 * serempak.
 */
export function learnStep({
    chords,
    idx,
    songTime,
    leadMs,
}: LearnStepInput): LearnStepResult {
    const pending = chords[idx];

    let time = songTime;
    let frozen = false;
    if (pending && time >= pending.time) {
        time = pending.time;
        frozen = true;
    }

    // Jendela bar yang terlihat: dari akor yang ditunggu sampai sejauh lead
    // time ke depan. Akor yang sudah dilewati tidak pernah digambar lagi.
    const notes: GuideNote[] = [];
    for (let i = idx; i < chords.length; i++) {
        const c = chords[i];
        if (c.time > time + leadMs) break;
        for (const n of c.notes) {
            notes.push({
                note: n,
                time: c.time,
                duration: c.duration,
                pending: i === idx,
            });
        }
    }

    return { songTime: time, frozen, notes };
}

/**
 * Hasil satu tekanan tuts user di mode learn.
 *
 * - `wrong`    — bukan bagian akor yang ditunggu. Diabaikan total: tidak
 *                memajukan apa pun, tidak ada penalti, barnya tetap menunggu.
 * - `partial`  — benar, tapi akornya belum lengkap.
 * - `complete` — akor lengkap; pemanggil harus maju ke akor berikutnya.
 */
export function learnPressResult(
    chord: Chord | undefined,
    pressed: ReadonlySet<string>,
    note: string,
): "wrong" | "partial" | "complete" {
    if (!chord || !chord.notes.includes(note)) return "wrong";
    // Set-nya belum ditambahi di sini, jadi hitung calon ukurannya.
    const size = pressed.has(note) ? pressed.size : pressed.size + 1;
    return size >= chord.notes.length ? "complete" : "partial";
}
