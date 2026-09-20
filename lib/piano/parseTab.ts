// ─────────────────────────────────────────────────────────────────────────────
// lib/piano/parseTab.ts
//
// Parser tab Virtual Piano → daftar not bertimestamp. Dipakai bersama oleh
// fitur autoplay dan learn, jadi satu sumber kebenaran untuk "lagu ini isinya
// not apa, pada milidetik berapa".
//
// Murni: tanpa React, tanpa DOM, tanpa fs. Gampang diuji dari terminal.
//
// Mapping karakter → nada SENGAJA tidak dibuat ulang di sini. Dipakai KEY_MAP
// dan MIDI_BY_LABEL dari lib/keyMap.ts yang sudah jadi sumber kebenaran untuk
// keyboard piano. Diverifikasi ke 4 lagu di library: 100% karakter not di tab
// cocok dengan KEY_MAP, nol karakter asing.
//
// Import-nya relatif ("../keyMap", bukan "@/lib/keyMap" seperti kebiasaan di
// lib/ lain) supaya file ini bisa dijalankan langsung oleh
// `node --experimental-strip-types` dari script validasi/kalibrasi, tanpa
// menambah TS runner sebagai dependency baru. Alias "@/" cuma dikenal bundler
// Next, bukan node.
//
// ── Grammar (hasil observasi + keputusan owner atas 4 lagu nyata) ────────────
//
//   1 karakter not di luar kurung   1 slot bunyi
//   [abc] atau {abc}               1 slot bunyi, semua not serempak.
//                                   [] dan {} diperlakukan SAMA PERSIS.
//   -  atau  ,                     1 slot rest
//   .                              1 slot rest PER TITIK ("...." = 4 slot)
//   run >=2 spasi                  1 slot rest
//   1 spasi / ganti baris          pemisah saja, 0 waktu
//   spasi di sekitar -,.           diabaikan (cuma padding penulisan)
//   "Transpose by: X (Y)"          0 waktu; transpose jadi X dari titik itu
//   baris non-notasi lain          0 waktu + warning
//
// Rest TIDAK memperpanjang not sebelumnya — murni memberi jarak. Jadi durasi
// tiap not selalu tepat 1 slot.
//
// Kenapa "spasi di sekitar -,. diabaikan": supaya "o-0-t" dan "o - 0 - t"
// menghasilkan hal yang identik (keputusan owner). Kalau spasinya ikut
// dihitung, dua gaya penulisan yang sama artinya itu akan beda panjang.
//
// Kenapa "run >=2 spasi = 1 rest" dan bukan (N-1): bisa diverifikasi musikal
// lewat twinkle, "1 1 5 5 6 6 5   4" = C C G G A A G(1/2) F. Dengan 1 rest,
// G memakan 2 slot = tepat dua kali not seperempat di sekitarnya. Dengan
// (N-1) rest, G jadi 3 slot (dotted half) — kepanjangan.
// ─────────────────────────────────────────────────────────────────────────────

import { CTRL_CHAR_BY_LABEL, KEY_MAP, MIDI_BY_LABEL } from "../keyMap";

/** Satu not yang harus berbunyi pada waktu tertentu. */
export interface NoteEvent {
    /**
     * Label tuts SESUAI YANG TERTULIS di tab, mis. "C4" — belum digeser
     * transpose. Ini yang dipakai untuk menyorot tuts (mode learn) dan untuk
     * pressNote().
     */
    note: string;
    /**
     * Nada akhir yang seharusnya berbunyi = MIDI label di atas + transpose
     * lagu yang berlaku pada waktu itu.
     *
     * HATI-HATI dobel transpose: pressNote() di usePianoEngine SUDAH
     * menambahkan transpose dari slider user. Pemutar harus memilih SATU
     * jalur — set transpose engine ke nilai lagu lalu pressNote(note), ATAU
     * mainkan midi ini langsung. Kalau keduanya, nadanya tergeser dua kali.
     * Field midi di sini terutama untuk verifikasi/debug.
     */
    midi: number;
    /** ms dari awal lagu */
    time: number;
    /** ms — selalu 1 slot, karena rest tidak memperpanjang not */
    duration: number;
}

/**
 * Transpose bisa BERUBAH di tengah lagu (baris "Transpose by: X" yang muncul
 * setelah notasi dimulai — ada contoh nyatanya di ada-titik-titik-di-ujung-doa
 * baris 147). Jadi transpose adalah timeline, bukan konstanta.
 */
