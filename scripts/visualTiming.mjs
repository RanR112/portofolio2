// ─────────────────────────────────────────────────────────────────────────────
// scripts/visualTiming.mjs
//
//   node scripts/visualTiming.mjs --id <song-id> [--id <song-id> ...] [--dry]
//   node scripts/visualTiming.mjs --all [--dry]
//
// Menambahkan `visualDurations` ke timing.json TANPA menyentuh `durations`.
//
// Kenapa dipisah: `durations` adalah panjang not dari MIDI dan dipakai untuk
// melepas audio. Beberapa lagu hasil transkripsi MIDI punya note-off yang
// menumpuk di ujung run/glissando, sehingga bar terlihat menyeberangi banyak
// not. `visualDurations` memendekkan BAR saja; bunyi tetap seperti MIDI.
//
// Script ini membaca timing.json yang SUDAH ada (termasuk koreksi manual),
// jadi aman dijalankan berulang. Aturan pemendekannya ada di
// computeVisualDurations() pada scripts/lib/songTiming.mjs.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";
import {
    computeVisualDurations,
    formatTiming,
    validateTiming,
} from "./lib/songTiming.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const dryRun = has("dry");
const all = has("all");
const ids = [];
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--id") {
        const id = argv[i + 1];
        if (!id) {
            console.error("--id butuh nilai song-id");
            process.exit(1);
        }
        ids.push(id);
        i++;
    }
}

if (!all && ids.length === 0) {
    console.error(
        "Pakai: node scripts/visualTiming.mjs --id <song-id> [--id ...] [--dry]  |  --all [--dry]",
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

/** Semua folder yang punya timing.json — hanya dipakai oleh --all. */
function findAllSongDirs() {
    const dirs = [];
    for (const difficulty of fs.readdirSync(SONGS_ROOT)) {
        const root = path.join(SONGS_ROOT, difficulty);
        if (!fs.statSync(root).isDirectory()) continue;
        for (const id of fs.readdirSync(root)) {
            const dir = path.join(root, id);
            if (fs.existsSync(path.join(dir, "timing.json"))) dirs.push(dir);
        }
    }
    return dirs;
}

const targets = all
    ? findAllSongDirs().map((dir) => ({ id: path.basename(dir), dir }))
    : ids.map((id) => ({ id, dir: findSongDir(id) }));

const failures = [];
const written = [];

for (const { id, dir } of targets) {
    if (!dir) {
        failures.push(`${id}: folder lagu tidak ditemukan`);
        continue;
    }

    const metaPath = path.join(dir, "meta.json");
    const tabPath = path.join(dir, "tab.txt");
    const timingPath = path.join(dir, "timing.json");
    if (!fs.existsSync(timingPath)) {
        failures.push(`${id}: timing.json tidak ada`);
        continue;
    }

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        const tab = fs.readFileSync(tabPath, "utf8");
        const parsed = parseTab(tab, {
            bpm: meta.bpm,
            transpose: meta.transpose,
            stepsPerBeat: meta.stepsPerBeat,
        });
        const timing = JSON.parse(fs.readFileSync(timingPath, "utf8"));

        const issues = validateTiming(timing, parsed);
        if (issues.length) {
            failures.push(
                `${id}: timing.json yang ada sudah bermasalah — ${issues[0]}`,
            );
            continue;
        }

        const visualDurations = computeVisualDurations(
            timing.durations,
            timing.stepMs ?? parsed.stepMs,
        );
        const nextTiming = { ...timing, visualDurations };
        if (Object.keys(visualDurations).length === 0) {
            delete nextTiming.visualDurations;
        }
        const nextIssues = validateTiming(nextTiming, parsed);
        if (nextIssues.length) {
            failures.push(
                `${id}: visualDurations gagal validasi — ${nextIssues[0]}`,
            );
            continue;
        }

        let changed = 0;
        let capped = 0;
        for (const [slot, labels] of Object.entries(visualDurations)) {
            for (const [label, visual] of Object.entries(labels)) {
                const audio = timing.durations[slot]?.[label];
                if (visual !== audio) changed++;
                if (visual < audio) capped++;
            }
        }

        if (!dryRun) fs.writeFileSync(timingPath, formatTiming(nextTiming));
        written.push({ id, changed, capped });
        console.log(
            `  ${id.padEnd(30)} ${String(changed).padStart(4)} bar dipendekkan` +
                (dryRun ? "  [dry]" : ""),
        );
    } catch (e) {
        failures.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

if (failures.length) {
    console.error(`\n✗ ${failures.length} lagu gagal:\n`);
    for (const f of failures) console.error(`   ${f}`);
    process.exit(1);
}

console.log(
    `\n✓ ${written.length} visualDurations ${dryRun ? "siap ditulis" : "ditulis"} ` +
        `(${written.reduce((n, w) => n + w.capped, 0)} bar dipendekkan).\n`,
);
