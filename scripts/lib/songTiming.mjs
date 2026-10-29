// ─────────────────────────────────────────────────────────────────────────────
// scripts/lib/songTiming.mjs
//
// Membangun timing.json dari file MIDI: durasi tiap not + otomasi pedal (CC64),
// dalam satuan SLOT tab — bukan milidetik.
//
// Kenapa slot, bukan ms: parseTab menurunkan waktu dari (bpm, stepsPerBeat), dan
// keduanya bisa ditimpa lewat URL (?spb=3) saat kalibrasi. Kalau timing disimpan
// dalam ms, override itu akan membuat not dan durasinya berpisah. Dalam slot,
// keduanya selalu menempel: slot N selalu berbunyi pada N * stepMs.
//
// Bentuk file:
//   {
//     "version": 1,
//     "stepMs": 45.18,                       // hanya informasi + validasi
//     "durations": { "120": { "1": 8 } },    // slot -> label tuts -> jumlah slot
//     "pedal": [[0, 1], [96, 0]]             // [slot, 1=injak / 0=lepas]
//   }
//
// Dipakai dua tempat:
//   - scripts/midiToTab.mjs   → lagu baru, saat tab-nya dibuat
//   - scripts/midiTiming.mjs  → backfill lagu lama tanpa menyentuh tab.txt
// ─────────────────────────────────────────────────────────────────────────────

import "../_tsHook.mjs";
import {
    warpTickToReferenceTempo,
} from "./midi.mjs";

const { MIDI_BY_LABEL } = await import("../../lib/keyMap.ts");

/**
 * MIDI → label tuts. Rentangnya selalu lengkap A0..C8 (lihat lib/keyMap.ts),
 * jadi setiap nada yang sudah dilipat pasti punya label.
 * @type {Record<number, string>}
 */
export const LABEL_BY_MIDI = {};
for (const [label, midi] of Object.entries(MIDI_BY_LABEL)) {
    LABEL_BY_MIDI[midi] = label;
}

const MIDI_LO = Math.min(...Object.keys(LABEL_BY_MIDI).map(Number));
const MIDI_HI = Math.max(...Object.keys(LABEL_BY_MIDI).map(Number));

/**
 * Lipat oktaf sampai nada masuk rentang yang bisa ditulis. Logikanya HARUS
 * identik dengan midiToTab.mjs: label yang dihasilkan di sini dipakai sebagai
 * kunci durations, dan kunci itu dicocokkan dengan label di tab.
 */
export function foldIntoRange(midi, shift = 0) {
    let m = midi + shift;
    let folds = 0;
    while (m < MIDI_LO) {
        m += 12;
        folds++;
    }
    while (m > MIDI_HI) {
        m -= 12;
        folds++;
    }
    let guard = 0;
    while (LABEL_BY_MIDI[m] === undefined && guard < 8) {
        m += m < 60 ? 12 : -12;
        folds++;
        guard++;
    }
    return { midi: m, folds };
}

/**
 * Timeline hasil warp tempo (kalau file punya >1 tempo), mengikuti PERSIS
 * prosedur midiToTab.mjs:
 *
 *   - segmen acuan = segmen tempo dengan not TERBANYAK (bukan yang terakhir —
 *     tempo terakhir sering cuma penanda ritardando tanpa not);
 *   - tick di segmen lain diregangkan supaya durasi NYATA-nya tetap;
 *   - seluruh timeline digeser balik supaya segmen acuan kembali ke tick
 *     aslinya (fase grid utuh);
 *   - kalau ada tick negatif, digeser lagi sebesar kelipatan BULAT unit grid.
 *
 * Final shift bergantung pada unit grid, jadi disediakan sebagai fungsi.
 */