export interface TransposeChange {
    time: number;
    transpose: number;
}

export type ParseWarningKind =
    | "unknown-char"
    | "non-notation-line"
    | "unbalanced-group"
    | "empty-group"
    | "tempo-change"
    | "transpose-mismatch";

export interface ParseWarning {
    /** nomor baris di tab.txt, 1-based — supaya gampang dicari di editor */
    line: number;
    kind: ParseWarningKind;
    text: string;
}

/**
 * Satu simbol berbunyi di tab, beserta POSISI ASLINYA di teks mentah.
 *
 * Dipakai fitur highlight di panel Sheets: untuk menyorot simbol yang sedang
 * dimainkan, kita butuh tahu rentang karakternya di tab.txt apa adanya.
 *
 * Kenapa offset ABSOLUT (bukan "karakter ke-N dari token sebelumnya"): tidak
 * ada penjumlahan berjalan yang bisa terakumulasi salah. Simbol jeda
 * (`-` `,` `.`) dan baris anotasi yang dibuang tetap terhitung penuh dalam
 * `time` (parser sudah melakukannya), tapi tidak menghasilkan token — highlight
 * tidak pernah mendarat di sana.
 *
 * Grup `[...]`/`{...}` menjadi SATU token yang rentangnya mencakup kurungnya,
 * jadi menyorotnya otomatis menyorot seluruh akor.
 */
export interface TabToken {
    /** offset karakter awal di tab mentah (inklusif) */
    start: number;
    /** offset karakter akhir di tab mentah (eksklusif) */
    end: number;
    /** ms dari awal lagu — sama dengan time event-event di dalamnya */
    time: number;
    /** label tuts yang dibunyikan token ini (1 = not tunggal, >1 = akor) */
    notes: string[];
}

export interface ParseTabOptions {
    bpm: number;
    /** transpose AWAL lagu (dari meta.json) */
    transpose: number;
    /** berapa slot per ketuk; 2 = tiap slot not seperdelapan */
    stepsPerBeat: number;
}

export interface ParsedSong {
    events: NoteEvent[];
    /**
     * Token berbunyi beserta posisinya di tab mentah, urut waktu.
     *
     * Invarian (diuji di scripts/checkLearn.mjs): daftar ini 1:1 dan seurutan
     * dengan hasil groupChords(events) — keduanya mengelompokkan hal yang sama,
     * yaitu not-not yang jatuh pada satu waktu. Itu yang membuat mode learn
     * cukup menyorot tokens[indeks akor yang ditunggu].
     */
    tokens: TabToken[];
    /** selalu berisi minimal 1 entri: transpose awal pada time 0 */
    transposeChanges: TransposeChange[];
    /** durasi satu slot dalam ms */
    stepMs: number;
    /** total slot terpakai (termasuk rest) */
    stepCount: number;
    durationMs: number;
    warnings: ParseWarning[];
}

// Pemisah antar langkah. Tab/CR ikut supaya file dengan CRLF atau tab tidak
// bikin parser salah hitung.
const DELIMITERS = new Set([" ", "\t", "\n", "\r", "-", ",", "."]);
/** Pemisah yang JUGA memakan satu slot rest. */
const REST_MARKS = new Set(["-", ",", "."]);

/**
 * Awalan untuk nada "ctrl" — 27 tuts tambahan yang hanya ada di mode 88 tuts
 * (A0..B1 di bawah, C#7..C8 di atas). Di UI piano tuts itu ditandai GARIS
 * BAWAH, jadi di teks dipakai karakter garis bawah: yang bergaris bawah di
 * layar, diawali "_" di tab.
 *
 *   _q  = ctrl+q = G1        [_q t] = G1 + C4 (boleh dicampur di satu akor)
 *
 * Dipilih "_" karena: (a) mencerminkan tampilan UI, (b) tidak dipakai KEY_MAP
 * maupun grammar, (c) nol tab lama yang memakainya — jadi menambah arti baru
 * tidak mengubah satu lagu pun yang sudah ada.
 */
const CTRL_PREFIX = "_";

/** Kebalikan CTRL_CHAR_BY_LABEL: karakter → label nada. */
const CTRL_KEY_MAP: Record<string, string> = {};
for (const [label, ch] of Object.entries(CTRL_CHAR_BY_LABEL)) {
    CTRL_KEY_MAP[ch] = label;
}

