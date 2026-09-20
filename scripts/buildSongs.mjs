// ─────────────────────────────────────────────────────────────────────────────
// scripts/buildSongs.mjs
//
//   node scripts/buildSongs.mjs        (dipanggil otomatis lewat predev/prebuild)
//
// Satu script, dua tugas:
//
//   1. VALIDASI seluruh library lagu. Gagal keras (exit 1) kalau ada data yang
//      rusak, supaya lagu bermasalah ketahuan saat build — bukan nanti saat
//      user menekan play dan tidak ada yang berbunyi.
//
//   2. MENERBITKAN data ke public/ supaya bisa diambil browser:
//        public/piano/songs-index.json   <- daftar ringkas untuk UI pemilih lagu
//        public/piano/songs/<id>.txt     <- tab mentah, di-fetch saat dipilih
//
// Kenapa perlu diterbitkan: folder penulisan lagu ada di dalam app/, dan
// Next.js tidak menyajikan file non-route dari sana — tidak di-bundle, tidak
// bisa di-fetch. Jadi tempat menulis lagu tetap satu (app/.../data/songs/),
// dan script ini yang menyalinnya ke tempat yang bisa diakses browser.
//
// Kenapa tab-nya diterbitkan mentah (bukan hasil parse): supaya stepsPerBeat
// bisa diubah lewat URL saat kalibrasi dan langsung terdengar bedanya, tanpa
// perlu menjalankan ulang script ini.
//
// Output-nya hasil generate, jadi di-gitignore — kebenarannya selalu berasal
// dari app/.../data/songs/, tidak bisa basi.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";
const OUT_DIR = "public/piano";
const OUT_TABS = path.join(OUT_DIR, "songs");
// Urutannya dipakai juga untuk mengurutkan daftar lagu — dari termudah.
const DIFFICULTIES = ["easy", "medium", "hard", "insane"];

const errors = [];
const notes = [];

function fail(where, msg) {
    errors.push(`${where}: ${msg}`);
}

// ── Baca + validasi ──────────────────────────────────────────────────────────

const songs = [];
const seenIds = new Map();

if (!fs.existsSync(SONGS_ROOT)) {
    console.error(`Folder lagu tidak ada: ${SONGS_ROOT}`);
    process.exit(1);
}

