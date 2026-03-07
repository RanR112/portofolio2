/**
 * lib/pianoEngine.ts
 *
 * Pure audio engine — zero React, zero DOM, zero side-effects outside Web Audio.
 *
 * Architecture
 * ─────────────
 * • Single AudioContext shared for the entire session.
 * • One master GainNode that controls global volume.
 * • Per-note GainNode chain: noteGain → masterGain → destination.
 *   This lets us fade each note independently without touching the master.
 * • Oscillator nodes are lightweight and created per-press; they are
 *   garbage-collected automatically after osc.onended fires.
 * • Sustain is implemented with a "sustainedKeys" Set — released keys stay
 *   alive until the pedal is lifted, then quick-released together.
 * • Volume balance curve: low notes are boosted slightly, high notes are
 *   attenuated, producing a natural, even keyboard response.
 *
 * Public API
 * ─────────────
 *   init()               — call once on first user interaction
 *   playNote(label)      — start a note
 *   stopNote(label)      — release a note (respects sustain)
 *   setVolume(0–100)     — master volume
 *   setTranspose(−12…12) — semitone shift
 *   setSustain(bool)     — pedal on/off
 *   destroy()            — teardown (unmount)
 */

import { ALL_NOTES } from "./keyMap";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const NATURAL_DECAY = 3.0; // seconds — note decays naturally after press
const RELEASE_TIME = 0.35; // seconds — quick-release when sustain is off
const ATTACK_TIME = 0.006; // seconds
const DECAY_TIME = 0.12; // seconds

// Volume balance curve: C2 (midi 36) → ×1.10, C7 (midi 96) → ×0.75
const BAL_MIN = 36;
const BAL_MAX = 96;
const BAL_TOP = 1.1;
const BAL_SPAN = 0.35; // top − bottom

// ─────────────────────────────────────────────────────────────────────────────
// Internal types
// ─────────────────────────────────────────────────────────────────────────────

interface ActiveNote {
    osc: OscillatorNode;
    gain: GainNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (no closures, no allocations beyond arithmetic)
// ─────────────────────────────────────────────────────────────────────────────

function midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Smooth gain multiplier: 1.10 at C2, 0.75 at C7 */
function balancedGain(midi: number, base: number): number {
    const norm =
        (Math.max(BAL_MIN, Math.min(BAL_MAX, midi)) - BAL_MIN) /
        (BAL_MAX - BAL_MIN);
    return base * (BAL_TOP - norm * BAL_SPAN);
}

// ─────────────────────────────────────────────────────────────────────────────
// Engine class
// ─────────────────────────────────────────────────────────────────────────────

class PianoEngine {
    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;

    // noteLabel → live oscillator+gain pair
    private activeNotes = new Map<string, ActiveNote>();
    // keys held while sustain is on but physical key already released
    private sustainedKeys = new Set<string>();

    private volume = 0.75; // 0–1
    private transpose = 0; // semitones
    private sustain = true; // default ON (matches original behaviour)
    private ready = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** Must be called from a user-gesture handler (click / keydown). */
    init(): void {
        if (this.ready) {
            // Already initialised — just un-suspend if the browser paused us
            this.ctx?.resume();
            return;
        }

        const AudioCtx =
            window.AudioContext ??
            (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;

        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.ready = true;
    }

    destroy(): void {
        this.activeNotes.forEach((_, label) => this._hardStop(label));
        this.activeNotes.clear();
        this.sustainedKeys.clear();
        this.ctx?.close();
        this.ctx = null;
        this.masterGain = null;
        this.ready = false;
    }

    // ── Note playback ─────────────────────────────────────────────────────────

    playNote(noteLabel: string): void {
        if (!this.ready) this.init();
        const ctx = this.ctx!;
        const mg = this.masterGain!;

        // Resume if browser suspended the context
        if (ctx.state === "suspended") ctx.resume();

        const nd = ALL_NOTES.find((n) => n.label === noteLabel);
        if (!nd) return;

        const freq = midiToFreq(nd.midi + this.transpose);

        // Retrigger: stop any existing voice for this note cleanly
        this._hardStop(noteLabel);
        this.sustainedKeys.delete(noteLabel);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        // Envelope with per-note volume balance
        const peak = balancedGain(nd.midi, 0.75);
        const sustLvl = balancedGain(nd.midi, 0.35);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + ATTACK_TIME);
        gain.gain.exponentialRampToValueAtTime(
            sustLvl,
            ctx.currentTime + DECAY_TIME,
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            ctx.currentTime + NATURAL_DECAY,
        );

        osc.connect(gain);
        gain.connect(mg);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + NATURAL_DECAY + 0.05);

        this.activeNotes.set(noteLabel, { osc, gain });

        osc.onended = () => {
            this.activeNotes.delete(noteLabel);
            this.sustainedKeys.delete(noteLabel);
        };
    }

    stopNote(noteLabel: string): void {
        if (this.sustain) {
            // Pedal held — keep the voice alive, track it so we can release later
            if (this.activeNotes.has(noteLabel)) {
                this.sustainedKeys.add(noteLabel);
            }
            return;
        }
        this._quickRelease(noteLabel);
    }

    // ── Controls ──────────────────────────────────────────────────────────────

    setVolume(v: number): void {
        this.volume = Math.max(0, Math.min(100, v)) / 100;
        const ctx = this.ctx;
        const mg = this.masterGain;
        if (!ctx || !mg) return;
        // Smooth ramp to avoid clicks
        mg.gain.setTargetAtTime(this.volume, ctx.currentTime, 0.02);
    }

    setTranspose(semitones: number): void {
        this.transpose = Math.max(-12, Math.min(12, semitones));
        // Active notes keep their original pitch — transpose applies to new presses
    }

    setSustain(on: boolean): void {
        this.sustain = on;
        if (!on) {
            // Pedal released — quick-release every note that was held by sustain
            this.sustainedKeys.forEach((label) => this._quickRelease(label));
            this.sustainedKeys.clear();
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Fade out and stop a note voice. Safe to call when voice doesn't exist. */
    private _quickRelease(noteLabel: string): void {
        const ctx = this.ctx;
        const note = this.activeNotes.get(noteLabel);
        if (!ctx || !note) return;

        const t = ctx.currentTime;
        const gp = note.gain.gain;
        gp.cancelScheduledValues(t);
        gp.setValueAtTime(Math.max(gp.value, 0.0001), t);
        gp.exponentialRampToValueAtTime(0.0001, t + RELEASE_TIME);

        try {
            note.osc.stop(t + RELEASE_TIME + 0.02);
        } catch (_) {
            /* already stopped */
        }

        this.activeNotes.delete(noteLabel);
        this.sustainedKeys.delete(noteLabel);
    }

    /** Immediately silence a note with no fade (used on retrigger). */
    private _hardStop(noteLabel: string): void {
        const note = this.activeNotes.get(noteLabel);
        if (!note) return;
        try {
            note.osc.stop();
        } catch (_) {
            /* already stopped */
        }
        this.activeNotes.delete(noteLabel);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton export
//
// A module-level singleton means:
//  • Only one AudioContext is ever created (browser limit: 6 concurrent).
//  • The engine survives React fast-refresh in development without leaking.
//  • No React context or provider needed.
// ─────────────────────────────────────────────────────────────────────────────

export const pianoEngine = new PianoEngine();
export type { PianoEngine };
