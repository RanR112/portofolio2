// ─────────────────────────────────────────────────────────────────────────────
// lib/piano/seek.ts
//
// Hitungan murni untuk "pindah posisi lagu" (seek) pada autoplay.
//
// Scheduler di hooks/usePianoPlayback.ts memegang posisi sebagai kursor berjalan:
// event berikutnya, token sheet berikutnya, event pedal berikutnya, perubahan
// transpose berikutnya, dan daftar not yang sedang ditahan. Melompat ke tengah
// lagu berarti MENGHITUNG ULANG semua angka itu dari satu waktu — bukan memutar
// ulang lagu dari awal.
//
// Semua aturan di sini dibuat murni (tanpa React/DOM) supaya bisa diuji ke
// seluruh library lewat scripts/checkSeek.mjs, sama seperti aturan mode learn.
//
// ── Invarian yang dijaga ────────────────────────────────────────────────────
//
// 1. Not yang ONSET-nya sudah lewat sebelum titik seek TIDAK PERNAH dipicu lagi,
//    kecuali not itu memang masih berbunyi (onset <= t < releaseAt) — itu pun
//    diputar dari offset yang benar, bukan dari awal.
// 2. Not yang belum mulai (onset > t) akan dipicu oleh scheduler seperti biasa;
//    kursor event menunjuk tepat ke event pertama itu, jadi tidak ada yang
//    terlewat maupun dobel.
// 3. Transpose, pedal, highlight sheet, dan kursor token pada posisi baru sama
//    persis dengan kondisi kalau lagu diputar terus sampai waktu itu.
// ─────────────────────────────────────────────────────────────────────────────

import type { NoteEvent, TabToken, TransposeChange } from "./parseTab";
import type { SongTiming } from "./songIndex";

/** Satu not yang rentang waktunya melintasi titik seek. */
export interface OngoingNote {
    note: string;
    /** nada akhir saat not ini mulai (sudah termasuk transpose lagu) */
    midi: number;
    /** sudah berjalan berapa ms saat seek — awal playback audio */
    offsetMs: number;
    /**
     * Tinggi awal bar (ms). Bila bar visual not ini dipendekkan timing, nilainya
     * dibatasi supaya bar tidak muncul lebih panjang dari jatah visualnya.
     */
    barPriorMs: number;
    /** posisi lagu (ms) saat AUDIO not ini dilepas */
    releaseAt: number;
    /** posisi lagu (ms) saat BAR dilepas lebih awal; null = ikut releaseAt */
    barReleaseAt: number | null;
}

/** Kondisi seluruh kursor scheduler pada satu titik waktu. */
export interface SeekPoint {
    /** waktu setelah di-clamp ke [0, durationMs] */
    time: number;
    /** indeks event pertama dengan time > titik seek */
    eventIdx: number;
    /** indeks token pertama dengan time > titik seek */
    tokenIdx: number;
    /** token yang sedang disorot (-1 = belum ada) */
    activeToken: number;
    /** indeks perubahan transpose pertama setelah titik seek */
    transposeIdx: number;
    /** transpose yang berlaku tepat di titik seek */
    transpose: number;
    /** indeks event pedal pertama setelah titik seek */
    pedalIdx: number;
    /** kondisi pedal tepat di titik seek */
    pedalOn: boolean;
    /** not yang masih berbunyi, urut onset (paling lama dulu) */
    ongoing: OngoingNote[];
}

export interface SeekInput {
    /** waktu tujuan (ms), belum di-clamp */
    time: number;
    durationMs: number;
    stepMs: number;
    events: readonly NoteEvent[];
    tokens: readonly TabToken[];
    transposeChanges: readonly TransposeChange[];
    timing: SongTiming | null;
}

/**
 * Indeks pertama yang `time`-nya LEBIH BESAR dari `t`.
 *
 * Dipakai untuk semua kursor karena scheduler memakai aturan `time <= elapsed`
 * (jadi event yang tepat di `t` sudah menjadi "sekarang", bukan "berikutnya").
 * Array dari parser/pedal selalu urut waktu.
 */
