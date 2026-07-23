// ─────────────────────────────────────────────────────────────────────────────
// keyMap.ts — keyboard→note mapping and note data. No React.
// ─────────────────────────────────────────────────────────────────────────────

export const NOTE_NAMES = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

export interface NoteData {
    note: string;
    octave: number;
    label: string;
    midi: number;
    isBlack: boolean;
}

/** Build a chromatic note table for an inclusive MIDI range. */
function buildNotes(minMidi: number, maxMidi: number): NoteData[] {
    const notes: NoteData[] = [];
    for (let midi = minMidi; midi <= maxMidi; midi++) {
        const i = midi % 12; // 0 = C … 11 = B
        const note = NOTE_NAMES[i];
        const octave = Math.floor(midi / 12) - 1;
        notes.push({
            note,
            octave,
            label: `${note}${octave}`,
            midi,
            isBlack: note.includes("#"),
        });
    }
    return notes;
}

/** Keyboard size mode: 61 keys (C2–C7) or full 88 keys (A0–C8). */
export type KeyMode = 61 | 88;

const MODE_RANGE: Record<KeyMode, [number, number]> = {
    61: [36, 96], // C2–C7
    88: [21, 108], // A0–C8
};

// Full 88-key note table — used for label→MIDI lookups regardless of mode.
const NOTES_88 = buildNotes(21, 108);
export const MIDI_BY_LABEL: Record<string, number> = {};
NOTES_88.forEach((n) => {
    MIDI_BY_LABEL[n.label] = n.midi;
});

// ─────────────────────────────────────────────────────────────────────────────
// Ctrl-combo mappings for the extended keys that exist ONLY in 88-key mode.
// Keyed by KeyboardEvent.code (layout-independent). Ctrl takes priority over
// Shift. These only take effect while Keyboard Lock is active (Chromium +
// fullscreen), otherwise Ctrl+W/Ctrl+T/etc. remain browser shortcuts.
//   Low  A0–B1  → ctrl+1 … ctrl+t
//   High C#7–C8 → ctrl+y … ctrl+j
// ─────────────────────────────────────────────────────────────────────────────
export const CTRL_CODE_MAP: Record<string, string> = {
    Digit1: "A0",
    Digit2: "A#0",
    Digit3: "B0",
    Digit4: "C1",
    Digit5: "C#1",
    Digit6: "D1",
    Digit7: "D#1",
    Digit8: "E1",
    Digit9: "F1",
    Digit0: "F#1",
    KeyQ: "G1",
    KeyW: "G#1",
    KeyE: "A1",
    KeyR: "A#1",
    KeyT: "B1",
    KeyY: "C#7",
    KeyU: "D7",
    KeyI: "D#7",
    KeyO: "E7",
    KeyP: "F7",
    KeyA: "F#7",
    KeyS: "G7",
    KeyD: "G#7",
    KeyF: "A7",
    KeyG: "A#7",
    KeyH: "B7",
    KeyJ: "C8",
};

/** Physical key codes handed to the Keyboard Lock API. */
export const LOCK_KEYS = Object.keys(CTRL_CODE_MAP);

/** "Digit1" → "1", "KeyQ" → "q". */
function ctrlCharFromCode(code: string): string {
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Key")) return code.slice(3).toLowerCase();
    return code;
}

// note label → single hint character for keys reachable via Ctrl (rendered underlined)
export const CTRL_CHAR_BY_LABEL: Record<string, string> = {};
Object.entries(CTRL_CODE_MAP).forEach(([code, label]) => {
    CTRL_CHAR_BY_LABEL[label] = ctrlCharFromCode(code);
});

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard layout builder — resolves the rendered white/black keys for a mode.
// ─────────────────────────────────────────────────────────────────────────────

export interface KeyDescriptor {
    noteLabel: string;
    keyLabels: string; // base char(s) e.g. "t/R", or single ctrl char e.g. "1"
    underline: boolean; // true → reachable via Ctrl in 88 mode (render underlined)
    noteDisplay: string;
    isBlack: boolean;
    isFirst?: boolean;
    leftWhite?: string;
    wIdx?: number; // index of the left-adjacent white key within this mode's row
}

export interface KeyboardLayout {
    whiteCount: number;
    whiteKeys: KeyDescriptor[];
    blackKeys: KeyDescriptor[];
}

