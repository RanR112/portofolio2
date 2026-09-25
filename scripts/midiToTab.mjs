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
import {
    parseMidi,
    bpmFromMicros,
    findGrid,
    warpTickToReferenceTempo,
} from "./lib/midi.mjs";
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
// Kalau diisi, HANYA tab.txt yang ditulis ke path ini apa adanya — tidak ada
// meta.json, tidak masuk library lagu di app/.../data/songs/. Dipakai untuk
// permintaan "kasih tab-nya saja" yang tidak perlu tampil di /piano.
const sheetPath = flag("sheet");
// Default 4 (1 slot = not 1/16) cocok untuk kebanyakan file. Override manual
// disediakan untuk file yang grid aslinya BUKAN 1/16 — mis. hasil transkripsi
// (bukan notasi bersih) yang butuh resolusi lebih halus supaya round-trip
// tetap presisi. Lihat laporan "grid dari segmen utama" di console kalau
// perlu memutuskan angka ini.
const STEPS_PER_BEAT = Number(flag("spb", "4"));
// Paksa ukuran slot (tick) alih-alih memakai hasil findGrid. Dipakai kalau
// grid temuan terlalu halus sampai tab-nya jadi tidak terbaca — lihat tabel
// "ongkos kalau grid dikasarkan" yang dicetak script ini.
const gridOverride = flag("grid") ? Number(flag("grid")) : null;
// Satukan onset yang berjarak <= N tick jadi satu waktu sebelum dikuantisasi.
// Perlu untuk file REKAMAN PERMAINAN (bukan notasi): jari manusia tidak menekan
// akor persis serempak, sebarannya beberapa tick. Tanpa ini, batas slot bisa
// jatuh di tengah sebaran itu dan satu akor terbelah ke dua slot — jadi
// terdengar (dan harus ditekan di mode learn) sebagai dua kejadian terpisah.
// Default 0 = mati, supaya file yang sudah terkuantisasi rapi tidak tersentuh.
const chordWindow = Number(flag("chord-window", "0"));

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

// ── 0. Satukan sebaran akor (hanya kalau --chord-window diisi) ──────────────
//
// Dijalankan di ruang tick MENTAH, sebelum time-warp maupun pencarian grid:
// sebaran ini artefak PERMAINAN, jadi harus dibersihkan sebelum apa pun
// menafsirkan posisinya. Setiap gugus onset yang beruntun dengan jarak
// <= chordWindow ditarik ke onset PALING AWAL di gugus itu — bukan ke rata-
// ratanya, karena itulah saat akornya mulai terdengar.
if (chordWindow > 0) {
    const uniq = [...new Set(midi.notes.map((n) => n.start))].sort((a, b) => a - b);
    /** onset asli -> onset wakil gugusnya */
    const snapTo = new Map();
    // Syaratnya diukur dari JANGKAR, bukan dari onset sebelumnya. Kalau diukur
    // dari onset sebelumnya, deretan onset yang masing-masing berjarak tepat
    // sebatas jendela akan berantai jadi satu gugus yang jauh lebih lebar dari
    // jendelanya (onset 0,8,16,24 dengan jendela 8 semuanya tertarik ke 0 —
    // geseran 24 tick). Dengan diukur dari jangkar, geseran dijamin tidak
    // pernah melebihi chordWindow.
    let anchor = uniq[0];
    for (const s of uniq) {
        if (s - anchor > chordWindow) anchor = s; // gugus baru
        snapTo.set(s, anchor);
    }

    let moved = 0;
    let worst = 0;
    for (const n of midi.notes) {
        const to = snapTo.get(n.start);
        if (to !== n.start) {
            worst = Math.max(worst, n.start - to);
            moved++;
            n.start = to;
        }
    }
    const groups = new Set(snapTo.values()).size;
    console.log(
        `\nsebaran akor disatukan (--chord-window ${chordWindow} tick): ` +
            `${uniq.length} onset -> ${groups} waktu, ${moved} not digeser, geseran terbesar ${worst} tick ` +
            `(${(worst * (midi.microsPerBeat / 1000 / midi.division)).toFixed(1)}ms).`,
    );
}