function firstTimeAfter<T extends { time: number }>(
    items: readonly T[],
    t: number,
): number {
    let lo = 0;
    let hi = items.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (items[mid].time <= t) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

/**
 * Toleransi pembulatan. Waktu dihitung dari slot × stepMs, jadi sebuah not bisa
 * berakhir beberapa 1e-13 ms setelah titik seek. Not seperti itu sudah selesai
 * dan tidak boleh diputar ulang.
 */
const EPS = 1e-6;

/** Panjang not dalam slot, persis seperti scheduler membacanya. */
function durationSlots(
    event: NoteEvent,
    stepMs: number,
    timing: SongTiming | null,
): number {
    if (!timing) return 1;
    const slot = Math.round(event.time / stepMs);
    return timing.durations[slot]?.[event.note] ?? 1;
}

/** Panjang BAR dalam slot (lebih pendek dari audio kalau timing memintanya). */
function visualSlots(
    event: NoteEvent,
    stepMs: number,
    timing: SongTiming | null,
): number {
    const slots = durationSlots(event, stepMs, timing);
    if (!timing) return slots;
    const slot = Math.round(event.time / stepMs);
    return timing.visualDurations?.[slot]?.[event.note] ?? slots;
}

/** Panjang not terpanjang di lagu — batas seberapa jauh ke belakang scan. */
function maxDurationMs(stepMs: number, timing: SongTiming | null): number {
    let max = stepMs;
    if (!timing) return max;
    for (const byNote of Object.values(timing.durations)) {
        for (const slots of Object.values(byNote)) {
            max = Math.max(max, slots * stepMs);
        }
    }
    return max;
}

/**
 * Hitung seluruh kondisi scheduler kalau lagu dilompati ke `input.time`.
 *
 * Tidak mengubah apa pun: pemanggil yang memutuskan kapan audio dibungkam dan
 * kapan not baru ditekan.
 */
export function computeSeekPoint(input: SeekInput): SeekPoint {
    const {
        durationMs,
        stepMs,
        events,
        tokens,
        transposeChanges,
        timing,
    } = input;

    const t = Math.max(0, Math.min(input.time, durationMs));

    const eventIdx = firstTimeAfter(events, t);
    const tokenIdx = firstTimeAfter(tokens, t);

    // ── Transpose ────────────────────────────────────────────────────────────
    // transposeChanges[0] selalu ada (time 0), jadi untuk t >= 0 minimal satu
    // perubahan sudah berlaku.
    const transposeIdx = firstTimeAfter(transposeChanges, t);
    const transpose =
        transposeIdx > 0
            ? transposeChanges[transposeIdx - 1].transpose
            : (transposeChanges[0]?.transpose ?? 0);

    // ── Pedal ────────────────────────────────────────────────────────────────
    // Lagu MIDI tanpa CC64 sengaja ditahan ON sepanjang lagu (keputusan owner,
    // sama seperti start()). Lagu tanpa timing tidak menyentuh pedal lagu.
    let pedalIdx = 0;
    let pedalOn = false;
    if (timing) {
        if (timing.pedal.length === 0) {
            pedalOn = true;
        } else {
            while (
                pedalIdx < timing.pedal.length &&
                timing.pedal[pedalIdx][0] * stepMs <= t
            ) {
                pedalIdx++;
            }
            pedalOn =
                pedalIdx > 0 ? timing.pedal[pedalIdx - 1][1] === 1 : false;
        }
    }

    // ── Not yang masih berbunyi ──────────────────────────────────────────────
    // Seek ke ujung lagu tidak perlu memulai not apa pun: tick berikutnya
    // langsung menyelesaikan lagu.
    const ongoing: OngoingNote[] = [];
    if (t < durationMs) {
        const limit = t - maxDurationMs(stepMs, timing);
        /** label → sudah tercatat; yang ditemukan pertama = onset terbaru */
        const seen = new Set<string>();

        for (let i = eventIdx - 1; i >= 0; i--) {
            const event = events[i];
            if (event.time < limit) break;

            // Label ini sudah punya onset lebih baru: voice lama sudah mati
            // saat retrigger, jadi jangan pernah dihidupkan lagi — bahkan kalau
            // durasi not lama secara matematis masih memanjang melewati t.
            if (seen.has(event.note)) continue;
            seen.add(event.note);

            const slots = durationSlots(event, stepMs, timing);
            const releaseAt = event.time + slots * stepMs;
            if (releaseAt <= t + EPS) continue;

            const offsetMs = t - event.time;
            const barSlots = visualSlots(event, stepMs, timing);
            const barReleaseAt =
                barSlots < slots ? event.time + barSlots * stepMs : null;
            const barPriorMs =
                barReleaseAt === null
                    ? offsetMs
                    : Math.min(offsetMs, barSlots * stepMs);

            ongoing.push({
                note: event.note,
                midi: event.midi,
                offsetMs,
                barPriorMs,
                releaseAt,
                barReleaseAt,
            });
        }

        // Scan berjalan mundur (onset terbaru dulu); dibalik supaya urutan
        // penekanannya sama dengan playback normal (paling lama dulu).
        ongoing.reverse();
    }

    return {
        time: t,
        eventIdx,
        tokenIdx,
        activeToken: tokenIdx - 1,
        transposeIdx,
        transpose,
        pedalIdx,
        pedalOn,
        ongoing,
    };
}
