// ─────────────────────────────────────────────────────────────────────────────
// scripts/checkSeek.mjs
//
//   node scripts/checkSeek.mjs
//
// Menguji hitungan seek yang SESUNGGUHNYA (computeSeekPoint dari
// lib/piano/seek.ts) terhadap seluruh lagu di library, termasuk lagu ber-timing
// MIDI (durasi not + pedal).
//
// Yang dibuktikan:
//   1. Kursor event/token/transpose/pedal sama dengan hasil pemindaian naif.
//   2. Not yang dipicu ulang HANYA yang memang masih berbunyi di titik seek,
//      dengan offset yang benar — tidak ada not lama yang ikut berbunyi lagi.
//   3. Tidak ada not yang belum mulai yang ikut dipicu oleh seek.
//   4. Seek ke 0 dan ke ujung lagu tetap konsisten.
//
// Tanpa browser: ini menguji logika yang mustahil dibuktikan oleh tsc/build.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");
const { computeSeekPoint } = await import("../lib/piano/seek.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";
const EPS = 1e-6;

let failures = 0;
function check(label, ok, detail = "") {
    if (ok) return true;
    failures++;
    console.log(`   ✗ ${label}${detail ? `  — ${detail}` : ""}`);
    return false;
}

function loadSongs() {
    const out = [];
    for (const diff of fs.readdirSync(SONGS_ROOT)) {
        for (const id of fs.readdirSync(path.join(SONGS_ROOT, diff))) {
            const dir = path.join(SONGS_ROOT, diff, id);
            const tabPath = path.join(dir, "tab.txt");
            if (!fs.existsSync(tabPath)) continue;

            const meta = JSON.parse(
                fs.readFileSync(path.join(dir, "meta.json"), "utf8"),
            );
            const parsed = parseTab(fs.readFileSync(tabPath, "utf8"), {
                bpm: meta.bpm,
                transpose: meta.transpose,
                stepsPerBeat: meta.stepsPerBeat ?? 2,
            });

            const timingPath = path.join(dir, "timing.json");
            const timing = fs.existsSync(timingPath)
                ? JSON.parse(fs.readFileSync(timingPath, "utf8"))
                : null;

            out.push({ id, diff, parsed, timing });
        }
    }
    return out;
}

function durationSlots(event, stepMs, timing) {
    if (!timing) return 1;
    const slot = Math.round(event.time / stepMs);
    return timing.durations[slot]?.[event.note] ?? 1;
}

function releaseAt(event, stepMs, timing) {
    return (
        event.time + durationSlots(event, stepMs, timing) * stepMs
    );
}

function firstAfter(items, t) {
    const idx = items.findIndex((x) => x.time > t);
    return idx === -1 ? items.length : idx;
}

/** Posisi uji: batas, awal/akhir, pedal/transpose, dan sebaran deterministik. */
function sampleTimes(song) {
    const { parsed, timing } = song;
    const { events, durationMs, stepMs } = parsed;
    const set = new Set([
        0,
        durationMs,
        durationMs / 2,
        Math.min(stepMs, durationMs),
    ]);

    for (let i = 0; i < Math.min(24, events.length); i++) {
        const e = events[i];
        set.add(e.time);
        set.add(Math.min(e.time + stepMs * 0.5, durationMs));
        set.add(Math.min(e.time + stepMs, durationMs));
    }
    for (let i = Math.max(0, events.length - 24); i < events.length; i++) {
        set.add(events[i].time);
        set.add(Math.min(events[i].time + stepMs * 0.5, durationMs));
    }
    for (const change of parsed.transposeChanges) {
        set.add(change.time);
        set.add(Math.min(change.time + 1, durationMs));
    }
    if (timing) {
        for (const [slot] of timing.pedal) {
            const t = slot * stepMs;
            set.add(Math.min(t, durationMs));
            set.add(Math.min(t + 1, durationMs));
        }
    }

    // Sebaran deterministik (LCG) — 120 titik, tidak bergantung Math.random
    // supaya hasilnya reproducible.
    let seed = 123456789;
    for (let i = 0; i < 120; i++) {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        set.add((seed / 2147483648) * durationMs);
    }

    return [...set].filter((t) => Number.isFinite(t));
}

function verifyPoint(song, t) {
    const { parsed, timing } = song;
    const { events, tokens, transposeChanges, durationMs, stepMs } = parsed;
    const clamped = Math.max(0, Math.min(t, durationMs));

    const point = computeSeekPoint({
        time: t,
        durationMs,
        stepMs,
        events,
        tokens,
        transposeChanges,
        timing,
    });

    const where = `${t.toFixed(1)}ms`;
    let ok = true;
    ok = check(`${song.id}: waktu di-clamp`, point.time === clamped, where) && ok;

    // ── Kursor event / token ────────────────────────────────────────────────
    ok =
        check(
            `${song.id}: eventIdx = event pertama setelah titik`,
            point.eventIdx === firstAfter(events, clamped),
            `${where} → ${point.eventIdx} vs ${firstAfter(events, clamped)}`,
        ) && ok;

    const tokenIdx = firstAfter(tokens, clamped);
    ok =
        check(
            `${song.id}: kursor token + sorotan`,
            point.tokenIdx === tokenIdx && point.activeToken === tokenIdx - 1,
            `${where}`,
        ) && ok;

    // ── Transpose ───────────────────────────────────────────────────────────
    let expectedTranspose = transposeChanges[0]?.transpose ?? 0;
    let expectedTransposeIdx = 0;
    while (
        expectedTransposeIdx < transposeChanges.length &&
        transposeChanges[expectedTransposeIdx].time <= clamped
    ) {
        expectedTranspose = transposeChanges[expectedTransposeIdx].transpose;
        expectedTransposeIdx++;
    }
    ok =
        check(
            `${song.id}: transpose di titik seek`,
            point.transpose === expectedTranspose &&
                point.transposeIdx === expectedTransposeIdx,
            `${where} → ${point.transpose} vs ${expectedTranspose}`,
        ) && ok;

    // ── Pedal ───────────────────────────────────────────────────────────────
    let expectedPedalIdx = 0;
    let expectedPedal = false;
    if (timing) {
        if (timing.pedal.length === 0) {
            expectedPedal = true;
        } else {
            while (
                expectedPedalIdx < timing.pedal.length &&
                timing.pedal[expectedPedalIdx][0] * stepMs <= clamped
            ) {
                expectedPedalIdx++;
            }
            expectedPedal =
                expectedPedalIdx > 0 &&
                timing.pedal[expectedPedalIdx - 1][1] === 1;
        }
    }
    ok =
        check(
            `${song.id}: pedal di titik seek`,
            point.pedalOn === expectedPedal &&
                point.pedalIdx === expectedPedalIdx,
            `${where} → ${point.pedalOn}/${point.pedalIdx} vs ${expectedPedal}/${expectedPedalIdx}`,
        ) && ok;

    // ── Not yang melintasi titik ────────────────────────────────────────────
    // Referensi naif: onset terbaru per label, lalu saring yang masih berbunyi.
    // Onset memakai perbandingan PERSIS (sama dengan scheduler: event yang
    // time-nya > elapsed belum dipicu); hanya batas release yang diberi
    // toleransi karena time dihitung dari slot × stepMs.
    const latestByNote = new Map();
    for (const e of events) {
        if (e.time <= clamped) latestByNote.set(e.note, e);
    }
    const expectedOngoing = [];
    for (const e of latestByNote.values()) {
        // Seek ke ujung lagu tidak meng-arm nada apa pun (lihat seek.ts).
        if (clamped >= durationMs) break;
        if (releaseAt(e, stepMs, timing) > clamped + EPS) {
            expectedOngoing.push({
                note: e.note,
                offsetMs: clamped - e.time,
            });
        }
    }
    expectedOngoing.sort(
        (a, b) => a.offsetMs - b.offsetMs || a.note.localeCompare(b.note),
    );

    const actualOngoing = [...point.ongoing].sort(
        (a, b) => a.offsetMs - b.offsetMs || a.note.localeCompare(b.note),
    );
    ok =
        check(
            `${song.id}: set nada yang masih berbunyi`,
            actualOngoing.length === expectedOngoing.length &&
                actualOngoing.every(
                    (n, i) =>
                        n.note === expectedOngoing[i].note &&
                        Math.abs(n.offsetMs - expectedOngoing[i].offsetMs) <
                            EPS,
                ),
            `${where} → ${actualOngoing.length} vs ${expectedOngoing.length}`,
        ) && ok;

    ok =
        check(
            `${song.id}: tidak ada nada yang sudah selesai dipicu ulang`,
            point.ongoing.every((n) => n.releaseAt > clamped + EPS),
            where,
        ) && ok;

    ok =
        check(
            `${song.id}: tidak ada nada masa depan yang ikut dipicu`,
            point.ongoing.every((n) => n.offsetMs >= -EPS),
            where,
        ) && ok;

    // ── Kursor konsisten dengan event yang akan dipicu berikutnya ───────────
    const nextEvent = events[point.eventIdx];
    ok =
        check(
            `${song.id}: event berikutnya benar-benar belum lewat`,
            !nextEvent || nextEvent.time > clamped,
            where,
        ) && ok;

    const previousEvent = events[point.eventIdx - 1];
    ok =
        check(
            `${song.id}: semua event sebelum kursor sudah lewat`,
            !previousEvent || previousEvent.time <= clamped,
            where,
        ) && ok;

    // ── Seek ke ujung: tidak boleh ada nada yang di-arm ─────────────────────
    if (clamped >= durationMs) {
        ok =
            check(
                `${song.id}: seek ke ujung tidak memulai nada`,
                point.ongoing.length === 0,
                where,
            ) && ok;
    }

    return ok;
}

const songs = loadSongs();
console.log(`\nMenguji seek pada ${songs.length} lagu…\n`);

let points = 0;
for (const song of songs) {
    const times = sampleTimes(song);
    let songOk = true;
    for (const t of times) {
        points++;
        if (!verifyPoint(song, t)) songOk = false;
    }
    if (songOk) {
        const timingLabel = song.timing ? "timing MIDI" : "tanpa timing";
        console.log(
            `   ✓ ${song.diff}/${song.id} — ${times.length} titik, ${timingLabel}`,
        );
    } else {
        console.log(`   ✗ ${song.diff}/${song.id}`);
    }
}

console.log(
    `\n${failures === 0 ? "✓" : "✗"} ${points} titik seek diuji, ${failures} kegagalan.\n`,
);

process.exit(failures === 0 ? 0 : 1);