export function buildTimeline(midi) {
    const multiTempo = midi.tempoMap.length > 1;
    let referenceMicrosPerBeat = midi.microsPerBeat;
    let shiftAmount = 0;

    if (multiTempo) {
        const segments = midi.tempoMap.map((ev, i) => {
            const end =
                i + 1 < midi.tempoMap.length
                    ? midi.tempoMap[i + 1].tick
                    : Infinity;
            return {
                ...ev,
                end,
                notes: midi.notes.filter(
                    (n) => n.start >= ev.tick && n.start < end,
                ),
            };
        });
        const reference = segments.reduce((a, b) =>
            b.notes.length > a.notes.length ? b : a,
        );
        referenceMicrosPerBeat = reference.microsPerBeat;
        shiftAmount =
            warpTickToReferenceTempo(
                reference.tick,
                midi.tempoMap,
                midi.division,
                referenceMicrosPerBeat,
            ) - reference.tick;
    }

    const warpTick = (tick) =>
        multiTempo
            ? warpTickToReferenceTempo(
                  tick,
                  midi.tempoMap,
                  midi.division,
                  referenceMicrosPerBeat,
              ) - shiftAmount
            : tick;

    return {
        multiTempo,
        referenceMicrosPerBeat,
        warpTick,
        /** Geseran akhir (>= 0) yang membuat semua tick hasil warp tidak negatif. */
        finalShiftFor(unit, ticks) {
            const min = Math.min(...ticks.map(warpTick));
            return min < 0 ? Math.ceil(-min / unit) * unit : 0;
        },
    };
}

/**
 * Satukan onset yang berjarak <= chordWindow tick (artefak rekaman permainan).
 * Jangkar diukur dari onset paling awal gugus, bukan onset sebelumnya — kalau
 * tidak, deretan onset yang masing-masing berjarak sebatas jendela akan
 * berantai jadi satu gugus raksasa. Logika ini sama dengan midiToTab.mjs.
 */
export function snapOnsets(starts, chordWindow) {
    if (chordWindow <= 0) return starts.slice();
    const uniq = [...new Set(starts)].sort((a, b) => a - b);
    const snapTo = new Map();
    let anchor = uniq[0];
    for (const s of uniq) {
        if (s - anchor > chordWindow) anchor = s;
        snapTo.set(s, anchor);
    }
    return starts.map((s) => snapTo.get(s));
}

/**
 * @param {object} opts
 * @param {import("./midi.mjs").MidiFile} opts.midi
 * @param {number} opts.unit          tick per slot (hasil findGrid / --grid)
 * @param {number} [opts.spb]         stepsPerBeat dari meta.json
 * @param {number} [opts.bpm]         bpm dari meta.json
 * @param {number} [opts.shift]       semitone (sama dengan --shift konverter)
 * @param {number} [opts.chordWindow] tick
 * @param {number} [opts.maxSlot]     slot terakhir yang ada di tab
 * @param {ReturnType<typeof buildTimeline>} [opts.timeline]
 */
