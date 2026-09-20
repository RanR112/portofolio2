// ─────────────────────────────────────────────────────────────────────────────
// scripts/lib/midi.mjs
//
// Pembaca file MIDI seadanya — hanya yang dibutuhkan untuk mengubah sheet
// menjadi tab: nada, waktu mulai, durasi, tempo, dan birama.
//
// Ditulis sendiri dengan Node polos, TANPA dependency baru — konsisten dengan
// script lain di folder ini (buildSongs / previewTab / checkLearn). Format MIDI
// sederhana dan sudah beku sejak 1996, jadi tidak ada yang perlu di-maintain.
//
// Yang SENGAJA tidak didukung karena tidak dipakai: sysex, pitch bend,
// control change, aftertouch, program change. Semua itu dilewati saja.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Satu not yang sudah dipasangkan note-on dengan note-off-nya.
 *
 * @typedef {Object} MidiNote
 * @property {number} track   indeks track (0 = biasanya tangan kanan)
 * @property {number} midi    nomor nada MIDI (60 = C4)
 * @property {number} start   tick absolut
 * @property {number} end     tick absolut
 * @property {number} velocity
 */

/**
 * @typedef {Object} MidiFile
 * @property {number} format
 * @property {number} division        tick per not seperempat
 * @property {MidiNote[]} notes       urut berdasarkan start, lalu midi
 * @property {number} microsPerBeat   dari meta Set Tempo (default 500000 = 120bpm)
 * @property {[number,number]} timeSignature  mis. [4,4]
 * @property {string[]} trackNames
 * @property {number} endTick
 */

class Reader {
    constructor(buf, pos = 0) {
        this.buf = buf;
        this.pos = pos;
    }
    u8() {
        return this.buf[this.pos++];
    }
    u16() {
        const v = this.buf.readUInt16BE(this.pos);
        this.pos += 2;
        return v;
    }
    u32() {
        const v = this.buf.readUInt32BE(this.pos);
        this.pos += 4;
        return v;
    }
    ascii(n) {
        const v = this.buf.toString("ascii", this.pos, this.pos + n);
        this.pos += n;
        return v;
    }
    bytes(n) {
        const v = this.buf.subarray(this.pos, this.pos + n);
        this.pos += n;
        return v;
    }
    /** Variable-length quantity: 7 bit per byte, bit ke-8 = penanda lanjut. */
    vlq() {
        let v = 0;
        for (;;) {
            const b = this.u8();
            v = (v << 7) | (b & 0x7f);
            if ((b & 0x80) === 0) return v;
        }
    }
}

/**
 * @param {Buffer} buf
 * @returns {MidiFile}
 */
