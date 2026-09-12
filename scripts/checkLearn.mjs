// ─────────────────────────────────────────────────────────────────────────────
// scripts/checkLearn.mjs
//
//   node scripts/checkLearn.mjs
//
// Menjalankan aturan mode learn yang SESUNGGUHNYA (learnStep & learnPressResult
// dari lib/piano/playback.ts) terhadap lagu yang sesungguhnya, lalu memeriksa
// invarian-invariannya.
//
// Kenapa ada: aturan "bar berhenti tepat di atas tuts yang seharusnya ditekan,
// menunggu sampai user menekannya" tidak bisa dibuktikan oleh type-check
// maupun `next build` — keduanya hanya membuktikan kodenya ter-compile. Di sini
// jam lagu disimulasikan tick demi tick supaya perilakunya benar-benar teruji
// tanpa perlu browser.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import "./_tsHook.mjs";

const { parseTab } = await import("../lib/piano/parseTab.ts");
const { groupChords, learnStep, learnPressResult, LEARN_LEAD_MS } =
    await import("../lib/piano/playback.ts");
const { KEY_MAP } = await import("../lib/keyMap.ts");

const SONGS_ROOT = "app/[locale]/piano/data/songs";
const TICK_MS = 25;

let failures = 0;
function check(label, ok, detail = "") {
    if (ok) {
        console.log(`   ✓ ${label}`);
    } else {
        failures++;
        console.log(`   ✗ ${label}${detail ? `  — ${detail}` : ""}`);
    }
}

function loadSongs() {
    const out = [];
    for (const d of fs.readdirSync(SONGS_ROOT)) {
        for (const id of fs.readdirSync(path.join(SONGS_ROOT, d))) {
            const dir = path.join(SONGS_ROOT, d, id);
            if (!fs.existsSync(path.join(dir, "tab.txt"))) continue;
            const meta = JSON.parse(
                fs.readFileSync(path.join(dir, "meta.json"), "utf8"),
            );
            const parsed = parseTab(
                fs.readFileSync(path.join(dir, "tab.txt"), "utf8"),
                {
                    bpm: meta.bpm,
                    transpose: meta.transpose,
                    stepsPerBeat: meta.stepsPerBeat ?? 2,
                },
            );
            out.push({
                id,
                meta,
                parsed,
                chords: groupChords(parsed.events),
                raw: fs.readFileSync(path.join(dir, "tab.txt"), "utf8"),
            });
        }
    }
    return out;
}

/**
 * Simulasikan mode learn.
 *
 * @param player "perfect" = selalu menekan not yang benar begitu bar tiba;
 *               "idle"    = tidak pernah menekan apa pun;
 *               "wrong"   = selalu menekan tuts yang salah.
 */
function simulate(song, player, maxTicks = 400000) {
    const chords = song.chords;
    let songTime = -LEARN_LEAD_MS;
    let idx = 0;
    let pressed = new Set();
    let ticks = 0;
    let maxOvershoot = 0;
    let frozenTicks = 0;

    while (ticks < maxTicks) {
        ticks++;
        songTime += TICK_MS;

        const r = learnStep({ chords, idx, songTime, leadMs: LEARN_LEAD_MS });
        songTime = r.songTime;
        if (r.frozen) frozenTicks++;

        // Invarian utama: jam tidak boleh pernah melewati akor yang ditunggu.
        const pendingChord = chords[idx];
        if (pendingChord) {
            maxOvershoot = Math.max(maxOvershoot, songTime - pendingChord.time);
        }

        if (r.frozen && player !== "idle") {
            const chord = chords[idx];
            const note =
                player === "perfect"
                    ? chord.notes.find((n) => !pressed.has(n))
                    : "__SALAH__";
            if (note !== undefined) {
                const res = learnPressResult(chord, pressed, note);
                if (res === "partial") pressed.add(note);
                else if (res === "complete") {
                    idx++;
                    pressed = new Set();
                }
            }
        }

        if (idx >= chords.length && songTime >= song.parsed.durationMs) break;
    }

    return { ticks, idx, songTime, maxOvershoot, frozenTicks, chords };
}

console.log("Memeriksa aturan mode learn terhadap lagu nyata\n");

const songs = loadSongs();