export function computeTiming({
    midi,
    unit,
    spb,
    bpm,
    shift = 0,
    chordWindow = 0,
    maxSlot = Infinity,
    timeline = buildTimeline(midi),
}) {
    if (!(unit > 0)) throw new Error(`unit grid tidak valid: ${unit}`);
    if (!(bpm > 0) || !(spb > 0)) {
        throw new Error("computeTiming butuh bpm dan stepsPerBeat untuk stepMs");
    }

    const snappedStarts = snapOnsets(
        midi.notes.map((n) => n.start),
        chordWindow,
    );
    const finalShift = timeline.finalShiftFor(unit, snappedStarts);
    const slotOf = (tick) =>
        Math.round((timeline.warpTick(tick) + finalShift) / unit);

    // ── Durasi per (slot, label) ─────────────────────────────────────────────
    /** @type {Map<number, Map<string, number>>} */
    const bySlot = new Map();
    let dropped = 0;

    midi.notes.forEach((n, i) => {
        const startSlot = slotOf(snappedStarts[i]);
        const endSlot = slotOf(n.end);
        // Not yang mulai dan berakhir di slot yang sama tetap harus berbunyi
        // satu slot — kalau 0, scheduler akan melepasnya di tick yang sama
        // dengan saat ditekan.
        const dur = Math.max(1, endSlot - startSlot);
        const { midi: fitted } = foldIntoRange(n.midi, shift);
        const label = LABEL_BY_MIDI[fitted];
        if (label === undefined) {
            dropped++;
            return;
        }
        if (startSlot > maxSlot) return;
        if (!bySlot.has(startSlot)) bySlot.set(startSlot, new Map());
        const slotMap = bySlot.get(startSlot);
        // Nada kembar di slot yang sama (dua track, atau dua not yang
        // terkuantisasi ke slot sama) dilebur. Durasi terpanjang yang dipakai,
        // supaya tidak ada not yang terputus lebih awal dari sumbernya.
        slotMap.set(label, Math.max(slotMap.get(label) ?? 0, dur));
    });

    // Objek dengan kunci slot terurut, supaya diff git-nya stabil.
    /** @type {Record<string, Record<string, number>>} */
    const durations = {};
    for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
        const obj = {};
        for (const label of [...bySlot.get(slot).keys()].sort()) {
            obj[label] = bySlot.get(slot).get(label);
        }
        durations[slot] = obj;
    }

    // ── Pedal ────────────────────────────────────────────────────────────────
    // Nilai >= 64 = diinjak. Event di slot yang sama dilebur (yang terakhir
    // menang), lalu nilai yang sama beruntun dibuang supaya file tetap kecil
    // dan playback tidak memanggil setSustain berulang tanpa efek.
    /** @type {Map<number, 0|1>} */
    const pedalBySlot = new Map();
    for (const ev of midi.pedalEvents) {
        const slot = slotOf(ev.tick);
        if (slot < 0 || slot > maxSlot) continue;
        pedalBySlot.set(slot, ev.value >= 64 ? 1 : 0);
    }
    /** @type {[number, 0|1][]} */
    const pedal = [];
    let last = 0; // kondisi awal: pedal lepas
    for (const slot of [...pedalBySlot.keys()].sort((a, b) => a - b)) {
        const on = pedalBySlot.get(slot);
        if (on === last) continue;
        pedal.push([slot, on]);
        last = on;
    }

    return {
        timing: {
            version: 1,
            stepMs:
                bpm && spb
                    ? Number((60000 / bpm / spb).toFixed(4))
                    : undefined,
            durations,
            pedal,
        },
        stats: {
            unit,
            chordWindow,
            finalShift,
            multiTempo: timeline.multiTempo,
            notes: midi.notes.length,
            dropped,
            durationSlots: Object.keys(durations).length,
            pedalEvents: midi.pedalEvents.length,
            pedalChanges: pedal.length,
        },
    };
}

/**
 * Panjang bar visual yang "masuk akal saat dilihat", terpisah dari panjang
 * audio.
 *
 * Aturan ini sengaja konservatif:
 *   - hanya nada melody (>= C4) yang dipendekkan;
 *   - hanya kalau barnya menyeberangi MINIMAL 2 onset lain — satu onset yang
 *     kebetulan berdekatan masih wajar (legato/sustain pendek);
 *   - nada bass (< C4) dan slot terakhir dibiarkan, karena bar panjang di sana
 *     memang menunjukkan suara yang ditahan.
 *
 * Hasilnya tetap dalam SLOT, jadi ikut menyesuaikan kalau stepsPerBeat ditimpa
 * lewat URL. Nilai minimum ~80 ms mencegah bar menjadi terlalu pendek untuk
 * terlihat pada tempo cepat.
 *
 * Kembaliannya HANYA berisi not yang dipendekkan. Not lain tidak perlu ditulis
 * dua kali; scheduler memakai `durations` sebagai fallback.
 *
 * @param {Record<number, Record<string, number>>} durations
 * @param {number} stepMs
 * @param {{minVisibleMs?: number, melodyMinMidi?: number, minCrossedOnsets?: number}} [opts]
 * @returns {Record<number, Record<string, number>>}
 */
