// hooks/usePianoAudio.ts
//
// Plays piano notes using the shared pianoEngine sample library
// (the same MP3 samples used by the main keyboard).
//
// Drop-in replacement for the oscillator version — API is identical:
//   const { playNote } = usePianoAudio();
//   playNote("C4");   // plays the real piano sample
//
// Self-contained: loads samples on first mount if not already loaded.
// Safe to use on any page — pianoEngine.loadSamples() is idempotent.

import { useEffect, useCallback } from "react";
import { pianoEngine } from "@/lib/pianoEngine";

// ─────────────────────────────────────────────────────────────────────────────
// Note → MIDI map (equal temperament, same names as the original hook)
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_MIDI: Record<string, number> = {
    C4: 60,
    Cs4: 61, // C#4
    D4: 62,
    Ds4: 63, // D#4
    E4: 64,
    F4: 65,
    Fs4: 66, // F#4
    G4: 67,
    Gs4: 68, // G#4
    A4: 69,
    As4: 70, // A#4
    B4: 71,
    C5: 72,
    D5: 74
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePianoAudio() {
    // Load samples on first mount if not already loaded.
    // pianoEngine.loadSamples() is idempotent — safe to call multiple times
    // from multiple components; it checks internally if already loaded.
    useEffect(() => {
        if (!pianoEngine.samplesReady) {
            pianoEngine.loadSamples();
        }
    }, []);

    const playNote = useCallback((note: string) => {
        const midi = NOTE_MIDI[note];
        if (midi === undefined) {
            console.warn(`[usePianoAudio] Unknown note: "${note}"`);
            return;
        }
        // Use note name as voice key so rapid retriggers don't stack
        pianoEngine.playNote(note, midi);
    }, []);

    return { playNote };
}