for (const song of songs) {
    console.log(`### ${song.id}  (${song.chords.length} akor)`);

    // ── 1. pemain sempurna harus menyelesaikan seluruh lagu ──────────────────
    const perfect = simulate(song, "perfect");
    check(
        `pemain sempurna menyelesaikan semua akor (${perfect.idx}/${song.chords.length})`,
        perfect.idx === song.chords.length,
        `berhenti di akor ${perfect.idx}`,
    );
    check(
        "jam tidak pernah melewati akor yang ditunggu",
        perfect.maxOvershoot <= 0,
        `overshoot maks ${perfect.maxOvershoot.toFixed(2)}ms`,
    );

    // ── 2. tidak menekan apa pun -> macet di akor pertama, selamanya ─────────
    const idle = simulate(song, "idle", 4000);
    check(
        "tanpa ditekan: macet di akor pertama (bar menunggu)",
        idle.idx === 0,
        `maju ke akor ${idle.idx}`,
    );
    check(
        "tanpa ditekan: jam berhenti persis di waktu akor itu",
        Math.abs(idle.songTime - song.chords[0].time) < 1e-9,
        `songTime ${idle.songTime} vs akor ${song.chords[0].time}`,
    );

    // ── 3. tuts salah terus -> juga macet, tidak maju ────────────────────────
    const wrong = simulate(song, "wrong", 4000);
    check(
        "tuts salah terus: tidak pernah maju",
        wrong.idx === 0,
        `maju ke akor ${wrong.idx}`,
    );

    // ── 4. bar pertama punya waktu jatuh, tidak langsung nongkrong ───────────
    const firstStep = learnStep({
        chords: song.chords,
        idx: 0,
        songTime: -LEARN_LEAD_MS,
        leadMs: LEARN_LEAD_MS,
    });
    const firstNote = firstStep.notes.find((n) => n.pending);
    const progress = firstNote
        ? (firstNote.time - firstStep.songTime) / LEARN_LEAD_MS
        : NaN;
    check(
        "bar not pertama mulai dari atas kanvas (progress ~1)",
        !firstStep.frozen && Math.abs(progress - 1) < 1e-9,
        `frozen=${firstStep.frozen} progress=${progress}`,
    );

    // ── 5. akor yang sudah dilewati tidak digambar lagi ──────────────────────
    const mid = Math.min(5, song.chords.length - 1);
    const midStep = learnStep({
        chords: song.chords,
        idx: mid,
        songTime: song.chords[mid].time,
        leadMs: LEARN_LEAD_MS,
    });
    check(
        "tidak ada bar dari akor yang sudah dilewati",
        midStep.notes.every((n) => n.time >= song.chords[mid].time),
        "ada not dengan waktu lebih awal dari akor yang ditunggu",
    );
    check(
        "bar yang terlihat tidak melebihi lead time",
        midStep.notes.every(
            (n) => n.time - midStep.songTime <= LEARN_LEAD_MS + 1e-9,
        ),
    );
    check(
        "tepat satu akor ditandai pending",
        new Set(
            midStep.notes.filter((n) => n.pending).map((n) => n.time),
        ).size === 1,
    );
    // ── 6. pemetaan token ke simbol asli di tab.txt ──────────────────────────
    const tokens = song.parsed.tokens;
    check(
        `token berbunyi 1:1 dengan akor (${tokens.length} vs ${song.chords.length})`,
        tokens.length === song.chords.length,
    );
    check(
        "waktu tiap token sama dengan akor di indeks yang sama",
        tokens.every(
            (t, i) => song.chords[i] && t.time === song.chords[i].time,
        ),
    );
    check(
        "not tiap token sama dengan akor di indeks yang sama",
        tokens.every((t, i) => {
            const c = song.chords[i];
            if (!c || c.notes.length !== t.notes.length) return false;
            return c.notes.every((n) => t.notes.includes(n));
        }),
    );
    check(
        "offset token urut naik dan tidak saling tumpang tindih",
        tokens.every(
            (t, i) => t.end > t.start && (i === 0 || t.start >= tokens[i - 1].end),
        ),
    );

    // Inti pemeriksaan: potong tab.txt ASLI pakai offset token, lalu pastikan
    // karakternya memang membunyikan not yang token itu klaim.
    let sliceBad = 0;
    let firstBad = null;
    for (const t of tokens) {
        const text = song.raw.slice(t.start, t.end);
        // Hanya karakter not yang dihitung; kurung & tanda jeda dilewati.
        const chars = [...text].filter((c) =>
            /[0-9A-Za-z!@#$%^&*()]/.test(c),
        );
        const mapped = chars.map((c) => KEY_MAP[c]);
        const ok =
            chars.length === t.notes.length &&
            mapped.every((m) => m !== undefined && t.notes.includes(m)) &&
            (t.notes.length === 1
                ? !text.includes("[") && !text.includes("{")
                : text.startsWith("[") || text.startsWith("{"));
        if (!ok) {
            sliceBad++;
            if (!firstBad) firstBad = { text, notes: t.notes, at: t.start };
        }
    }
    check(
        "potongan tab.txt di offset token membunyikan not yang sama",
        sliceBad === 0,
        firstBad
            ? `${sliceBad} meleset, contoh offset ${firstBad.at}: ${JSON.stringify(firstBad.text)} mengaku ${JSON.stringify(firstBad.notes)}`
            : "",
    );

    // ── 7. render token harus merekonstruksi tab.txt PERSIS ──────────────────
    // Cerminan algoritma renderSheetTokens di PianoControls: potongan teks di
    // antara token + potongan token, disambung berurutan. Kalau hasilnya tidak
    // identik dengan file aslinya, sheet akan tampil rusak (karakter hilang,
    // dobel, atau tata letaknya bergeser).
    let rebuilt = "";
    let cursor = 0;
    for (const t of tokens) {
        if (t.start > cursor) rebuilt += song.raw.slice(cursor, t.start);
        rebuilt += song.raw.slice(t.start, t.end);
        cursor = t.end;
    }
    if (cursor < song.raw.length) rebuilt += song.raw.slice(cursor);
    check(
        `render token merekonstruksi tab.txt persis (${song.raw.length} karakter)`,
        rebuilt === song.raw,
        rebuilt.length === song.raw.length
            ? "panjang sama tapi isinya beda"
            : `panjang ${rebuilt.length} vs ${song.raw.length}`,
    );

    console.log("");
}

console.log(
    failures === 0
        ? `✓ semua pemeriksaan lolos (${songs.length} lagu)\n`
        : `✗ ${failures} pemeriksaan GAGAL\n`,
);
process.exit(failures === 0 ? 0 : 1);