export function buildKeyboard(mode: KeyMode): KeyboardLayout {
    const [min, max] = MODE_RANGE[mode];
    const notes = buildNotes(min, max);

    const whiteNotes = notes.filter((n) => !n.isBlack);
    const whiteIdx: Record<string, number> = {};
    whiteNotes.forEach((n, i) => {
        whiteIdx[n.label] = i;
    });

    const resolveLabels = (
        label: string,
        isBlack: boolean,
    ): { keyLabels: string; underline: boolean } => {
        // Ctrl-reachable extended keys: single underlined hint character.
        const ctrlChar = CTRL_CHAR_BY_LABEL[label];
        if (ctrlChar) return { keyLabels: ctrlChar, underline: true };

        const keys = NOTE_TO_KEYS[label] ?? [];
        // White keys: show only the plain (non-shift) key — the first entry.
        // Black keys: show their shift-accessed key(s) as before.
        const keyLabels = isBlack
            ? keys.slice(0, 2).join("/")
            : (keys[0] ?? "");
        return { keyLabels, underline: false };
    };

    const whiteKeys: KeyDescriptor[] = whiteNotes.map((n, idx) => {
        const { keyLabels, underline } = resolveLabels(n.label, false);
        return {
            noteLabel: n.label,
            keyLabels,
            underline,
            noteDisplay: n.label,
            isBlack: false,
            isFirst: idx === 0,
        };
    });

    const leftWhiteLabel = (note: NoteData): string => {
        const noteIdx = NOTE_NAMES.indexOf(note.note as NoteName);
        const prevName = NOTE_NAMES[(noteIdx - 1 + 12) % 12];
        const candidate = `${prevName}${note.octave}`;
        return whiteIdx[candidate] !== undefined ? candidate : "";
    };

    const blackKeys: KeyDescriptor[] = notes
        .filter((n) => n.isBlack)
        .map((n) => {
            const lw = leftWhiteLabel(n);
            const { keyLabels, underline } = resolveLabels(n.label, true);
            return {
                noteLabel: n.label,
                keyLabels,
                underline,
                noteDisplay: n.note,
                isBlack: true,
                leftWhite: lw,
                wIdx: whiteIdx[lw],
            };
        })
        .filter((b) => b.leftWhite !== "");

    return { whiteCount: whiteNotes.length, whiteKeys, blackKeys };
}

/** keyboard character → note label */
export const KEY_MAP: Record<string, string> = {
    // Natural row 1 (numbers)
    "1": "C2",
    "2": "D2",
    "3": "E2",
    "4": "F2",
    "5": "G2",
    "6": "A2",
    "7": "B2",
    "8": "C3",
    "9": "D3",
    "0": "E3",
    // Natural row 2 (qwerty top)
    q: "F3",
    w: "G3",
    e: "A3",
    r: "B3",
    t: "C4",
    y: "D4",
    u: "E4",
    i: "F4",
    o: "G4",
    p: "A4",
    // Natural row 3 (home row)
    a: "B4",
    s: "C5",
    d: "D5",
    f: "E5",
    g: "F5",
    h: "G5",
    j: "A5",
    k: "B5",
    l: "C6",
    // Natural row 4 (bottom row)
    z: "D6",
    x: "E6",
    c: "F6",
    v: "G6",
    b: "A6",
    n: "B6",
    m: "C7",
    // Sharps — shifted symbols
    "!": "C#2",
    "@": "D#2",
    "#": "F2",
    $: "F#2",
    "%": "G#2",
    "^": "A#2",
    "&": "C3",
    "*": "C#3",
    "(": "D#3",
    ")": "F3",
    Q: "F#3",
    W: "G#3",
    E: "A#3",
    R: "C4",
    T: "C#4",
    Y: "D#4",
    U: "F4",
    I: "F#4",
    O: "G#4",
    P: "A#4",
    A: "C5",
    S: "C#5",
    D: "D#5",
    F: "F5",
    G: "F#5",
    H: "G#5",
    J: "A#5",
    K: "C6",
    L: "C#6",
    Z: "D#6",
    X: "F6",
    C: "F#6",
    V: "G#6",
    B: "A#6",
    N: "C7",
    // C#7 is reachable via Ctrl+Y in 88-key mode (see CTRL_CODE_MAP), so the
    // old Shift+M → C#7 base mapping is removed.
};

