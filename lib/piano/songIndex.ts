// ─────────────────────────────────────────────────────────────────────────────
// lib/piano/songIndex.ts
//
// Akses ke library lagu dari sisi browser.
//
// Dua file ini dihasilkan scripts/buildSongs.mjs dari app/[locale]/piano/data/
// songs/ (lihat komentar di script itu untuk alasannya):
//
//   /piano/songs-index.json   daftar ringkas — cukup untuk UI pemilih lagu
//   /piano/songs/<id>.txt     tab mentah — baru diambil saat lagunya dipilih
//   /piano/songs/<id>.json    timing (durasi + pedal) — OPSIONAL, hanya untuk
//                             lagu yang punya sumber MIDI
//
// Dipisah begitu supaya menambah lagu tidak menambah ukuran bundle maupun
// payload halaman: index-nya kecil, dan tab/timing hanya diunduh untuk lagu
// yang benar-benar dibuka.
// ─────────────────────────────────────────────────────────────────────────────

export type SongDifficulty = "easy" | "medium" | "hard" | "insane";

/** Satu entri di songs-index.json. Bentuknya ditentukan scripts/buildSongs.mjs. */
export interface SongIndexEntry {
    id: string;
    title: string;
    difficulty: SongDifficulty;
    bpm: number;
    /**
     * mis. "4/4" atau "3/4".
     *
     * TIDAK mempengaruhi timing playback — birama hanya mengelompokkan ketuk
     * jadi bar, tidak mengubah panjang ketuk (itu urusan bpm x stepsPerBeat).
     * Disimpan untuk fitur yang berhitung dalam bar: count-in sebelum mode
     * learn, garis bar di bar panduan, metronom. parseTab sengaja tidak
     * menerimanya, supaya parser hanya memegang hal yang benar-benar
     * mempengaruhi waktu.
     */
    timeSignature: string;
    /**
     * 61 atau 88. Lagu 88 memakai simbol "_x" untuk 27 tuts ekstra (A0..B1,
     * C#7..C8) yang TIDAK ADA di mode 61 — jadi piano harus dipindah ke mode
     * 88 sebelum lagunya diputar, kalau tidak not-not itu tidak punya tuts.
     */
    keyMode: 61 | 88;
    /** transpose AWAL lagu; bisa berubah di tengah (lihat parseTab) */
    transpose: number;
    stepsPerBeat: number;
    /** path tab mentah, sudah siap di-fetch */
    tabUrl: string;
    /**
     * path timing.json — durasi not + otomasi pedal dari MIDI. OPSIONAL: hanya
     * ada untuk lagu yang punya sumber MIDI. Tanpa ini autoplay memakai
     * perilaku lama (tiap not 1 slot, sustain mengikuti toggle user).
     */
    timingUrl?: string;
    noteCount: number;
    durationMs: number;
}

/**
 * Isi timing.json, dalam satuan SLOT (bukan ms) supaya tetap menempel ke tab
 * walau stepsPerBeat ditimpa lewat URL.
 */
export interface SongTiming {
    version: 1;
    /** hanya informasi/validasi: ms per slot saat file dibuat */
    stepMs?: number;
    /** slot → label tuts → panjang dalam slot */
    durations: Record<number, Record<string, number>>;
    /** [slot, 1=injak / 0=lepas] — dari CC64 */
    pedal: [number, 0 | 1][];
}

export const SONGS_INDEX_URL = "/piano/songs-index.json";

export async function loadSongIndex(): Promise<SongIndexEntry[]> {
    const res = await fetch(SONGS_INDEX_URL);
    if (!res.ok) {
        throw new Error(
            `Gagal memuat daftar lagu (${res.status}). Sudah jalan "npm run songs"?`,
        );
    }
    return (await res.json()) as SongIndexEntry[];
}

export async function loadSongTab(entry: SongIndexEntry): Promise<string> {
    const res = await fetch(entry.tabUrl);
    if (!res.ok) {
        throw new Error(`Gagal memuat tab "${entry.id}" (${res.status}).`);
    }
    return await res.text();
}

/**
 * Timing lagu (durasi + pedal). Sengaja TIDAK melempar error: kalau file hilang
 * atau rusak, lagu tetap bisa diputar dengan perilaku lama — lebih baik
 * kehilangan panjang-pendek not daripada tidak bisa memutar lagu sama sekali.
 */
export async function loadSongTiming(
    entry: SongIndexEntry,
): Promise<SongTiming | null> {
    if (!entry.timingUrl) return null;
    try {
        const res = await fetch(entry.timingUrl);
        if (!res.ok) {
            console.warn(
                `[piano] timing "${entry.id}" gagal dimuat (${res.status}) — pakai durasi 1 slot.`,
            );
            return null;
        }
        const timing = (await res.json()) as SongTiming;
        if (
            timing.version !== 1 ||
            !timing.durations ||
            !Array.isArray(timing.pedal)
        ) {
            console.warn(`[piano] timing "${entry.id}" bentuknya tidak dikenal.`);
            return null;
        }
        return timing;
    } catch (e) {
        console.warn(`[piano] timing "${entry.id}" tidak terbaca:`, e);
        return null;
    }
}