for (const difficulty of fs.readdirSync(SONGS_ROOT).sort()) {
    const dDir = path.join(SONGS_ROOT, difficulty);
    if (!fs.statSync(dDir).isDirectory()) continue;

    if (!DIFFICULTIES.includes(difficulty)) {
        fail(difficulty, `tingkat kesulitan tidak dikenal (harus: ${DIFFICULTIES.join(", ")})`);
        continue;
    }

    for (const id of fs.readdirSync(dDir).sort()) {
        const dir = path.join(dDir, id);
        if (!fs.statSync(dir).isDirectory()) continue;
        const where = `${difficulty}/${id}`;

        const tabPath = path.join(dir, "tab.txt");
        const metaPath = path.join(dir, "meta.json");
        if (!fs.existsSync(tabPath)) {
            fail(where, "tab.txt tidak ada");
            continue;
        }
        if (!fs.existsSync(metaPath)) {
            fail(where, "meta.json tidak ada");
            continue;
        }

        let meta;
        try {
            meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        } catch (e) {
            fail(where, `meta.json bukan JSON valid — ${e.message}`);
            continue;
        }

        // id & difficulty diturunkan dari nama folder (satu sumber kebenaran).
        // Kalau ditulis juga di meta.json, harus cocok — mencegah drift saat
        // folder di-rename tapi meta lupa diubah.
        if (meta.id !== undefined && meta.id !== id) {
            fail(where, `meta.id "${meta.id}" tidak cocok nama folder "${id}"`);
        }
        if (meta.difficulty !== undefined && meta.difficulty !== difficulty) {
            fail(where, `meta.difficulty "${meta.difficulty}" tidak cocok folder "${difficulty}"`);
        }

        const prev = seenIds.get(id);
        if (prev) fail(where, `id "${id}" dipakai juga di ${prev}`);
        seenIds.set(id, where);

        if (typeof meta.title !== "string" || !meta.title.trim()) {
            fail(where, "title kosong / bukan string");
        }
        if (!Number.isFinite(meta.bpm) || meta.bpm <= 0) {
            fail(where, `bpm tidak valid: ${JSON.stringify(meta.bpm)}`);
        }
        if (!Number.isInteger(meta.transpose)) {
            fail(where, `transpose harus bilangan bulat: ${JSON.stringify(meta.transpose)}`);
        } else if (meta.transpose < -12 || meta.transpose > 12) {
            // Di luar jangkauan slider transpose piano (-12..12).
            fail(where, `transpose ${meta.transpose} di luar jangkauan -12..12`);
        }
        const stepsPerBeat = meta.stepsPerBeat ?? 2;
        if (!Number.isFinite(stepsPerBeat) || stepsPerBeat <= 0) {
            fail(where, `stepsPerBeat tidak valid: ${JSON.stringify(meta.stepsPerBeat)}`);
        }
        if (meta.stepsPerBeat === undefined) {
            notes.push(`${where}: stepsPerBeat belum diisi, dipakai default 2`);
        }

        // timeSignature TIDAK mempengaruhi timing playback sama sekali — birama
        // hanya mengelompokkan ketuk jadi bar, tidak mengubah panjang ketuk.
        // Disimpan untuk fitur yang berhitung dalam bar nanti (count-in sebelum
        // mode learn, garis bar di bar panduan, metronom) dan untuk perkiraan
        // jumlah bar di laporan bawah.
        // keyMode: lagu yang memakai simbol "_x" (27 tuts ekstra A0..B1 &
        // C#7..C8) WAJIB diputar di mode 88 tuts — tuts itu tidak ada di mode
        // 61. Dihasilkan otomatis oleh midiToTab dari isi tabnya.
        const keyMode = meta.keyMode ?? 61;
        if (keyMode !== 61 && keyMode !== 88) {
            fail(where, `keyMode tidak valid: ${JSON.stringify(meta.keyMode)} (harus 61 atau 88)`);
        }

        const timeSignature = meta.timeSignature ?? "4/4";
        const mTs = /^(\d+)\s*\/\s*(\d+)$/.exec(String(timeSignature));
        if (!mTs || Number(mTs[1]) <= 0 || Number(mTs[2]) <= 0) {
            fail(where, `timeSignature tidak valid: ${JSON.stringify(meta.timeSignature)} (format "4/4")`);
        }
        const beatsPerBar = mTs ? Number(mTs[1]) : 4;

        if (errors.length) continue; // jangan parse data yang sudah jelas rusak

        const tab = fs.readFileSync(tabPath, "utf8");
        const parsed = parseTab(tab, {
            bpm: meta.bpm,
            transpose: meta.transpose,
            stepsPerBeat,
        });

        if (parsed.events.length === 0) {
            fail(where, "tidak menghasilkan satu not pun — cek isi tab.txt");
            continue;
        }
        for (const w of parsed.warnings) {
            // unknown-char hampir selalu berarti salah ketik di tab → anggap error.
            const line = `${where} baris ${w.line} [${w.kind}] ${w.text}`;
            if (w.kind === "unknown-char") fail(where, line);
            else notes.push(line);
        }

        songs.push({
            id,
            title: meta.title,
            difficulty,
            bpm: meta.bpm,
            timeSignature,
            keyMode,
            transpose: meta.transpose,
            stepsPerBeat,
            tabUrl: `/piano/songs/${id}.txt`,
            noteCount: parsed.events.length,
            durationMs: Math.round(parsed.durationMs),
            _tab: tab,
            _stepMs: parsed.stepMs,
            _stepCount: parsed.stepCount,
            _bars: parsed.stepCount / (stepsPerBeat * beatsPerBar),
        });
    }
}

if (errors.length) {
    console.error(`\n✗ ${errors.length} masalah di library lagu:\n`);
    for (const e of errors) console.error(`   ${e}`);
    console.error("");
    process.exit(1);
}

// ── Terbitkan ────────────────────────────────────────────────────────────────

fs.rmSync(OUT_TABS, { recursive: true, force: true });
fs.mkdirSync(OUT_TABS, { recursive: true });

for (const s of songs) {
    fs.writeFileSync(path.join(OUT_TABS, `${s.id}.txt`), s._tab);
}

const sorted = songs
    .slice()
    .sort(
        (a, b) =>
            DIFFICULTIES.indexOf(a.difficulty) - DIFFICULTIES.indexOf(b.difficulty) ||
            a.title.localeCompare(b.title),
    );

// Field berawalan "_" hanya untuk laporan di bawah, tidak diterbitkan.
const index = sorted.map(
    ({ _tab, _stepMs, _stepCount, _bars, ...rest }) => rest,
);

fs.writeFileSync(
    path.join(OUT_DIR, "songs-index.json"),
    `${JSON.stringify(index, null, 2)}\n`,
);

// ── Laporan ──────────────────────────────────────────────────────────────────

for (const s of sorted) {
    const dur = `${Math.floor(s.durationMs / 60000)}:${String(Math.round((s.durationMs % 60000) / 1000)).padStart(2, "0")}`;
    console.log(
        `  ${s.difficulty.padEnd(6)} ${s.id.padEnd(32)} ${String(s.noteCount).padStart(4)} not  ${dur.padStart(5)}  ` +
            `${s.timeSignature}  bpm ${String(s.bpm).padStart(3)} x ${s.stepsPerBeat}  ` +
            `slot ${`${Math.round(s._stepMs)}ms`.padStart(6)}  ≈${s._bars.toFixed(1)} bar`,
    );
}
if (notes.length) {
    console.log(`\n  catatan (tidak menggagalkan build):`);
    for (const n of notes) console.log(`   - ${n}`);
}
console.log(
    `\n✓ ${index.length} lagu → ${path.join(OUT_DIR, "songs-index.json")} + ${OUT_TABS}/\n`,
);
