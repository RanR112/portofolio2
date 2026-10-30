/**
 * lib/pianoEngine.ts
 *
 * Pure Web Audio engine — no React, no DOM (except AudioContext).
 * Handles: sample loading, pitch shifting, voice management, sustain pedal.
 *
 * Usage:
 *   import { pianoEngine } from "../lib/pianoEngine";
 *   await pianoEngine.loadSamples();   // call once on mount
 *   pianoEngine.setVolume(0.8);
 *   pianoEngine.playNote("C4", 60);    // noteLabel, targetMidi
 *   pianoEngine.stopNote("C4");
 *   pianoEngine.setSustain(false);
 *   pianoEngine.destroy();             // cleanup on unmount
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sample map — @audio-samples/piano-mp3-velocity4
// 30 MP3 files, single velocity layer (v4 = mp).
// Sampled in minor-thirds: C / Ds / Fs / A per octave (# renamed to s).
// key → root MIDI of the recorded sample.
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_MAP: Record<string, number> = {
    A0v4: 21,
    C1v4: 24,
    Ds1v4: 27,
    Fs1v4: 30,
    A1v4: 33,
    C2v4: 36,
    Ds2v4: 39,
    Fs2v4: 42,
    A2v4: 45,
    C3v4: 48,
    Ds3v4: 51,
    Fs3v4: 54,
    A3v4: 57,
    C4v4: 60,
    Ds4v4: 63,
    Fs4v4: 66,
    A4v4: 69,
    C5v4: 72,
    Ds5v4: 75,
    Fs5v4: 78,
    A5v4: 81,
    C6v4: 84,
    Ds6v4: 87,
    Fs6v4: 90,
    A6v4: 93,
    C7v4: 96,
    Ds7v4: 99,
    Fs7v4: 102,
    A7v4: 105,
    C8v4: 108,
};

const SAMPLE_NAMES = Object.keys(SAMPLE_MAP);

// ─────────────────────────────────────────────────────────────────────────────
// Audio timing constants
// ─────────────────────────────────────────────────────────────────────────────

const ATTACK_TIME = 0.006; // seconds — brief ramp-in to avoid click
const NATURAL_DURATION = 10.0; // seconds — envelope ceiling; samples decay naturally
const RELEASE_TIME = 2.0; // seconds — key-up fade when sustain is OFF

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** playbackRate = 2^(semitones/12) */
function semitonesToRate(semitones: number): number {
    return Math.pow(2, semitones / 12);
}

