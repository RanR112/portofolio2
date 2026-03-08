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
const NATURAL_DURATION = 5.0; // seconds — envelope ceiling; samples decay naturally
const RELEASE_TIME = 0.4; // seconds — key-up fade when sustain is OFF

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
    private _volume = 0.75; // 0–1

    private _loading: Promise<void> | null = null;

    /** True once all 30 samples have finished decoding. */
    get samplesReady(): boolean {
        return this._samplesReady;
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
        this._sustain = on;
        if (!on) {
            this.sustainedKeys.forEach((label) => this._quickRelease(label));
            this.sustainedKeys.clear();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Play a note.
    // noteLabel — used as voice key for retrigger/stop (e.g. "C4")
    // targetMidi — the actual MIDI pitch to play (after transpose)
    // ─────────────────────────────────────────────────────────────────────────

    playNote(noteLabel: string, targetMidi: number): void {
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

        // Retrigger cleanly
        this._hardStop(noteLabel);
        this.sustainedKeys.delete(noteLabel);

        // Build voice: source → noteGain → masterGain → destination
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();

        source.buffer = buffer;
        source.playbackRate.value = rate;
        source.loop = false;

        // Envelope — brief attack, then natural sample decay
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1.0, now + ATTACK_TIME);
        gain.gain.setValueAtTime(1.0, now + ATTACK_TIME);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + NATURAL_DURATION);

        source.connect(gain);
        gain.connect(mg);
        source.start(now);

        this.activeVoices.set(noteLabel, { source, gain });
        source.onended = () => {
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

    private _quickRelease(noteLabel: string): void {
        const ctx = this.ctx;
        const voice = this.activeVoices.get(noteLabel);
        if (!ctx || !voice) return;

        const t = ctx.currentTime;
        const gp = voice.gain.gain;
        gp.cancelScheduledValues(t);
        gp.setValueAtTime(Math.max(gp.value, 0.0001), t);
        gp.exponentialRampToValueAtTime(0.0001, t + RELEASE_TIME);

        try {
            voice.source.stop(t + RELEASE_TIME + 0.02);
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