export function computeVisualDurations(durations, stepMs, opts = {}) {
    if (!(stepMs > 0)) {
        throw new Error(`stepMs tidak valid untuk visual timing: ${stepMs}`);
    }

    const minVisibleMs = opts.minVisibleMs ?? 80;
    const melodyMinMidi = opts.melodyMinMidi ?? 60; // C4
    const minCrossedOnsets = opts.minCrossedOnsets ?? 2;
    const minSlots = Math.max(1, Math.round(minVisibleMs / stepMs));

    const slots = Object.keys(durations)
        .map(Number)
        .sort((a, b) => a - b);

    /** Indeks slot pertama yang lebih besar dari `value`. */
    function firstAfter(value) {
        let lo = 0;
        let hi = slots.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (slots[mid] <= value) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    /** @type {Record<number, Record<string, number>>} */
    const overrides = {};

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const next = slots[i + 1];

        for (const label of Object.keys(durations[slot]).sort()) {
            const duration = durations[slot][label];
            if (next === undefined) continue;

            const gap = next - slot;
            const cap = Math.max(minSlots, gap);
            const midi = MIDI_BY_LABEL[label];

            if (midi === undefined || midi < melodyMinMidi || duration <= cap) {
                continue;
            }

            // Hitung onset lain yang benar-benar berada DI DALAM bar. Onset
            // tepat di ujung tidak dihitung: bar yang berhenti tepat saat not
            // berikutnya mulai masih terlihat wajar.
            const end = slot + duration;
            let crossed = 0;
            for (
                let j = firstAfter(slot);
                j < slots.length && slots[j] < end;
                j++
            ) {
                crossed++;
            }
            if (crossed < minCrossedOnsets) continue;

            if (!overrides[slot]) overrides[slot] = {};
            overrides[slot][label] = Math.max(1, cap);
        }
    }

    return overrides;
}

/**
 * Format timing.json: satu slot per baris. Bukan sekadar kosmetik — file ini
 * ikut di-commit, dan JSON satu baris 50 KB membuat diff git tidak terbaca.
 */
export function formatTiming(timing) {
    const slots = Object.entries(timing.durations).map(
        ([slot, labels]) => `    ${JSON.stringify(String(slot))}: ${JSON.stringify(labels)}`,
    );
    const visualSlots = timing.visualDurations
        ? Object.entries(timing.visualDurations).map(([slot, labels]) => {
              const sorted = Object.fromEntries(
                  Object.keys(labels)
                      .sort()
                      .map((label) => [label, labels[label]]),
              );
              return `    ${JSON.stringify(String(slot))}: ${JSON.stringify(sorted)}`;
          })
        : null;
    const pedal = timing.pedal.length
        ? `[\n    ${timing.pedal.map((p) => JSON.stringify(p)).join(",\n    ")}\n  ]`
        : "[]";
    return (
        "{\n" +
        `  "version": ${timing.version},\n` +
        `  "stepMs": ${JSON.stringify(timing.stepMs)},\n` +
        `  "durations": {\n${slots.join(",\n")}\n  },\n` +
        (visualSlots
            ? `  "visualDurations": {\n${visualSlots.join(",\n")}\n  },\n`
            : "") +
        `  "pedal": ${pedal}\n` +
        "}\n"
    );
}

/**
 * Bandingkan timing dengan hasil parseTab(tab). Dipakai buildSongs (validasi
 * build) DAN backfill (memastikan tebakan grid benar). Semua masalah
 * dikembalikan, bukan dilempar, supaya pemanggil bisa memutuskan.
 *
 * @param {object} timing
 * @param {import("../../lib/piano/parseTab.ts").ParsedSong} parsed
 * @returns {string[]}
 */
