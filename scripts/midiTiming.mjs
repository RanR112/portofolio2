// ─────────────────────────────────────────────────────────────────────────────
// scripts/midiTiming.mjs
//
//   node scripts/midiTiming.mjs --all [--dry]
//   node scripts/midiTiming.mjs --id <song-id> [--dry]
//
// Menulis timing.json (durasi not + pedal) untuk lagu yang SUDAH ada, tanpa
// menyentuh tab.txt/meta.json sama sekali. Kalau timing lama punya
// `visualDurations` (dari scripts/visualTiming.mjs), field itu dihitung ulang
// dari durasi audio yang baru supaya perbaikan visual tidak hilang.
//
// Kenapa tidak lewat midiToTab saja: konversi ulang menulis ulang tab.txt, dan
// tab yang sudah ditinjau tangan bisa saja berbeda dari hasil konversi. Script
// ini justru MENGUJI dirinya terhadap tab yang ada:
//
//   1. Tebak parameter grid/chord-window dari meta.json + isi MIDI.
//   2. Susun timing.
//   3. validasi: setiap slot+label di timing harus ada di tab, dan setiap not
//      tab harus punya durasi. Tidak cocok → tidak menulis apa pun.
//
// Grid dicari, bukan dipercaya dari nama file: meta.json menyimpan bpm dan
// stepsPerBeat yang sudah dibulatkan, sementara konverter memakai grid hasil
// findGrid/--grid yang belum tentu angka bulat. Pencariannya sempit (sekitar
// nilai yang diturunkan dari meta), jadi tidak ada risiko "menemukan" grid
// yang kebetulan cocok.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";
import { parseMidi } from "./lib/midi.mjs";
import {
    buildTimeline,
    computeTiming,
    computeVisualDurations,
    formatTiming,
    snapOnsets,
    validateTiming,
} from "./lib/songTiming.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";
const MIDI_ROOT = "songs";

/** Lagu insane yang punya sumber MIDI. Nama file apa adanya di folder songs/. */
const MIDI_BY_SONG = {
    "black-catcher":
        "Vickeblanka (ビッケブランカ) - black-clover-op-10-black-catcher - Pianotify.mid",
    idol: "Idol.mid",
    "kaikai-kitan": "Kaikai Kitan.mid",
    "kamado-tanjiro-no-uta": "Kamado Tanjirou no Uta.mid",
    "kick-back": "Kick Back.mid",
    kokoronashi:
        "Kokoronashi_GUMI_arrRandy_Rafael_20220903_035636_20260920_062659.mid",
    "kyouran-hey-kids": "Kyouran Hey Kids.mid",
    "yoru-ni-kakeru": "Yoru ni Kakeru.mid",
    "zankoku-na-tenshi-no-thesis": "Zankoku na Thensi no Thesis.mid",
};

const argv = process.argv.slice(2);
const flag = (name, dflt = undefined) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);
const dryRun = has("dry");
const onlyId = flag("id");
const all = has("all");

if (!all && !onlyId) {
    console.error(
        "Pakai: node scripts/midiTiming.mjs --all [--dry]  |  --id <song-id> [--dry]",
    );
    process.exit(1);
}

/** Cari folder lagu berdasarkan id (lintas tingkat kesulitan). */
function findSongDir(id) {
    for (const difficulty of fs.readdirSync(SONGS_ROOT)) {
        const dir = path.join(SONGS_ROOT, difficulty, id);
        if (fs.existsSync(path.join(dir, "meta.json"))) return dir;
    }
    return null;
}

/**
 * Cocokkan hasil kuantisasi ONSET dengan slot tab. Dipakai untuk menyaring
 * kandidat grid dengan murah, sebelum computeTiming yang jauh lebih berat.
 * @returns {{ ok: boolean, missing: number, extra: number }}
 */
function slotsMatch(starts, timeline, unit, maxSlot) {
    const finalShift = timeline.finalShiftFor(unit, starts);
    const slots = new Set(
        starts.map((s) =>
            Math.round((timeline.warpTick(s) + finalShift) / unit),
        ),
    );
    if (slots.size !== maxSlot.count) {
        return {
            ok: false,
            missing: maxSlot.count,
            extra: slots.size,
        };
    }
    let missing = 0;
    for (const s of maxSlot.slots) if (!slots.has(s)) missing++;
    return { ok: missing === 0, missing, extra: 0 };
}

/**
 * Cari (unit, chordWindow) yang membuat onset MIDI jatuh PERSIS di slot tab.
 *
 * Nilai awal diturunkan dari meta: duration satu slot (detik) dikali jumlah
 * tick per detik pada tempo acuan. Untuk file satu tempo itu sudah nilai yang
 * benar; pembulatan meta (bpm 2 desimal) bisa menggesernya sedikit, jadi
 * dicari dalam jendela sempit di sekitarnya.
 */