/** note label → array of keyboard characters that trigger it */
export const NOTE_TO_KEYS: Record<string, string[]> = {};
Object.entries(KEY_MAP).forEach(([k, note]) => {
    if (!NOTE_TO_KEYS[note]) NOTE_TO_KEYS[note] = [];
    NOTE_TO_KEYS[note].push(k);
});

export const ARROW_CODES = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
]);

/**
 * Resolve a KeyboardEvent to a note label, or null.
 *
 * Priority: Ctrl > Shift > plain. When Ctrl is held we ignore Shift entirely
 * (so Ctrl+Shift+W still resolves via the Ctrl map). The Ctrl map only applies
 * when `allowCtrl` is true — i.e. Keyboard Lock is active — otherwise Ctrl
 * combos are left to the browser to avoid closing the tab, opening a new tab, …
 */
export function resolveKeyToNote(
    e: KeyboardEvent,
    allowCtrl: boolean,
): string | null {
    if (e.ctrlKey) {
        if (!allowCtrl) return null;
        return CTRL_CODE_MAP[e.code] ?? null;
    }
    const shiftedKey = e.shiftKey ? e.key : null;
    const plainKey =
        e.key.toLowerCase() === e.key ? e.key : e.key.toLowerCase();
    return shiftedKey && KEY_MAP[shiftedKey]
        ? KEY_MAP[shiftedKey]
        : (KEY_MAP[e.key] ?? KEY_MAP[plainKey] ?? null);
}

export const BAR_COLORS = [
    { label: "Orange", value: "#f0a63a" },
    { label: "White", value: "#ffffff" },
    { label: "Cyan", value: "#00e5ff" },
    { label: "Red", value: "#ff3d6b" },
    { label: "Yellow", value: "#ffd740" },
    { label: "Blue", value: "#40a0ff" },
    { label: "Green", value: "#69f0ae" },
    { label: "Purple", value: "#b388ff" },
];

// Tambahkan di bawah BAR_COLORS
export const KEY_GRADIENTS: Record<string, { white: string; black: string }> = {
    "#f0a63a": {
        // Orange (Default)
        white: "linear-gradient(180deg, #e6d2ad 0%, #d6b982 50%, #c9a86c 100%)",
        black: "linear-gradient(180deg, #c9a86c 0%, #a88447 60%, #7a5f2f 100%)",
    },
    "#ffffff": {
        // White
        white: "linear-gradient(180deg, #ffffff 0%, #e6e6e6 50%, #cccccc 100%)",
        black: "linear-gradient(180deg, #cccccc 0%, #999999 60%, #666666 100%)",
    },
    "#00e5ff": {
        // Cyan
        white: "linear-gradient(180deg, #ccfaff 0%, #66efff 50%, #00e5ff 100%)",
        black: "linear-gradient(180deg, #00e5ff 0%, #00b8cc 60%, #008999 100%)",
    },
    "#ff3d6b": {
        // Red
        white: "linear-gradient(180deg, #ffc2d1 0%, #ff7f9d 50%, #ff3d6b 100%)",
        black: "linear-gradient(180deg, #ff3d6b 0%, #cc3156 60%, #992540 100%)",
    },
    "#ffd740": {
        // Yellow
        white: "linear-gradient(180deg, #fff5cc 0%, #ffe68c 50%, #ffd740 100%)",
        black: "linear-gradient(180deg, #ffd740 0%, #ccac33 60%, #998126 100%)",
    },
    "#40a0ff": {
        // Blue
        white: "linear-gradient(180deg, #cce4ff 0%, #88c2ff 50%, #40a0ff 100%)",
        black: "linear-gradient(180deg, #40a0ff 0%, #3380cc 60%, #266099 100%)",
    },
    "#69f0ae": {
        // Green
        white: "linear-gradient(180deg, #d2fae6 0%, #9df5c8 50%, #69f0ae 100%)",
        black: "linear-gradient(180deg, #69f0ae 0%, #54c08b 60%, #3f9068 100%)",
    },
    "#b388ff": {
        // Purple
        white: "linear-gradient(180deg, #e7d6ff 0%, #cdb0ff 50%, #b388ff 100%)",
        black: "linear-gradient(180deg, #b388ff 0%, #8f6ccc 60%, #6b5199 100%)",
    },
};