export function validateTiming(timing, parsed) {
    const issues = [];

    if (timing.version !== 1) issues.push(`version harus 1, bukan ${timing.version}`);
    if (!Number.isFinite(timing.stepMs) || timing.stepMs <= 0) {
        issues.push(`stepMs tidak valid: ${JSON.stringify(timing.stepMs)}`);
    } else if (Math.abs(timing.stepMs - parsed.stepMs) > 0.01) {
        issues.push(
            `stepMs ${timing.stepMs} tidak cocok dengan tab ${parsed.stepMs.toFixed(4)}`,
        );
    }

    const events = new Map();
    for (const e of parsed.events) {
        const slot = Math.round(e.time / parsed.stepMs);
        if (!events.has(slot)) events.set(slot, new Set());
        events.get(slot).add(e.note);
    }

    if (!timing.durations || typeof timing.durations !== "object") {
        issues.push("durations tidak ada");
    } else {
        for (const [slotKey, labels] of Object.entries(timing.durations)) {
            const slot = Number(slotKey);
            if (!Number.isInteger(slot) || slot < 0) {
                issues.push(`slot tidak valid: ${slotKey}`);
                continue;
            }
            if (slot >= parsed.stepCount) {
                issues.push(`slot ${slot} di luar tab (stepCount ${parsed.stepCount})`);
            }
            const expected = events.get(slot);
            if (!expected) {
                issues.push(`slot ${slot} tidak punya not di tab`);
                continue;
            }
            for (const [label, dur] of Object.entries(labels)) {
                if (!expected.has(label)) {
                    issues.push(`slot ${slot}: label "${label}" tidak ada di tab`);
                }
                if (!Number.isInteger(dur) || dur < 1) {
                    issues.push(`slot ${slot} "${label}": durasi tidak valid (${dur})`);
                }
            }
            for (const label of expected) {
                if (labels[label] === undefined) {
                    issues.push(`slot ${slot}: "${label}" tidak punya durasi`);
                }
            }
        }
        for (const [slot, labels] of events) {
            if (!timing.durations[slot]) {
                issues.push(
                    `slot ${slot} berisi ${[...labels].join(",")} tapi tidak ada di timing`,
                );
            }
        }
    }

    if (timing.visualDurations !== undefined) {
        if (
            !timing.visualDurations ||
            typeof timing.visualDurations !== "object"
        ) {
            issues.push("visualDurations harus objek");
        } else {
            for (const [slotKey, labels] of Object.entries(
                timing.visualDurations,
            )) {
                const slot = Number(slotKey);
                const audio = timing.durations?.[slot];
                if (!audio) {
                    issues.push(
                        `visualDurations slot ${slotKey} tidak ada di durations`,
                    );
                    continue;
                }
                for (const [label, dur] of Object.entries(labels)) {
                    if (!Number.isInteger(dur) || dur < 1) {
                        issues.push(
                            `visualDurations slot ${slotKey} "${label}": durasi tidak valid (${dur})`,
                        );
                    } else if (audio[label] === undefined) {
                        issues.push(
                            `visualDurations slot ${slotKey}: label "${label}" tidak ada di durations`,
                        );
                    } else if (dur > audio[label]) {
                        issues.push(
                            `visualDurations slot ${slotKey} "${label}": ${dur} > audio ${audio[label]}`,
                        );
                    }
                }
            }
        }
    }

    if (!Array.isArray(timing.pedal)) {
        issues.push("pedal harus array");
    } else {
        let prevSlot = -1;
        let prevValue = 0;
        for (const entry of timing.pedal) {
            if (!Array.isArray(entry) || entry.length !== 2) {
                issues.push(`entri pedal tidak valid: ${JSON.stringify(entry)}`);
                continue;
            }
            const [slot, value] = entry;
            if (!Number.isInteger(slot) || slot < 0) {
                issues.push(`slot pedal tidak valid: ${JSON.stringify(entry)}`);
                continue;
            }
            if (slot >= parsed.stepCount) {
                issues.push(
                    `slot pedal ${slot} di luar tab (stepCount ${parsed.stepCount})`,
                );
            }
            if (value !== 0 && value !== 1) {
                issues.push(`nilai pedal harus 0/1: ${JSON.stringify(entry)}`);
            }
            if (slot <= prevSlot) issues.push(`pedal tidak urut naik di slot ${slot}`);
            if (value === prevValue) {
                issues.push(`pedal mengulang nilai ${value} di slot ${slot}`);
            }
            prevSlot = slot;
            prevValue = value;
        }
    }

    return issues;
}
