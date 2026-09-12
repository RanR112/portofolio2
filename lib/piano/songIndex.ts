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
//
// Dipisah begitu supaya menambah lagu tidak menambah ukuran bundle maupun
// payload halaman: index-nya kecil, dan tab hanya diunduh untuk lagu yang
// benar-benar dibuka.
// ─────────────────────────────────────────────────────────────────────────────

export type SongDifficulty = "easy" | "medium" | "hard";

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
    /** transpose AWAL lagu; bisa berubah di tengah (lihat parseTab) */
    transpose: number;
    stepsPerBeat: number;
    /** path tab mentah, sudah siap di-fetch */
    tabUrl: string;
    noteCount: number;
    durationMs: number;
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
