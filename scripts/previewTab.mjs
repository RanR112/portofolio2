// ─────────────────────────────────────────────────────────────────────────────
// scripts/previewTab.mjs
//
// Dump hasil parseTab() ke terminal untuk verifikasi ritme tanpa perlu browser.
//
//   node scripts/previewTab.mjs <song-id> [stepsPerBeat] [jumlahSlot]
//   node scripts/previewTab.mjs                 -> ringkasan semua lagu
//
// stepsPerBeat bisa di-override lewat argumen supaya gampang membandingkan
// tanpa mengubah meta.json.
//
// Sengaja .mjs (bukan .mts): Node butuh ekstensi eksplisit saat meng-import
// file .ts, sementara tsconfig project ini pakai moduleResolution "bundler"
// yang menolak import berekstensi .ts. Karena ini alat dev, tidak perlu
// diketik-periksa — jadi dibiarkan JS biasa dan otomatis di luar jangkauan
// `tsc --noEmit`.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";

function findSongs() {
    const out = [];
    for (const difficulty of fs.readdirSync(SONGS_ROOT)) {
        const dDir = path.join(SONGS_ROOT, difficulty);
        if (!fs.statSync(dDir).isDirectory()) continue;
        for (const id of fs.readdirSync(dDir)) {
            const dir = path.join(dDir, id);
            const tabPath = path.join(dir, "tab.txt");
            const metaPath = path.join(dir, "meta.json");
            if (!fs.existsSync(tabPath) || !fs.existsSync(metaPath)) continue;
            out.push({
                id,
                difficulty,
                tab: fs.readFileSync(tabPath, "utf8"),
                meta: JSON.parse(fs.readFileSync(metaPath, "utf8")),
            });
        }
    }
    return out;
}

const ms = (n) => `${Math.round(n)}ms`;
const secs = (n) => `${(n / 1000).toFixed(1)}s`;

function summarize(song, spbOverride) {
    const stepsPerBeat = spbOverride ?? song.meta.stepsPerBeat ?? 2;
    const parsed = parseTab(song.tab, {
        bpm: song.meta.bpm,
        transpose: song.meta.transpose,
        stepsPerBeat,
    });
    const label = `${song.difficulty}/${song.id}`;
    console.log(
        `${label.padEnd(42)} bpm ${String(song.meta.bpm).padStart(3)}  spb ${stepsPerBeat}  ` +
            `slot ${ms(parsed.stepMs).padStart(7)}  ` +
            `${String(parsed.events.length).padStart(4)} not / ${String(parsed.stepCount).padStart(4)} slot  ` +
            `durasi ${secs(parsed.durationMs).padStart(7)}  ` +
            `warning ${parsed.warnings.length}`,
    );
    return parsed;
}

function detail(song, spbOverride, slotLimit) {
    const stepsPerBeat = spbOverride ?? song.meta.stepsPerBeat ?? 2;
    const parsed = parseTab(song.tab, {
        bpm: song.meta.bpm,
        transpose: song.meta.transpose,
        stepsPerBeat,
    });

    console.log(`\n=== ${song.difficulty}/${song.id} ===`);
    console.log(`title         : ${song.meta.title}`);
    console.log(
        `bpm ${song.meta.bpm}  transpose ${song.meta.transpose}  stepsPerBeat ${stepsPerBeat}  -> 1 slot = ${ms(parsed.stepMs)}`,
    );
    console.log(
        `total         : ${parsed.events.length} not, ${parsed.stepCount} slot, ${secs(parsed.durationMs)}`,
    );
    console.log(
        `transpose     : ${parsed.transposeChanges
            .map((t) => `${t.transpose} @ ${secs(t.time)}`)
            .join("  ->  ")}`,
    );

    if (parsed.warnings.length === 0) {
        console.log(`warning       : tidak ada`);
    } else {
        console.log(`warning       : ${parsed.warnings.length}`);
        for (const w of parsed.warnings) {
            console.log(`   baris ${String(w.line).padStart(4)}  [${w.kind}]  ${w.text}`);
        }
    }

    // Kelompokkan per waktu supaya chord tampil dalam satu baris slot.
    const bySlot = new Map();
    for (const e of parsed.events) {
        const slot = Math.round(e.time / parsed.stepMs);
        if (!bySlot.has(slot)) bySlot.set(slot, []);
        bySlot.get(slot).push(e);
    }

    const limit = Math.min(parsed.stepCount, slotLimit);
    console.log(`\n--- ${limit} slot pertama (rest ditampilkan supaya jeda kelihatan) ---`);
    for (let slot = 0; slot < limit; slot++) {
        const hits = bySlot.get(slot);
        const t = ms(slot * parsed.stepMs).padStart(8);
        if (!hits) {
            console.log(`  slot ${String(slot).padStart(3)} ${t}   ·  (rest)`);
            continue;
        }
        const notes = hits.map((h) => h.note).join(" + ");
        const midis = hits.map((h) => h.midi).join(",");
        console.log(
            `  slot ${String(slot).padStart(3)} ${t}   ${notes.padEnd(26)} midi ${midis}`,
        );
    }
    return parsed;
}

const songs = findSongs();
const [idArg, spbArg, limitArg] = process.argv.slice(2);

if (!idArg) {
    console.log("Ringkasan semua lagu (stepsPerBeat dari meta.json):\n");
    for (const s of songs) summarize(s);
    console.log("\nDetail: node scripts/previewTab.mjs <song-id> [stepsPerBeat] [jumlahSlot]");
} else {
    const song = songs.find((s) => s.id === idArg);
    if (!song) {
        console.error(`Lagu "${idArg}" tidak ditemukan. Yang ada:`);
        for (const s of songs) console.error(`   ${s.id}`);
        process.exit(1);
    }
    detail(
        song,
        spbArg ? Number(spbArg) : undefined,
        limitArg ? Number(limitArg) : 24,
    );
}
