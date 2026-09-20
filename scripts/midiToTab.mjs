// ─────────────────────────────────────────────────────────────────────────────
// scripts/midiToTab.mjs
//
//   node scripts/midiToTab.mjs <file.mid> --id <song-id> --title "<judul>" \
//        [--difficulty easy|medium|hard] [--shift <semitone>] [--dry]
//
// Mengubah file MIDI (hasil export dari aplikasi notasi) menjadi tab.txt +
// meta.json di app/[locale]/piano/data/songs/<difficulty>/<id>/.
//
// Kenapa lewat MIDI, bukan membaca PDF/gambar: MIDI menyimpan tinggi nada,
// waktu mulai, dan durasi secara EKSAK. Membaca notasi dari gambar berarti
// menebak notehead satu per satu — terlihat rapi, tapi tidak bisa dibuktikan
// benar. Di sini setiap not punya asal-usul yang bisa dilacak.
//
// ── Yang dilakukan ──────────────────────────────────────────────────────────
//
//   1. Grid waktu DICARI dari data (lihat findGrid) — tempo di header MIDI
//      sering bukan tempo partitur, jadi tidak dipercaya.
//   2. Not di-quantize ke slot 1/16 terdekat.
//   3. Kedua tangan (track) digabung: not yang jatuh di slot sama jadi satu
//      akor [..].
//   4. Nada di luar jangkauan KEY_MAP (C2..C7) dilipat oktaf sampai muat, dan
//      SETIAP pelipatan dilaporkan — tidak ada yang diubah diam-diam.
//   5. Hasilnya diverifikasi PULANG-PERGI: tab yang dihasilkan di-parse ulang
//      dengan parseTab (parser produksi yang sama), lalu himpunan nada per
//      slot dibandingkan dengan sumber MIDI-nya. Kalau ada satu slot saja yang
//      beda, script ini gagal — bukan sekadar "kelihatannya benar".
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import { parseMidi, bpmFromMicros, findGrid } from "./lib/midi.mjs";
import "./_tsHook.mjs";

const { KEY_MAP, MIDI_BY_LABEL, CTRL_CHAR_BY_LABEL } = await import("../lib/keyMap.ts");
const { parseTab } = await import("../lib/piano/parseTab.ts");

// ── Argumen ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const file = argv[0];
const flag = (name, dflt = undefined) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? dflt : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

if (!file || !flag("id")) {
    console.error(
        'Pakai: node scripts/midiToTab.mjs <file.mid> --id <song-id> --title "<judul>" [--difficulty hard] [--shift 0] [--dry]',
    );
    process.exit(1);
}

const songId = flag("id");
const title = flag("title", songId);
const difficulty = flag("difficulty", "hard");
const shift = Number(flag("shift", "0"));
const dryRun = has("dry");
// 88 = boleh memakai simbol ctrl "_x" untuk 27 tuts ekstra (A0..B1, C#7..C8).
// 61 = paksa semua nada masuk C2..C7 dengan melipat oktaf.
const keysOpt = flag("keys", "88");
const STEPS_PER_BEAT = 4; // 1 slot = not 1/16

// ── Peta balik: nada MIDI → karakter QWERTY ──────────────────────────────────
//
// Satu nada bisa punya beberapa karakter (mis. F2 bisa "4" atau "#"). Yang
// dipilih karakter TANPA shift — lebih enak dibaca dan lebih gampang ditekan.
const CHAR_BY_MIDI = new Map();
for (const [ch, label] of Object.entries(KEY_MAP)) {
    const m = MIDI_BY_LABEL[label];
    if (m === undefined) continue;
    const prev = CHAR_BY_MIDI.get(m);
    const isPlain = ch === ch.toLowerCase() && !"!@#$%^&*()".includes(ch);
    if (prev === undefined || (isPlain && !prev.isPlain)) {
        CHAR_BY_MIDI.set(m, { ch, isPlain });
    }
}

// Nada 88-tuts ditulis dengan awalan garis bawah ("_q"), mencerminkan tuts
// bergaris bawah di UI piano. Hanya dipakai kalau --keys 88 (default).
if (keysOpt === "88") {
    for (const [label, ch] of Object.entries(CTRL_CHAR_BY_LABEL)) {
        const m = MIDI_BY_LABEL[label];
        if (m === undefined || CHAR_BY_MIDI.has(m)) continue;
        CHAR_BY_MIDI.set(m, { ch: `_${ch}`, isPlain: false, ctrl: true });
    }
}