// grid ditentukan di sini (bukan langsung `const grid = findGrid(...)` di
// bawah) supaya kasus multi-tempo bisa mengisinya dari segmen acuan saja —
// lihat blok if di bawah.
let grid;

// Tempo yang dipakai untuk menerjemahkan tick -> detik. Untuk file tempo
// tunggal ini satu-satunya tempo yang ada. Untuk file multi-tempo ini tempo
// SEGMEN ACUAN — BUKAN midi.microsPerBeat, yang isinya tempo TERAKHIR dan bisa
// jadi cuma penanda ritardando di ujung lagu tanpa not sama sekali.
let referenceMicrosPerBeat = midi.microsPerBeat;

// [BARU] File dengan intro rubato/ritardando (tempo berubah di tengah lagu)
// akan salah total kalau dikonversi apa adanya: lib/piano/parseTab.ts cuma
// mendukung SATU tempo per lagu (beda dari transpose yang boleh berubah).
//
// Solusinya bukan sekadar "time-warp semua tick" — itu justru MERUSAK segmen
// yang temponya SUDAH SAMA dengan acuan: warpTickToReferenceTempo menggeser
// semuanya dengan sebuah KONSTANTA PECAHAN (durasi nyata intro, dikonversi ke
// tick acuan, jarang berupa kelipatan bulat unit grid), sehingga not-not yang
// tadinya pas di grid (offset 0) jadi bergeser fase — bisa mendarat di slot
// yang salah walau timing relatifnya tetap benar. Diverifikasi persis
// kejadian ini di file ini sebelum kode di bawah ditulis.
//
// Perbaikannya: JANGKAR ULANG supaya segmen acuan balik ke tick ASLINYA yang
// sudah tepat di grid, dan hanya segmen lain yang benar-benar diregangkan
// relatif terhadap jangkar itu. Konstanta shift terakhir dipilih KELIPATAN
// BULAT dari unit grid, supaya fase segmen acuan tidak ikut bergeser saat
// semuanya digeser lagi ke tick non-negatif.
//
// Segmen acuan = yang PALING BANYAK NOT-nya, bukan yang terakhir. Awalnya
// dipakai "yang terakhir" dan itu salah: di Zankoku na Tenshi no Thesis,
// event tempo terakhir adalah penanda ritardando di ujung lagu (tick 48000
// dari endTick 48001) yang TIDAK memuat satu not pun — findGrid menerima
// array kosong dan mengembalikan NaN, yang akan merusak seluruh konversi.
// "Paling banyak not" memberi jawaban sama untuk file yang tempo utamanya
// memang di akhir, tapi tidak bisa ketipu segmen kosong seperti itu.
if (midi.tempoMap.length > 1) {
    console.log(
        `\n⚠ terdeteksi ${midi.tempoMap.length} tempo berbeda di file ini (bukan cuma satu):`,
    );

    const segments = midi.tempoMap.map((ev, i) => {
        const end =
            i + 1 < midi.tempoMap.length ? midi.tempoMap[i + 1].tick : Infinity;
        return {
            ...ev,
            end,
            notes: midi.notes.filter((n) => n.start >= ev.tick && n.start < end),
        };
    });
    for (const s of segments) {
        console.log(
            `    tick ${String(s.tick).padStart(6)}: ${bpmFromMicros(s.microsPerBeat).toFixed(1).padStart(5)} bpm  ${String(s.notes.length).padStart(4)} not`,
        );
    }

    const reference = segments.reduce((a, b) =>
        b.notes.length > a.notes.length ? b : a,
    );
    const boundaryTick = reference.tick;
    referenceMicrosPerBeat = reference.microsPerBeat;

    // Grid dicari HANYA dari segmen acuan (tick asli, belum di-warp) — bukan
    // dari seluruh not. Kalau ikut menyertakan segmen lain yang di-warp,
    // pencarian grid akan ternodai oleh fase yang belum dikoreksi (lihat
    // komentar di atas), dan bisa menemukan "unit" yang tidak berarti apa-apa
    // secara musikal.
    const refNotes = reference.notes;
    console.log(
        `  segmen acuan: tick ${boundaryTick} @ ${bpmFromMicros(referenceMicrosPerBeat).toFixed(1)} bpm ` +
            `(${refNotes.length}/${midi.notes.length} not, terbanyak) — grid dicari dari situ saja.`,
    );

    grid = findGrid(refNotes.map((n) => n.start));
    console.log(
        `  grid segmen acuan: ${grid.unit.toFixed(2)} tick/slot (galat rata2 ${((100 * grid.mean) / grid.unit).toFixed(2)}%)`,
    );

    // shiftAmount = seberapa jauh warpTickToReferenceTempo menggeser tick di
    // BATAS segmen acuan. Menguranginya dari SEMUA hasil warp membuat batas
    // itu (dan seluruh segmen acuan sesudahnya, karena warp linear di sana)
    // balik ke tick ASLI — fase grid-nya utuh, tidak tersentuh.
    const shiftAmount =
        warpTickToReferenceTempo(boundaryTick, midi.tempoMap, midi.division, referenceMicrosPerBeat) -
        boundaryTick;

    const warped = midi.notes.map((n) => ({
        n,
        start: warpTickToReferenceTempo(n.start, midi.tempoMap, midi.division, referenceMicrosPerBeat) - shiftAmount,
        end: warpTickToReferenceTempo(n.end, midi.tempoMap, midi.division, referenceMicrosPerBeat) - shiftAmount,
    }));

    // Intro yang diregangkan bisa jatuh ke tick NEGATIF (durasi nyatanya
    // lebih panjang daripada representasi tick aslinya di tempo lambat).
    // Digeser lagi supaya semua >= 0 — tapi geserannya WAJIB kelipatan bulat
    // unit grid, kalau tidak fase segmen acuan yang baru saja diperbaiki
    // akan rusak lagi oleh geseran kedua ini.
    const minStart = Math.min(...warped.map((w) => w.start));
    const finalShift =
        minStart < 0 ? Math.ceil(-minStart / grid.unit) * grid.unit : 0;

    for (const w of warped) {
        w.n.start = w.start + finalShift;
        w.n.end = w.end + finalShift;
    }

    console.log(
        `  tab.txt cuma mendukung SATU tempo — timeline diregangkan supaya durasi\n` +
            `  NYATA tiap bagian dipertahankan persis, bukan cuma jumlah tick-nya.\n` +
            `  Segmen acuan sendiri TIDAK berubah relatif satu sama lain (cuma tergeser\n` +
            `  ${finalShift.toFixed(0)} tick, kelipatan bulat unit grid — fasenya utuh).`,
    );
}

