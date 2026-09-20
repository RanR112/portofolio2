// ─────────────────────────────────────────────────────────────────────────────
// scripts/analyzeMidiGrid.mjs
//
//   node scripts/analyzeMidiGrid.mjs <file.mid>
//
// Dua pertanyaan yang HARUS dijawab sebelum MIDI bisa jadi tab:
//
//   1. Grid waktunya apa? File dari aplikasi notasi sering ditulis dengan
//      tempo header yang beda dari tempo partitur, jadi "tick per ketuk" di
//      header tidak bisa dipercaya. Di sini nilainya DICARI dari datanya
//      sendiri: coba banyak kandidat, ambil yang galat kuantisasinya terkecil.
//
//   2. Nadanya muat tidak di KEY_MAP? Tab hanya bisa menuliskan nada yang
//      punya karakter QWERTY-nya. Nada di luar itu harus dilipat oktaf, dan
//      itu keputusan yang harus dilihat angkanya dulu, bukan diam-diam.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import { parseMidi, bpmFromMicros } from "./lib/midi.mjs";
import "./_tsHook.mjs";

const { KEY_MAP, MIDI_BY_LABEL } = await import("../lib/keyMap.ts");

const file = process.argv[2];
if (!file) {
    console.error("Pakai: node scripts/analyzeMidiGrid.mjs <file.mid>");
    process.exit(1);
}

const midi = parseMidi(fs.readFileSync(file));
const { notes, division } = midi;
const starts = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);

// ── 1. Cari ukuran grid yang paling cocok ────────────────────────────────────
//
// Kandidat: berapa tick untuk satu "slot" terkecil. Dicoba dari rentang lebar,
// dinilai dari rata-rata jarak tiap start-tick ke kelipatan terdekat.
function gridError(unit) {
    let sum = 0;
    let worst = 0;
    for (const s of starts) {
        const e = Math.abs(s - Math.round(s / unit) * unit);
        sum += e;
        if (e > worst) worst = e;
    }
    return { mean: sum / starts.length, worst };
}

let best = null;
const rows = [];
for (let unit = 8; unit <= 120; unit += 0.05) {
    const { mean, worst } = gridError(unit);
    // Dinormalkan ke ukuran unit: galat 2 tick pada unit 10 jauh lebih buruk
    // daripada galat 2 tick pada unit 100.
    const score = mean / unit;
    rows.push({ unit, mean, worst, score });
    if (!best || score < best.score) best = { unit, mean, worst, score };
}

console.log(`file          : ${file}`);
console.log(`header        : division ${division} tick/ketuk, ${bpmFromMicros(midi.microsPerBeat).toFixed(1)} bpm`);
console.log(`titik waktu   : ${starts.length} unik, ${notes.length} not\n`);

console.log(`grid terbaik  : ${best.unit.toFixed(2)} tick per slot`);
console.log(`  galat rata2 : ${best.mean.toFixed(2)} tick (${((100 * best.mean) / best.unit).toFixed(1)}% dari satu slot)`);
console.log(`  galat max   : ${best.worst.toFixed(2)} tick (${((100 * best.worst) / best.unit).toFixed(1)}% dari satu slot)`);

// Terjemahkan grid itu ke bahasa musik
const ticksPerSec = division / (midi.microsPerBeat / 1e6);
const slotSec = best.unit / ticksPerSec;
console.log(`\ndalam waktu nyata:`);
console.log(`  1 slot      = ${(slotSec * 1000).toFixed(1)} ms`);
for (const [label, mult] of [
    ["slot = 1/16", 4],
    ["slot = 1/8", 2],
    ["slot = triplet 1/8", 3],
    ["slot = 1/32", 8],
]) {
    const impliedBpm = 60 / (slotSec * mult);
    console.log(`  kalau ${label.padEnd(18)} -> tempo partitur = ${impliedBpm.toFixed(1)} bpm`);
}

// ── 2. Jangkauan nada vs KEY_MAP ─────────────────────────────────────────────
const writable = new Set(Object.values(KEY_MAP).map((label) => MIDI_BY_LABEL[label]));
const lo = Math.min(...writable);
const hi = Math.max(...writable);
const pitches = notes.map((n) => n.midi);
const pLo = Math.min(...pitches);
const pHi = Math.max(...pitches);

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

console.log(`\nKEY_MAP bisa menuliskan : ${nameOf(lo)}..${nameOf(hi)} (midi ${lo}..${hi}, ${writable.size} nada)`);
console.log(`lagu ini memakai        : ${nameOf(pLo)}..${nameOf(pHi)} (midi ${pLo}..${pHi}, lebar ${pHi - pLo + 1} semitone)`);

const missing = [...new Set(pitches)].filter((m) => !writable.has(m)).sort((a, b) => a - b);
if (missing.length === 0) {
    console.log(`semua nada bisa ditulis apa adanya.`);
} else {
    const cnt = missing.reduce((acc, m) => {
        acc[m] = pitches.filter((p) => p === m).length;
        return acc;
    }, {});
    const total = Object.values(cnt).reduce((a, b) => a + b, 0);
    console.log(
        `\nnada TIDAK bisa ditulis : ${missing.length} nada berbeda, ${total} kemunculan (${((100 * total) / notes.length).toFixed(1)}% dari semua not)`,
    );
    console.log(`  ${missing.map((m) => `${nameOf(m)}(${cnt[m]}x)`).join(" ")}`);
}

// Geser berapa supaya paling banyak not yang muat?
console.log(`\ncoba geser seluruh lagu (transpose) — berapa not yang jadi tidak muat:`);
for (let shift = -12; shift <= 12; shift++) {
    const bad = pitches.filter((m) => !writable.has(m + shift)).length;
    const mark = bad === 0 ? "  <-- muat semua" : "";
    if (bad < notes.length * 0.15 || shift === 0) {
        console.log(
            `  geser ${String(shift).padStart(3)} semitone -> ${String(bad).padStart(4)} not di luar jangkauan (${((100 * bad) / notes.length).toFixed(1)}%)${mark}`,
        );
    }
}