const MIDI_LO = Math.min(...CHAR_BY_MIDI.keys());
const MIDI_HI = Math.max(...CHAR_BY_MIDI.keys());

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m) => `${NOTE_NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

/** Lipat oktaf sampai masuk jangkauan yang bisa ditulis. */
function foldIntoRange(midi) {
    let m = midi;
    let folds = 0;
    while (m < MIDI_LO) {
        m += 12;
        folds++;
    }
    while (m > MIDI_HI) {
        m -= 12;
        folds++;
    }
    // Rentangnya tidak kontinu: di mode 88 ada celah nada yang tidak punya
    // simbol (mis. C7 ada, C#7 ada lewat ctrl, tapi cek tetap perlu). Kalau
    // mendarat di celah, geser oktaf lagi sampai ketemu simbol.
    let guard = 0;
    while (!CHAR_BY_MIDI.has(m) && guard < 8) {
        m += m < 60 ? 12 : -12;
        folds++;
        guard++;
    }
    return { midi: m, folds };
}

// ── 1. Baca MIDI + cari grid ─────────────────────────────────────────────────
const midi = parseMidi(fs.readFileSync(file));
if (midi.notes.length === 0) {
    console.error("MIDI tidak berisi satu not pun.");
    process.exit(1);
}

const grid = findGrid(midi.notes.map((n) => n.start));
const ticksPerSec = midi.division / (midi.microsPerBeat / 1e6);
const slotSec = grid.unit / ticksPerSec;
// 1 slot = 1/16, jadi 1 ketuk = 4 slot.
const bpm = 60 / (slotSec * STEPS_PER_BEAT);

console.log(`sumber        : ${file}`);
console.log(`grid          : ${grid.unit.toFixed(2)} tick/slot (galat rata2 ${((100 * grid.mean) / grid.unit).toFixed(1)}% slot)`);
console.log(`tempo         : ${bpm.toFixed(1)} bpm  (header MIDI bilang ${bpmFromMicros(midi.microsPerBeat).toFixed(0)} — header diabaikan, lihat findGrid)`);
console.log(`birama        : ${midi.timeSignature[0]}/${midi.timeSignature[1]}`);

// ── 2. Quantize + lipat oktaf + gabung jadi akor per slot ────────────────────
/** @type {Map<number, Set<number>>} slot -> himpunan nada (sudah digeser+dilipat) */
const bySlot = new Map();
const foldLog = new Map();

for (const n of midi.notes) {
    const slot = Math.round(n.start / grid.unit);
    const shifted = n.midi + shift;
    const { midi: fitted, folds } = foldIntoRange(shifted);
    if (folds > 0) {
        const key = `${nameOf(n.midi)} -> ${nameOf(fitted - shift)}`;
        foldLog.set(key, (foldLog.get(key) ?? 0) + 1);
    }
    if (!bySlot.has(slot)) bySlot.set(slot, new Set());
    bySlot.get(slot).add(fitted);
}

const maxSlot = Math.max(...bySlot.keys());
const totalNotes = [...bySlot.values()].reduce((a, s) => a + s.size, 0);

console.log(`\nnot sumber    : ${midi.notes.length}`);
console.log(`slot berisi   : ${bySlot.size} dari ${maxSlot + 1} slot`);
console.log(`not setelah digabung (nada kembar di slot sama dilebur): ${totalNotes}`);

if (foldLog.size > 0) {
    const total = [...foldLog.values()].reduce((a, b) => a + b, 0);
    console.log(`\nnada dilipat oktaf agar muat di KEY_MAP (${nameOf(MIDI_LO)}..${nameOf(MIDI_HI)}):`);
    console.log(`  ${total} kemunculan (${((100 * total) / midi.notes.length).toFixed(1)}% dari semua not)`);
    for (const [k, c] of [...foldLog.entries()].sort()) {
        console.log(`    ${k}  ${c}x`);
    }
} else {
    console.log(`\nsemua nada muat di KEY_MAP tanpa pelipatan oktaf.`);
}

// ── 3. Susun teks tab ────────────────────────────────────────────────────────
//
// Aturan grammar (lib/piano/parseTab.ts): tiap karakter not = 1 slot, tiap
// "-" = 1 slot rest, satu spasi = pemisah tanpa waktu. Jadi tiap slot persis
// satu token, dipisah satu spasi — tidak pernah dua spasi berturut-turut
// (itu akan dibaca sebagai rest tambahan).
const tokens = [];
for (let slot = 0; slot <= maxSlot; slot++) {
    const set = bySlot.get(slot);
    if (!set || set.size === 0) {
        tokens.push("-");
        continue;
    }
    const chars = [...set]
        .sort((a, b) => a - b)
        .map((m) => {
            const e = CHAR_BY_MIDI.get(m);
            if (!e) throw new Error(`Nada ${m} (${nameOf(m)}) tidak ada di KEY_MAP — seharusnya mustahil setelah dilipat`);
            return e.ch;
        });
    tokens.push(chars.length === 1 ? chars[0] : `[${chars.join("")}]`);
}

// Dipotong per 16 slot = 4 ketuk = 1 birama 4/4, supaya enak dibaca manusia.
// Ganti baris tidak memakan waktu, jadi ini murni kosmetik.
const SLOTS_PER_LINE = 16;
const lines = [];
for (let i = 0; i < tokens.length; i += SLOTS_PER_LINE) {
    lines.push(tokens.slice(i, i + SLOTS_PER_LINE).join(" "));
}
const tabText = `${lines.join("\n")}\n`;

const usesCtrl = tokens.some((t) => t.includes("_"));

const meta = {
    title,
    difficulty,
    bpm: Number(bpm.toFixed(2)),
    timeSignature: `${midi.timeSignature[0]}/${midi.timeSignature[1]}`,
    transpose: -shift, // dinyanyikan balik ke nada aslinya saat diputar
    stepsPerBeat: STEPS_PER_BEAT,
    // Diturunkan dari isi tab, bukan ditebak: kalau ada satu saja simbol "_x",
    // lagu ini WAJIB diputar di mode 88 tuts.
    keyMode: usesCtrl ? 88 : 61,
};

// ── 4. Verifikasi pulang-pergi ───────────────────────────────────────────────
//
// Tab yang baru dibuat di-parse ulang memakai parser PRODUKSI, lalu isinya
// dibandingkan slot demi slot dengan sumber MIDI. Ini yang membedakan
// "terverifikasi" dari "kelihatannya benar".
const parsed = parseTab(tabText, {
    bpm: meta.bpm,
    transpose: meta.transpose,
    stepsPerBeat: meta.stepsPerBeat,
});

let mismatch = 0;
const parsedBySlot = new Map();
for (const ev of parsed.events) {
    const slot = Math.round(ev.time / parsed.stepMs);
    if (!parsedBySlot.has(slot)) parsedBySlot.set(slot, new Set());
    parsedBySlot.get(slot).add(MIDI_BY_LABEL[ev.note]);
}

for (const [slot, want] of bySlot) {
    const got = parsedBySlot.get(slot);
    if (!got || got.size !== want.size || [...want].some((m) => !got.has(m))) {
        if (mismatch < 5) {
            console.error(
                `  slot ${slot}: harap [${[...want].map(nameOf).join(",")}] tapi terbaca [${got ? [...got].map(nameOf).join(",") : "kosong"}]`,
            );
        }
        mismatch++;
    }
}
for (const slot of parsedBySlot.keys()) {
    if (!bySlot.has(slot)) mismatch++;
}

console.log(`\n── verifikasi pulang-pergi (tab di-parse ulang dengan parser produksi) ──`);
console.log(`  slot sumber   : ${bySlot.size}`);
console.log(`  slot terbaca  : ${parsedBySlot.size}`);
console.log(`  not terbaca   : ${parsed.events.length} (sumber setelah dilebur: ${totalNotes})`);
console.log(`  warning parse : ${parsed.warnings.length}`);
console.log(`  durasi        : ${(parsed.durationMs / 1000 / 60).toFixed(2)} menit`);

if (mismatch > 0 || parsed.warnings.length > 0) {
    console.error(`\n✗ GAGAL: ${mismatch} slot tidak cocok, ${parsed.warnings.length} warning.`);
    if (parsed.warnings.length) console.error(parsed.warnings.slice(0, 5));
    process.exit(1);
}
console.log(`  ✓ setiap slot cocok persis dengan sumber MIDI-nya`);

// ── 5. Tulis ─────────────────────────────────────────────────────────────────
const outDir = path.join("app/[locale]/piano/data/songs", difficulty, songId);
if (dryRun) {
    console.log(`\n[--dry] tidak menulis apa pun. Akan ditulis ke: ${outDir}/`);
    console.log(`\n8 baris pertama tab:`);
    lines.slice(0, 8).forEach((l) => console.log(`  ${l}`));
} else {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "tab.txt"), tabText);
    fs.writeFileSync(path.join(outDir, "meta.json"), `${JSON.stringify(meta, null, 4)}\n`);
    console.log(`\n✓ ditulis ke ${outDir}/`);
    console.log(`  meta: ${JSON.stringify(meta)}`);
    console.log(`\nJalankan "npm run songs" supaya lagunya muncul di /piano.`);
}