// File tempo tunggal: grid belum diisi sama sekali di atas, cari sekarang
// dari SEMUA not seperti sebelumnya — jalur ini yang dipakai 3 lagu pertama
// (Kokoronashi, Kaikai Kitan, dan semua lagu single-tempo lain), tidak
// berubah perilakunya sama sekali.
if (!grid) grid = findGrid(midi.notes.map((n) => n.start));

// --grid menang atas hasil findGrid. Galatnya dihitung ulang terhadap unit
// yang dipaksa itu, supaya angka yang dilaporkan tetap menggambarkan hasil
// yang SEBENARNYA ditulis — bukan galat grid yang tidak jadi dipakai.
if (gridOverride) {
    const starts = [...new Set(midi.notes.map((n) => n.start))];
    let sum = 0;
    let worst = 0;
    for (const s of starts) {
        const e = Math.abs(s - Math.round(s / gridOverride) * gridOverride);
        sum += e;
        if (e > worst) worst = e;
    }
    console.log(
        `\ngrid dipaksa ke ${gridOverride} tick (--grid), bukan ${grid.unit.toFixed(2)} hasil findGrid.`,
    );
    grid = { unit: gridOverride, mean: sum / starts.length, worst };
}

const ticksPerSec = midi.division / (referenceMicrosPerBeat / 1e6);
const slotSec = grid.unit / ticksPerSec;
const bpm = 60 / (slotSec * STEPS_PER_BEAT);