function findLayout({ midi, timeline, meta, tabSlots, verify }) {
    const stepSec = 60 / meta.bpm / meta.stepsPerBeat;
    const ticksPerSec =
        midi.division / (timeline.referenceMicrosPerBeat / 1e6);
    const baseUnit = stepSec * ticksPerSec;

    const maxSlot = {
        count: tabSlots.size,
        slots: tabSlots,
    };

    const offsets = [];
    for (let d = 0; d <= 0.6; d += 0.01) {
        offsets.push(Number(d.toFixed(2)));
        if (d > 0) offsets.push(Number((-d).toFixed(2)));
    }

    // Grid hasil findGrid/--grid tidak selalu sama dengan nilai turunan meta:
    // meta membulatkan bpm (mis. 93 → 38.709677…), sementara grid aslinya bisa
    // angka bulat/2 desimal (38.71). Kandidat pembulatan ini yang menjembatani.
    const candidates = new Map();
    const add = (u) => {
        if (u > 0) candidates.set(u.toFixed(6), u);
    };
    add(baseUnit);
    add(Math.round(baseUnit));
    add(Math.round(baseUnit * 10) / 10);
    add(Math.round(baseUnit * 100) / 100);
    add(Math.round(baseUnit * 1000) / 1000);
    for (const d of offsets) add(baseUnit + d);
    const units = [...candidates.values()].sort(
        (a, b) => Math.abs(a - baseUnit) - Math.abs(b - baseUnit),
    );

    let nearest = null;
    for (const chordWindow of [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 48]) {
        const snapped = snapOnsets(
            midi.notes.map((n) => n.start),
            chordWindow,
        );
        for (const unit of units) {
            const r = slotsMatch(snapped, timeline, unit, maxSlot);
            if (r.ok) {
                // Set slot yang sama belum menjamin not yang tepat: satu not di
                // batas slot bisa pindah ke slot tetangga yang kebetulan sudah
                // terisi. verify() memeriksa per-label; kalau meleset, lanjut
                // ke kandidat berikutnya.
                const issues = verify(unit, chordWindow);
                if (issues.length === 0) return { unit, chordWindow, baseUnit };
                if (!nearest || issues.length < nearest.score) {
                    nearest = { unit, chordWindow, score: issues.length, issues: issues[0] };
                }
                continue;
            }
            if (!nearest || r.missing + r.extra < nearest.score) {
                nearest = { unit, chordWindow, score: r.missing + r.extra };
            }
        }
        // Chord-window besar bisa memperbaiki onset yang jitter, tapi juga
        // menggeser not yang sudah rapi. Coba jendela 0 dulu untuk SEMUA unit,
        // baru naik — supaya lagu bersih tidak "diperbaiki" tanpa alasan.
    }
    return { nearest, baseUnit };
}

const ids = all ? Object.keys(MIDI_BY_SONG) : [onlyId];
const failures = [];
const written = [];

for (const id of ids) {
    const midiFile = MIDI_BY_SONG[id];
    if (!midiFile) {
        failures.push(`${id}: tidak ada di peta MIDI_BY_SONG`);
        continue;
    }
    const dir = findSongDir(id);
    if (!dir) {
        failures.push(`${id}: folder lagu tidak ditemukan`);
        continue;
    }
    const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
    const tab = fs.readFileSync(path.join(dir, "tab.txt"), "utf8");
    const parsed = parseTab(tab, {
        bpm: meta.bpm,
        transpose: meta.transpose,
        stepsPerBeat: meta.stepsPerBeat,
    });
    const tabSlots = new Set(
        parsed.events.map((e) => Math.round(e.time / parsed.stepMs)),
    );

    const midi = parseMidi(fs.readFileSync(path.join(MIDI_ROOT, midiFile)));
    const timeline = buildTimeline(midi);
    const maxSlot = Math.max(...tabSlots);
    /** @type {{timing: object, stats: object, unit: number, chordWindow: number} | null} */
    let verified = null;
    const verify = (unit, chordWindow) => {
        const built = computeTiming({
            midi,
            timeline,
            unit,
            bpm: meta.bpm,
            spb: meta.stepsPerBeat,
            shift: -meta.transpose,
            chordWindow,
            maxSlot,
        });
        const issues = validateTiming(built.timing, parsed);
        if (issues.length === 0) {
            verified = { ...built, unit, chordWindow };
        }
        return issues;
    };

    const layout = findLayout({ midi, timeline, meta, tabSlots, verify });

    if (!verified) {
        failures.push(
            `${id}: grid tidak ditemukan (base ${layout.baseUnit.toFixed(3)}, ` +
                `kandidat terdekat unit ${layout.nearest?.unit.toFixed(3)} cw ` +
                `${layout.nearest?.chordWindow}: ${layout.nearest?.issues ?? `${layout.nearest?.score} slot beda`})`,
        );
        continue;
    }

    const { timing, stats } = verified;

    const outPath = path.join(dir, "timing.json");
    // Kalau file lama sudah punya durasi visual (hasil visualTiming.mjs),
    // hitung ulang dari durasi audio yang baru. Tanpa ini, regenerate timing
    // akan diam-diam menghapus perbaikan visual.
    if (fs.existsSync(outPath)) {
        try {
            const previous = JSON.parse(fs.readFileSync(outPath, "utf8"));
            if (previous.visualDurations) {
                timing.visualDurations = computeVisualDurations(
                    timing.durations,
                    timing.stepMs,
                );
            }
        } catch {
            // File lama rusak — biarkan ditimpa seperti biasa.
        }
    }
    if (!dryRun) fs.writeFileSync(outPath, formatTiming(timing));
    written.push({ id, path: outPath, stats, layout });
    console.log(
        `  ${id.padEnd(30)} grid ${layout.unit.toFixed(3)} tick  cw ${String(layout.chordWindow).padEnd(2)} ` +
            `→ ${String(stats.durationSlots).padStart(4)} slot berdurasi, ` +
            `${String(stats.pedalChanges).padStart(3)} perubahan pedal` +
            (dryRun ? "  [dry]" : ""),
    );
}

if (failures.length) {
    console.error(`\n✗ ${failures.length} lagu gagal:\n`);
    for (const f of failures) console.error(`   ${f}`);
    process.exit(1);
}

console.log(
    `\n✓ ${written.length} timing.json ${dryRun ? "siap ditulis" : "ditulis"} ` +
        `(${written.filter((w) => w.stats.pedalChanges === 0).length} tanpa pedal).\n`,
);