const RE_TRANSPOSE = /^\s*transpose\s*by\s*:\s*([+-]?\d+)\s*(?:\(\s*([+-]?\d+)\s*\))?/i;
const RE_TEMPO = /^\s*tempo\s*:/i;

/**
 * Di luar kurung, notasi selalu SATU karakter per langkah (dipisah spasi atau
 * -,.). Jadi >=2 huruf/angka berdempet di luar kurung berarti barisnya bukan
 * notasi — mis. baris judul atau lirik. Tanpa penjagaan ini, baris "Verse 2"
 * akan dibunyikan sebagai not V,e,r,s,e,2.
 *
 * Diuji ke 4 lagu: nol false positive (satu-satunya yang tertangkap adalah
 * baris "Transpose by: -3 (-1)", dan itu sudah ditangani lebih dulu).
 */
const RE_NON_NOTATION = /[A-Za-z0-9!@#$%^&*()]{2,}/;

type Segment =
    | { kind: "notation"; text: string; line: number; rawStart: number }
    | {
          kind: "transpose";
          value: number;
          delta: number | null;
          line: number;
      };

export function parseTab(tab: string, opts: ParseTabOptions): ParsedSong {
    const warnings: ParseWarning[] = [];
    const stepMs = 60000 / opts.bpm / opts.stepsPerBeat;

    // ── Tahap 1: klasifikasi per baris ───────────────────────────────────────
    // Baris yang dibuang (non-notasi) tidak menghasilkan segment sama sekali,
    // jadi otomatis bernilai 0 waktu.
    const segments: Segment[] = [];
    const lines = tab.split("\n");

    // Offset karakter awal tiap baris di tab MENTAH. Dihitung berjalan karena
    // pemisah baris hilang saat split; +1 mengembalikannya. File CRLF tetap
    // benar: carriage return ikut tertinggal di ujung baris dan ikut terhitung.
    let rawCursor = 0;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const rawStart = rawCursor;
        rawCursor += raw.length + 1;
        const lineNo = i + 1;
        const trimmed = raw.trim();
        if (!trimmed) continue;

        const mTrans = RE_TRANSPOSE.exec(trimmed);
        if (mTrans) {
            segments.push({
                kind: "transpose",
                value: parseInt(mTrans[1], 10),
                delta: mTrans[2] !== undefined ? parseInt(mTrans[2], 10) : null,
                line: lineNo,
            });
            continue;
        }

        if (RE_TEMPO.test(trimmed)) {
            // Tempo di header (sebelum ada notasi) memang wajar — bpm-nya
            // sudah pindah ke meta.json. Tempo di TENGAH lagu berarti
            // perubahan tempo, dan itu belum didukung: diabaikan + diberi
            // warning supaya tidak diam-diam salah.
            const notationSeen = segments.some((s) => s.kind === "notation");
            if (notationSeen) {
                warnings.push({
                    line: lineNo,
                    kind: "tempo-change",
                    text: `${trimmed} — perubahan tempo di tengah lagu belum didukung, diabaikan`,
                });
            }
            continue;
        }

        // Buang grup kurung dulu, karena di DALAM kurung huruf memang berdempet.
        const outsideGroups = trimmed
            .replace(/\[[^\]]*\]/g, " ")
            .replace(/\{[^}]*\}/g, " ");
        if (RE_NON_NOTATION.test(outsideGroups)) {
            warnings.push({
                line: lineNo,
                kind: "non-notation-line",
                text: trimmed.slice(0, 80),
            });
            continue;
        }

        segments.push({ kind: "notation", text: raw, line: lineNo, rawStart });
    }

    // ── Tahap 2: rangkai jadi satu aliran karakter ───────────────────────────
    // Digabung jadi satu aliran (bukan diproses per baris) supaya run pemisah
    // yang MELINTASI ganti baris — mis. baris berakhir "[8os]-" lalu baris
    // berikutnya mulai — tetap dihitung sebagai satu run utuh.
    let stream = "";
    const lineAt: number[] = [];
    /** offset di tab MENTAH untuk tiap karakter stream — dasar posisi token */
    const rawIdxAt: number[] = [];
    const transposeQueue: {
        index: number;
        value: number;
        delta: number | null;
        line: number;
    }[] = [];

    for (const seg of segments) {
        if (seg.kind === "transpose") {
            transposeQueue.push({
                index: stream.length,
                value: seg.value,
                delta: seg.delta,
                line: seg.line,
            });
            continue;
        }
        if (stream.length > 0) {
            stream += "\n";
            lineAt.push(seg.line);
            // Pemisah buatan antar segment: offsetnya tidak pernah dipakai token
            // (token hanya lahir dari karakter notasi), tapi panjang array ini
            // wajib tetap sejajar dengan stream.
            rawIdxAt.push(seg.rawStart);
        }
        for (let c = 0; c < seg.text.length; c++) {
            stream += seg.text[c];
            lineAt.push(seg.line);
            rawIdxAt.push(seg.rawStart + c);
        }
    }

    // ── Tahap 3: tokenisasi ──────────────────────────────────────────────────
    const events: NoteEvent[] = [];
    const tokens: TabToken[] = [];
    const transposeChanges: TransposeChange[] = [
        { time: 0, transpose: opts.transpose },
    ];
    let currentTranspose = opts.transpose;
    let step = 0;
    let tqi = 0;

    function applyTransposeQueue(upToIndex: number): void {
        while (tqi < transposeQueue.length && transposeQueue[tqi].index <= upToIndex) {
            const t = transposeQueue[tqi];
            tqi++;

            // Anotasi SEBELUM not pertama = header dokumentasi, bukan
            // perubahan. Sumber kebenarannya meta.json, jadi di sini cuma
            // divalidasi — kalau beda, kemungkinan salah ketik di salah satu.
            if (events.length === 0) {
                if (t.value !== opts.transpose) {
                    warnings.push({
                        line: t.line,
                        kind: "transpose-mismatch",
                        text: `header tab bilang ${t.value}, meta.json bilang ${opts.transpose} — meta.json yang dipakai`,
                    });
                }
                continue;
            }

            if (t.delta !== null && t.value - currentTranspose !== t.delta) {
                warnings.push({
                    line: t.line,
                    kind: "transpose-mismatch",
                    text: `"(${t.delta >= 0 ? "+" : ""}${t.delta})" tidak cocok: ${currentTranspose} → ${t.value} seharusnya (${t.value - currentTranspose >= 0 ? "+" : ""}${t.value - currentTranspose})`,
                });
            }

            if (t.value === currentTranspose) continue; // bukan perubahan
            currentTranspose = t.value;
            const time = step * stepMs;
            const last = transposeChanges[transposeChanges.length - 1];
            if (last.time === time) last.transpose = t.value;
            else transposeChanges.push({ time, transpose: t.value });
        }
    }

    /**
     * Catat satu token berbunyi beserta rentangnya di tab MENTAH.
     *
     * Offsetnya diambil dari rawIdxAt (bukan dihitung ulang), jadi baris
     * anotasi yang dibuang dan pemisah buatan antar segment tidak pernah
     * menggeser posisinya.
     */
    function pushToken(
        streamStart: number,
        streamEnd: number,
        time: number,
        notes: string[],
    ): void {
        if (notes.length === 0) return;
        const start = rawIdxAt[streamStart];
        const end = rawIdxAt[streamEnd];
        if (start === undefined || end === undefined) return;
        tokens.push({ start, end: end + 1, time, notes });
    }

    /**
     * Baca SATU simbol nada mulai dari posisi `at` di stream.
     *
     * Mengembalikan labelnya dan berapa karakter yang dipakai — 1 untuk not
     * biasa, 2 untuk not ctrl ("_q"). Pemanggil memakai `consumed` untuk
     * menentukan rentang token, supaya highlight di panel Sheets menyorot
     * "_q" utuh, bukan cuma garis bawahnya.
     */
    function readSymbol(
        at: number,
        line: number,
    ): { label: string | null; consumed: number } {
        const ch = stream[at];
        if (ch !== CTRL_PREFIX) {
            const label = KEY_MAP[ch];
            if (!label) warnings.push({ line, kind: "unknown-char", text: ch });
            return { label: label ?? null, consumed: 1 };
        }

        const next = stream[at + 1];
        if (next === undefined || DELIMITERS.has(next) || next === CTRL_PREFIX) {
            warnings.push({
                line,
                kind: "unknown-char",
                text: `"${CTRL_PREFIX}" tidak diikuti karakter nada`,
            });
            return { label: null, consumed: 1 };
        }
        const label = CTRL_KEY_MAP[next];
        if (!label) {
            warnings.push({
                line,
                kind: "unknown-char",
                text: `${CTRL_PREFIX}${next} (bukan tuts ctrl; yang ada: ${Object.keys(CTRL_KEY_MAP).join("")})`,
            });
        }
        return { label: label ?? null, consumed: 2 };
    }

    function pushNote(label: string, line: number, time: number): boolean {
        const baseMidi = MIDI_BY_LABEL[label];
        if (baseMidi === undefined) {
            warnings.push({
                line,
                kind: "unknown-char",
                text: `${label} (di luar jangkauan 88 tuts)`,
            });
            return false;
        }
        events.push({
            note: label,
            midi: baseMidi + currentTranspose,
            time,
            duration: stepMs,
        });
        return true;
    }

    let i = 0;
    while (i < stream.length) {
        applyTransposeQueue(i);

        const ch = stream[i];
        const line = lineAt[i] ?? 1;

        // ── Pemisah: telan seluruh run sekaligus ─────────────────────────────
        if (DELIMITERS.has(ch)) {
            let j = i;
            let marks = 0;
            let spaces = 0;
            let hasLineBreak = false;
            while (j < stream.length && DELIMITERS.has(stream[j])) {
                const d = stream[j];
                if (REST_MARKS.has(d)) marks++;
                else if (d === "\n" || d === "\r") hasLineBreak = true;
                else spaces++;
                j++;
            }

            if (marks > 0) step += marks; // spasi di sekitarnya = padding
            else if (!hasLineBreak && spaces >= 2) step += 1;
            // ganti baris murni layout → 0 rest

            i = j;
            continue;
        }

        // ── Grup chord ───────────────────────────────────────────────────────
        if (ch === "[" || ch === "{") {
            const wantClose = ch === "[" ? "]" : "}";
            // Cari penutup TERDEKAT dari jenis apa pun, supaya grup yang
            // ditulis campur (mis. "[abc}") tetap terbaca, bukan menelan
            // sisa lagu.
            let end = -1;
            for (let k = i + 1; k < stream.length; k++) {
                if (stream[k] === "]" || stream[k] === "}") {
                    end = k;
                    break;
                }
            }
            if (end === -1) {
                warnings.push({
                    line,
                    kind: "unbalanced-group",
                    text: `"${ch}" tidak punya penutup — sisa baris diabaikan`,
                });
                break;
            }
            if (stream[end] !== wantClose) {
                warnings.push({
                    line,
                    kind: "unbalanced-group",
                    text: `"${ch}" ditutup "${stream[end]}"`,
                });
            }

            const time = step * stepMs;
            const chordNotes: string[] = [];
            let k = i + 1;
            while (k < end) {
                if (DELIMITERS.has(stream[k])) {
                    k++; // toleransi "[a b]"
                    continue;
                }
                const { label, consumed } = readSymbol(k, line);
                if (label && pushNote(label, line, time)) chordNotes.push(label);
                k += consumed;
            }
            // SATU token untuk seluruh grup, termasuk kurung buka/tutupnya —
            // itulah yang membuat highlight menyorot akor secara utuh.
            pushToken(i, end, time, chordNotes);
            const pushed = chordNotes.length;
            if (pushed === 0) {
                warnings.push({
                    line,
                    kind: "empty-group",
                    text: stream.slice(i, end + 1),
                });
            }
            // Slot tetap dipakai walau grupnya kosong/invalid, supaya timing
            // sisa lagu tidak bergeser.
            step += 1;
            i = end + 1;
            continue;
        }

        // ── Not tunggal (termasuk not ctrl "_x") ────────────────────────────
        const singleTime = step * stepMs;
        const { label, consumed } = readSymbol(i, line);
        if (label && pushNote(label, line, singleTime)) {
            // streamEnd inklusif: "_q" -> i..i+1, not biasa -> i..i
            pushToken(i, i + consumed - 1, singleTime, [label]);
        }
        step += 1;
        i += consumed;
    }

    applyTransposeQueue(stream.length);

    return {
        events,
        tokens,
        transposeChanges,
        stepMs,
        stepCount: step,
        durationMs: step * stepMs,
        warnings,
    };
}
