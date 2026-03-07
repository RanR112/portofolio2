// hooks/usePianoAudio.ts
//
// Synthesizes a piano-like tone using the Web Audio API.
// No external library. Uses a triangle oscillator with an ADSR-style
// amplitude envelope to approximate the attack/decay of a real piano key.
//
// Why triangle wave:
//   Sine = too pure/hollow. Sawtooth = too harsh. Triangle sits between
//   them — warm, slightly complex, readable as a pitched instrument.
//
// Why no OscillatorNode.type = 'custom':
//   A PeriodicWave would be more accurate but adds complexity.
//   Triangle + subtle detuning gives a convincing result for UI feedback.

import { useRef, useCallback } from "react";

// Frequency map — equal temperament, full chromatic octave C4–C5
// White keys: C D E F G A B C
// Black keys: C# D# F# G# A#
const NOTE_FREQUENCIES: Record<string, number> = {
    C4: 261.63,
    Cs4: 277.18, // C#4
    D4: 293.66,
    Ds4: 311.13, // D#4
    E4: 329.63,
    F4: 349.23,
    Fs4: 369.99, // F#4
    G4: 392.0,
    Gs4: 415.3, // G#4
    A4: 440.0,
    As4: 466.16, // A#4
    B4: 493.88,
    C5: 523.25,
};

// Envelope shape — tuned to feel like a soft piano key, not a synth blip
const ENVELOPE = {
    attackTime: 0.008, // seconds — fast but not instant (avoids click artifact)
    peakGain: 0.35, // 0–1 — soft volume, sidebar feedback not a performance
    decayTime: 1.2, // seconds — natural piano decay
    releaseGain: 0.001, // near-zero target for exponentialRampToValueAtTime
};

export function usePianoAudio() {
    // AudioContext is lazily initialized on first user interaction.
    // Browsers block AudioContext creation until a user gesture has occurred.
    const ctxRef = useRef<AudioContext | null>(null);

    const getContext = useCallback((): AudioContext => {
        if (!ctxRef.current) {
            ctxRef.current = new (
                window.AudioContext || (window as any).webkitAudioContext
            )();
        }
        // Resume if suspended (browser autoplay policy can suspend it)
        if (ctxRef.current.state === "suspended") {
            ctxRef.current.resume();
        }
        return ctxRef.current;
    }, []);

    const playNote = useCallback(
        (note: string) => {
            const freq = NOTE_FREQUENCIES[note];
            if (!freq) {
                console.warn(`[usePianoAudio] Unknown note: "${note}"`);
                return;
            }

            const ctx = getContext();
            const now = ctx.currentTime;

            // --- Oscillator ---
            const oscillator = ctx.createOscillator();
            oscillator.type = "triangle";

            // Primary frequency
            oscillator.frequency.setValueAtTime(freq, now);

            // Subtle detuning at onset — real piano strings vibrate slightly
            // sharp at the moment of strike, then settle to pitch
            oscillator.frequency.setValueAtTime(freq * 1.002, now + 0.005);
            oscillator.frequency.linearRampToValueAtTime(freq, now + 0.05);

            // --- Gain (amplitude envelope) ---
            const gainNode = ctx.createGain();
            gainNode.gain.setValueAtTime(0, now);

            // Attack — linear ramp from 0 to peak
            gainNode.gain.linearRampToValueAtTime(
                ENVELOPE.peakGain,
                now + ENVELOPE.attackTime,
            );

            // Decay — exponential falloff mimics natural string/hammer decay
            gainNode.gain.exponentialRampToValueAtTime(
                ENVELOPE.releaseGain,
                now + ENVELOPE.decayTime,
            );

            // --- Signal chain: oscillator → gain → output ---
            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Start and schedule auto-stop after decay completes
            oscillator.start(now);
            oscillator.stop(now + ENVELOPE.decayTime);

            // Clean up nodes after they've finished to avoid memory accumulation
            oscillator.onended = () => {
                oscillator.disconnect();
                gainNode.disconnect();
            };
        },
        [getContext],
    );

    return { playNote };
}