export function parseMidi(buf) {
    const r = new Reader(buf);
    if (r.ascii(4) !== "MThd") throw new Error("Bukan file MIDI (magic MThd tidak ada)");
    const headerLen = r.u32();
    const format = r.u16();
    const ntracks = r.u16();
    const division = r.u16();
    r.pos = 8 + headerLen; // hormati panjang header, jangan asumsikan 6

    if (division & 0x8000) {
        throw new Error("MIDI SMPTE timecode belum didukung — butuh division tick-per-beat");
    }

    /** @type {MidiNote[]} */
    const notes = [];
    const trackNames = [];
    let microsPerBeat = 500000;
    let timeSignature = [4, 4];
    let endTick = 0;

    for (let t = 0; t < ntracks; t++) {
        if (r.ascii(4) !== "MTrk") throw new Error(`Chunk MTrk ke-${t} tidak ditemukan`);
        const len = r.u32();
        const trackEnd = r.pos + len;

        let tick = 0;
        let running = 0;
        /** note-on yang belum ketemu pasangan off-nya: key = channel<<8|midi */
        const open = new Map();

        while (r.pos < trackEnd) {
            tick += r.vlq();

            let status = r.u8();
            if (status < 0x80) {
                // running status: byte ini ternyata data, bukan status
                r.pos--;
                status = running;
            } else if (status < 0xf0) {
                running = status;
            }

            if (status === 0xff) {
                const type = r.u8();
                const dataLen = r.vlq();
                const data = r.bytes(dataLen);
                if (type === 0x51 && dataLen === 3) {
                    microsPerBeat = (data[0] << 16) | (data[1] << 8) | data[2];
                } else if (type === 0x58 && dataLen >= 2) {
                    timeSignature = [data[0], 2 ** data[1]];
                } else if (type === 0x03) {
                    trackNames[t] = data.toString("utf8");
                }
                continue;
            }
            if (status === 0xf0 || status === 0xf7) {
                r.bytes(r.vlq()); // sysex — dilewati
                continue;
            }

            const kind = status & 0xf0;
            const channel = status & 0x0f;

            if (kind === 0x90 || kind === 0x80) {
                const midi = r.u8();
                const velocity = r.u8();
                const key = (channel << 8) | midi;
                // note-on velocity 0 = note-off, sesuai spesifikasi MIDI
                if (kind === 0x90 && velocity > 0) {
                    // Not yang sama ditekan lagi sebelum dilepas: tutup yang lama
                    // di tick ini supaya tidak ada not yang menggantung.
                    const prev = open.get(key);
                    if (prev !== undefined) {
                        notes.push({ ...prev, end: tick });
                        open.delete(key);
                    }
                    open.set(key, { track: t, midi, start: tick, velocity });
                } else {
                    const prev = open.get(key);
                    if (prev !== undefined) {
                        notes.push({ ...prev, end: tick });
                        open.delete(key);
                    }
                }
                continue;
            }

            // Event channel lain: 2 byte data, kecuali program change &
            // channel pressure yang cuma 1.
            if (kind === 0xc0 || kind === 0xd0) r.u8();
            else {
                r.u8();
                r.u8();
            }
        }

        // Not yang belum ditutup sampai akhir track — tutup di akhir track.
        for (const n of open.values()) notes.push({ ...n, end: tick });
        endTick = Math.max(endTick, tick);
        r.pos = trackEnd; // jaga-jaga kalau ada sisa byte
    }

    notes.sort((a, b) => a.start - b.start || a.midi - b.midi);
    return { format, division, notes, microsPerBeat, timeSignature, trackNames, endTick };
}

/** Tempo MIDI (mikrodetik per ketuk) → BPM. */
export function bpmFromMicros(microsPerBeat) {
    return 60000000 / microsPerBeat;
}

/**
 * Cari berapa tick untuk satu slot terkecil, DARI DATANYA SENDIRI.
 *
 * Kenapa tidak percaya header: aplikasi notasi sering menulis tempo header
 * (mis. 120bpm) yang beda dari tempo partitur (mis. 85bpm), sementara posisi
 * not-notnya dirender pada tempo yang sebenarnya. Kalau header dipercaya,
 * seluruh ritme akan meleset ~1,4x. Dengan mencarinya dari jarak antar-not,
 * hasilnya benar tanpa perlu tahu tempo aslinya lebih dulu.
 *
 * Skornya dinormalkan ke ukuran slot: galat 2 tick pada slot 10 tick jauh
 * lebih buruk daripada galat 2 tick pada slot 100 tick.
 *
 * @param {number[]} starts tick mulai (boleh duplikat)
 * @param {{min?: number, max?: number, step?: number}} [opts]
 */
export function findGrid(starts, opts = {}) {
    const uniq = [...new Set(starts)].sort((a, b) => a - b);
    const { min = 8, max = 240, step = 0.01 } = opts;

    let best = null;
    for (let unit = min; unit <= max; unit += step) {
        let sum = 0;
        let worst = 0;
        for (const s of uniq) {
            const e = Math.abs(s - Math.round(s / unit) * unit);
            sum += e;
            if (e > worst) worst = e;
        }
        const mean = sum / uniq.length;
        const score = mean / unit;
        if (!best || score < best.score) best = { unit, mean, worst, score };
    }
    return best;
}