/** Find the sample name whose root MIDI is nearest to targetMidi. */
function nearestSample(targetMidi: number): string {
    let best = SAMPLE_NAMES[0];
    let bestDist = Infinity;
    for (const name of SAMPLE_NAMES) {
        const dist = Math.abs(SAMPLE_MAP[name] - targetMidi);
        if (dist < bestDist) {
            bestDist = dist;
            best = name;
        }
    }
    return best;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveVoice {
    source: AudioBufferSourceNode;
    gain: GainNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// PianoEngine class
// ─────────────────────────────────────────────────────────────────────────────

class PianoEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private ctxReady = false;

    private buffers = new Map<string, AudioBuffer>();
    private activeVoices = new Map<string, ActiveVoice>();
    private sustainedKeys = new Set<string>();

    private _samplesReady = false;
    private _sustain = true;
    /**
     * Nilai sustain dari toggle UI. Dipisah dari _sustain karena selama lagu
     * ber-timing dimainkan, pedal dikendalikan lagu (lihat _sustainOverride).
     */
    private _sustainInput = true;
    /**
     * null  = tidak ada yang menimpa → pakai _sustainInput (perilaku biasa)
     * true  = pedal diinjak paksa (lagu MIDI tanpa CC64)
     * false = pedal dilepas paksa (lagu MIDI dengan CC64, sebelum event pertama)
     */
    private _sustainOverride: boolean | null = null;
    private _volume = 0.75; // 0–1

    private _loading: Promise<void> | null = null;

    /** True once all 30 samples have finished decoding. */
    get samplesReady(): boolean {
        return this._samplesReady;
    }

    /**
     * True saat pedal sedang dikendalikan lagu. UI memakainya untuk menandai
     * tombol sustain "auto" dan mengabaikan Space, supaya user tidak mengubah
     * toggle yang memang tidak berpengaruh selama lagu berjalan.
     */
    get sustainLocked(): boolean {
        return this._sustainOverride !== null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initialise AudioContext on first user gesture.
    // Safe to call multiple times — only creates context once.
    // ─────────────────────────────────────────────────────────────────────────

    initAudio(): void {
        if (this.ctxReady) {
            this.ctx?.resume();
            return;
        }
        const AudioCtx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;

        const ctx = new AudioCtx();
        const mg = ctx.createGain();
        mg.gain.setValueAtTime(this._volume, ctx.currentTime);
        mg.connect(ctx.destination);

        this.ctx = ctx;
        this.masterGain = mg;
        this.ctxReady = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Load all 30 MP3 samples in parallel.
    // Idempotent — safe to call from multiple components on different pages.
    // Returns the same Promise if already loading; resolves immediately if done.
    // Files: /public/piano/{name}.mp3  (30 files, '#' renamed to 's' in filename)
    //   e.g. /piano/C4v4.mp3, /piano/Ds2v4.mp3, /piano/Fs3v4.mp3
    // ─────────────────────────────────────────────────────────────────────────

    async loadSamples(): Promise<void> {
        if (this._samplesReady) return; // already loaded
        if (this._loading) return this._loading; // already in progress

        const AudioCtx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
        const decodeCtx = this.ctx ?? new AudioCtx();

        this._loading = Promise.all(
            SAMPLE_NAMES.map(async (name) => {
                try {
                    const resp = await fetch(`/audio/piano/${name}.mp3`);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const raw = await resp.arrayBuffer();
                    const buffer = await decodeCtx.decodeAudioData(raw);
                    this.buffers.set(name, buffer);
                } catch (err) {
                    console.warn(
                        `[pianoEngine] Could not load ${name}.mp3:`,
                        err,
                    );
                }
            }),
        ).then(() => {
            this._samplesReady = this.buffers.size > 0;
            this._loading = null;
        });

        return this._loading;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Volume — 0–1 float
    // ─────────────────────────────────────────────────────────────────────────

    setVolume(value: number): void {
        this._volume = Math.max(0, Math.min(1, value));
        const ctx = this.ctx;
        const mg = this.masterGain;
        if (!ctx || !mg) return;
        mg.gain.setTargetAtTime(this._volume, ctx.currentTime, 0.02);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Sustain pedal
    // ─────────────────────────────────────────────────────────────────────────

    setSustain(on: boolean): void {
        this._sustainInput = on;
        this._applySustain();
    }

    /**
     * Pedal yang dikendalikan lagu (autoplay timing). Tidak mengubah toggle UI:
     * setelah lagu berhenti, pemanggil mengembalikan null dan pedal kembali
     * mengikuti toggle user.
     */
    setSustainOverride(on: boolean | null): void {
        this._sustainOverride = on;
        this._applySustain();
    }

    private _applySustain(): void {
        const effective = this._sustainOverride ?? this._sustainInput;
        const wasOn = this._sustain;
        this._sustain = effective;
        if (!effective && wasOn) {
            this.sustainedKeys.forEach((label) => this._quickRelease(label));
            this.sustainedKeys.clear();
        }
    }

    /**
     * Hentikan SEMUA suara, tanpa peduli sustain. Dipakai saat lagu di-pause,
     * di-stop, atau selesai: kalau hanya stopNote(), pedal yang sedang diinjak
     * akan menahan not terakhir tetap berbunyi setelah lagunya berhenti.
     *
     * `fadeSec` bisa diperpendek untuk seek: posisi lama harus hilang nyaris
     * seketika supaya tidak menumpuk dengan not dari posisi baru, tapi tetap
     * tanpa klik. Pemanggil lama tidak berubah (default = release normal).
     */
    allNotesOff(fadeSec: number = RELEASE_TIME): void {
        const fade = Math.max(0.02, fadeSec);
        for (const label of [...this.activeVoices.keys()]) {
            this._quickRelease(label, fade);
        }
        this.sustainedKeys.clear();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Play a note.
    // noteLabel — used as voice key for retrigger/stop (e.g. "C4")
    // targetMidi — the actual MIDI pitch to play (after transpose)
    // offsetSec — mulai dari tengah sampel (dipakai seek untuk not panjang).
    //             Dalam detik WAKTU LAGU, bukan detik buffer: playbackRate
    //             mengubah berapa detik buffer yang sudah terpakai.
    // ─────────────────────────────────────────────────────────────────────────

    playNote(noteLabel: string, targetMidi: number, offsetSec = 0): void {
        this.initAudio();
        const ctx = this.ctx!;
        const mg = this.masterGain!;

        if (ctx.state === "suspended") ctx.resume();
        if (!this._samplesReady) return;

        // Find nearest recorded sample
        const sampleName = nearestSample(targetMidi);
        const buffer = this.buffers.get(sampleName);
        if (!buffer) return;

        const semitones = targetMidi - SAMPLE_MAP[sampleName];
        const rate = semitonesToRate(semitones);
        const offset = Math.max(0, offsetSec);

        // Detik buffer yang sudah terpakai = detik lagu × rate.
        const bufferOffset = offset * rate;
        if (bufferOffset >= buffer.duration) return; // sampelnya sudah habis

        // Retrigger cleanly. Saat seek (offset > 0) nada lama bisa jadi masih
        // dalam fade dari allNotesOff(); hentikan dengan fade 10 ms supaya
        // transisi ke posisi baru tidak berklik.
        if (offset > 0) this._quickRelease(noteLabel, 0.01);
        else this._hardStop(noteLabel);
        this.sustainedKeys.delete(noteLabel);

        // Build voice: source → noteGain → masterGain → destination
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();

        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.loop = false;

        // Envelope — brief attack, then natural sample decay. Kalau mulai dari
        // tengah not, attack dilewati dan gain dimulai dari level decay yang
        // kira-kira setara supaya tidak ada "serangan" baru di titik seek.
        const now = ctx.currentTime;
        if (offset > 0) {
            const level = Math.pow(0.0001, Math.min(offset, NATURAL_DURATION) / NATURAL_DURATION);
            const remaining = NATURAL_DURATION - offset;
            gain.gain.setValueAtTime(Math.max(level, 0.0001), now);
            if (remaining > 0.05) {
                gain.gain.exponentialRampToValueAtTime(0.0001, now + remaining);
            }
        } else {
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(1.0, now + ATTACK_TIME);
            gain.gain.setValueAtTime(1.0, now + ATTACK_TIME);
            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                now + NATURAL_DURATION,
            );
        }

        source.connect(gain);
        gain.connect(mg);
        source.start(now, bufferOffset);

        this.activeVoices.set(noteLabel, { source, gain });
        source.onended = () => {
            // Voice lama bisa selesai SETELAH label yang sama dipakai lagi
            // (retrigger/seek). Tanpa cek identitas, onended-nya akan menghapus
            // voice baru dari peta dan not itu tidak bisa di-release lagi —
            // persis jenis nada nyangkut yang ingin dihindari setelah seek.
            if (this.activeVoices.get(noteLabel)?.source !== source) return;
            this.activeVoices.delete(noteLabel);
            this.sustainedKeys.delete(noteLabel);
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Stop a note — honours sustain pedal
    // ─────────────────────────────────────────────────────────────────────────

    stopNote(noteLabel: string): void {
        if (this._sustain) {
            if (this.activeVoices.has(noteLabel)) {
                this.sustainedKeys.add(noteLabel);
            }
            return;
        }
        this._quickRelease(noteLabel);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: fade out and stop a voice
    // ─────────────────────────────────────────────────────────────────────────

    private _quickRelease(
        noteLabel: string,
        fadeSec: number = RELEASE_TIME,
    ): void {
        const ctx = this.ctx;
        const voice = this.activeVoices.get(noteLabel);
        if (!ctx || !voice) return;

        const t = ctx.currentTime;
        const fade = Math.max(0.02, fadeSec);
        const gp = voice.gain.gain;
        gp.cancelScheduledValues(t);
        gp.setValueAtTime(Math.max(gp.value, 0.0001), t);
        gp.exponentialRampToValueAtTime(0.0001, t + fade);

        try {
            voice.source.stop(t + fade + 0.05);
        } catch (_) {
            /* already ended */
        }

        this.activeVoices.delete(noteLabel);
        this.sustainedKeys.delete(noteLabel);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal: immediate hard stop (used for retrigger)
    // ─────────────────────────────────────────────────────────────────────────

    private _hardStop(noteLabel: string): void {
        const voice = this.activeVoices.get(noteLabel);
        if (!voice) return;
        try {
            voice.source.stop();
        } catch (_) {
            /* already ended */
        }
        this.activeVoices.delete(noteLabel);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cleanup — call on component unmount
    // ─────────────────────────────────────────────────────────────────────────

    destroy(): void {
        this.activeVoices.forEach((_, label) => this._hardStop(label));
        this.activeVoices.clear();
        this.sustainedKeys.clear();
        this._sustainOverride = null;
        this._sustainInput = true;
        this._sustain = true;
        this.ctx?.close();
        this.ctx = null;
        this.masterGain = null;
        this.ctxReady = false;
        this._samplesReady = false;
        this._loading = null;
        this.buffers.clear();
    }
}

// Singleton — one engine instance shared across the app
export const pianoEngine = new PianoEngine();