console.log(`sumber        : ${file}`);
console.log(`grid          : ${grid.unit.toFixed(2)} tick/slot (galat rata2 ${((100 * grid.mean) / grid.unit).toFixed(1)}% slot)`);
console.log(
    `tempo         : ${bpm.toFixed(1)} bpm  (header MIDI bilang ${bpmFromMicros(midi.microsPerBeat).toFixed(0)}` +
        (midi.tempoMap.length > 1
            ? ` — tempo segmen acuan, sudah dipakai apa adanya)`
            : ` — header diabaikan, lihat findGrid)`),
);
console.log(`birama        : ${midi.timeSignature[0]}/${midi.timeSignature[1]}`);

// ── Ongkos kalau grid dikasarkan ────────────────────────────────────────────
//
// PENTING, supaya tidak salah paham seperti sebelumnya: --spb TIDAK mengubah
// timing maupun isi tab sama sekali. parseTab memakai
// stepMs = 60000/bpm/stepsPerBeat, sementara bpm di sini justru diturunkan
// dari stepsPerBeat — keduanya saling meniadakan, stepMs selalu = slotSec.
// Kuantisasi pun memakai grid.unit, bukan spb. Jadi --spb murni pilihan
// LABEL: pasangan (bpm, stepsPerBeat) mana yang enak dibaca manusia untuk
// durasi slot yang sama persis.
//
// Yang BENAR-BENAR mengubah hasil adalah ukuran grid-nya (--grid). Grid hasil
// findGrid paling presisi, tapi belum tentu paling masuk akal: slot terlalu
// halus bikin tab.txt jadi lautan "-" yang tidak terbaca dan filenya
// membengkak. Tabel ini memberi dasar angka untuk memutuskan — ukurannya
// GALAT WAKTU DALAM MILIDETIK, bukan cantik tidaknya angka pembagi.
{
    const starts = [...new Set(midi.notes.map((n) => n.start))];
    const msPerTick = referenceMicrosPerBeat / 1000 / midi.division;
    const span = Math.max(...starts) - Math.min(...starts);
    console.log(`\nongkos kalau grid dikasarkan (--grid <tick>):`);
    for (const mult of [1, 2, 3, 4, 6, 8]) {
        const unit = grid.unit * mult;
        let sum = 0;
        let worst = 0;
        for (const s of starts) {
            const e = Math.abs(s - Math.round(s / unit) * unit) * msPerTick;
            sum += e;
            if (e > worst) worst = e;
        }
        const mean = sum / starts.length;
        const mark = mult === 1 ? "  <-- hasil findGrid" : "";
        console.log(
            `  ${String(unit.toFixed(2)).padStart(7)} tick  slot ${(unit * msPerTick).toFixed(1).padStart(6)}ms  ` +
                `≈${String(Math.round(span / unit)).padStart(6)} slot  ` +
                `galat rata2 ${mean.toFixed(1).padStart(5)}ms  max ${worst.toFixed(1).padStart(6)}ms${mark}`,
        );
    }
}

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
if (sheetPath) {
    // Mode "sheet saja": bukan bagian dari library lagu situs, tidak ada
    // meta.json, tidak perlu --difficulty. Cuma tab.txt-nya ditulis apa
    // adanya ke path yang diminta.
    if (dryRun) {
        console.log(`\n[--dry] tidak menulis apa pun. Akan ditulis ke: ${sheetPath}`);
        console.log(`\n8 baris pertama tab:`);
        lines.slice(0, 8).forEach((l) => console.log(`  ${l}`));
    } else {
        fs.mkdirSync(path.dirname(sheetPath), { recursive: true });
        fs.writeFileSync(sheetPath, tabText);
        console.log(`\n✓ ditulis ke ${sheetPath}`);
        console.log(`  (referensi saja, tidak disimpan: bpm ${meta.bpm}, transpose ${meta.transpose}, stepsPerBeat ${meta.stepsPerBeat}, keyMode ${meta.keyMode})`);
    }
} else {
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
}
