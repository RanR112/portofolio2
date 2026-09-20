// ─────────────────────────────────────────────────────────────────────────────
// scripts/inspectMidi.mjs
//
//   node scripts/inspectMidi.mjs <file.mid>
//
// Melaporkan isi file MIDI sebelum dikonversi: tempo, birama, jumlah not per
// track, jangkauan nada, dan — yang paling penting — pada grid apa not-notnya
// jatuh. Grid itu yang menentukan stepsPerBeat, dan salah menebaknya membuat
// seluruh ritme lagu meleset.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import { parseMidi, bpmFromMicros } from "./lib/midi.mjs";

const file = process.argv[2];
if (!file) {
    console.error("Pakai: node scripts/inspectMidi.mjs <file.mid>");
    process.exit(1);
}

const midi = parseMidi(fs.readFileSync(file));
const { division, notes, timeSignature } = midi;
const bpm = bpmFromMicros(midi.microsPerBeat);

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

console.log(`file            : ${file}`);
console.log(`format          : ${midi.format}, division ${division} tick/ketuk`);
console.log(`tempo           : ${bpm.toFixed(2)} bpm (${midi.microsPerBeat} us/ketuk)`);
console.log(`birama          : ${timeSignature[0]}/${timeSignature[1]}`);
console.log(`nama track      : ${JSON.stringify(midi.trackNames)}`);
console.log(`total not       : ${notes.length}`);
console.log(
    `panjang         : ${midi.endTick} tick = ${(midi.endTick / division).toFixed(2)} ketuk = ${((midi.endTick / division) * (60 / bpm)).toFixed(1)} detik`,
);

// ── Per track ────────────────────────────────────────────────────────────────
const tracks = [...new Set(notes.map((n) => n.track))].sort();
for (const t of tracks) {
    const tn = notes.filter((n) => n.track === t);
    const lo = Math.min(...tn.map((n) => n.midi));
    const hi = Math.max(...tn.map((n) => n.midi));
    console.log(
        `  track ${t}: ${String(tn.length).padStart(4)} not, jangkauan ${nameOf(lo)}..${nameOf(hi)} (midi ${lo}..${hi})`,
    );
}

// ── Grid: not jatuh di kelipatan tick berapa? ────────────────────────────────
// Kalau semua start habis dibagi division/4, berarti grid 1/16 sudah cukup.
console.log(`\ngrid start-tick (berapa % not pas di tiap resolusi):`);
for (const [label, div] of [
    ["1/4  (ketuk)", 1],
    ["1/8", 2],
    ["1/16", 4],
    ["1/32", 8],
    ["triplet 1/8", 3],
    ["triplet 1/16", 6],
    ["1/64", 16],
]) {
    const unit = division / div;
    if (!Number.isInteger(unit)) continue;
    const ok = notes.filter((n) => n.start % unit === 0).length;
    console.log(
        `  ${label.padEnd(14)} unit ${String(unit).padStart(3)} tick  ->  ${((100 * ok) / notes.length).toFixed(1)}% not pas`,
    );
}

// ── Durasi not yang muncul ───────────────────────────────────────────────────
const durs = new Map();
for (const n of notes) {
    const d = n.end - n.start;
    durs.set(d, (durs.get(d) ?? 0) + 1);
}
console.log(`\ndurasi not terbanyak (tick -> jumlah, dalam satuan ketuk):`);
[...durs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .forEach(([d, c]) =>
        console.log(
            `  ${String(d).padStart(4)} tick (${(d / division).toFixed(3)} ketuk) -> ${c}x`,
        ),
    );

// ── Berapa not yang bunyi bersamaan (ukuran akor) ────────────────────────────
const byStart = new Map();
for (const n of notes) {
    if (!byStart.has(n.start)) byStart.set(n.start, []);
    byStart.get(n.start).push(n);
}
const sizes = new Map();
for (const g of byStart.values()) sizes.set(g.length, (sizes.get(g.length) ?? 0) + 1);
console.log(`\njumlah not serempak (ukuran akor -> berapa kali):`);
[...sizes.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([s, c]) => console.log(`  ${s} not -> ${c}x`));
console.log(`  titik waktu unik: ${byStart.size}`);

// ── 16 not pertama, untuk dicocokkan dengan sheet ────────────────────────────
console.log(`\n16 not pertama:`);
notes.slice(0, 16).forEach((n) =>
    console.log(
        `  tick ${String(n.start).padStart(5)} (ketuk ${(n.start / division).toFixed(2).padStart(6)}) track ${n.track}  ${nameOf(n.midi).padEnd(4)} durasi ${((n.end - n.start) / division).toFixed(3)} ketuk`,
    ),
);
