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

/** All notes C2–C7 in chromatic order */
export const ALL_NOTES: NoteData[] = (() => {
    const notes: NoteData[] = [];
    for (let oct = 2; oct <= 7; oct++) {
        for (let i = 0; i < 12; i++) {
            const note = NOTE_NAMES[i];
            const midi = (oct + 1) * 12 + i;
            notes.push({
                note,
                octave: oct,
                label: `${note}${oct}`,
                midi,
                isBlack: note.includes("#"),
            });
            if (note === "C" && oct === 7) break;
        }
    }
    return notes;
})();

export const WHITE_NOTES = ALL_NOTES.filter((n) => !n.isBlack);

/** white-note label → index in WHITE_NOTES */
export const WHITE_NOTE_IDX: Record<string, number> = {};
WHITE_NOTES.forEach((n, i) => {
    WHITE_NOTE_IDX[n.label] = i;
});

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
    M: "C#7",
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

/** Given a black note, return the label of the white key immediately to its left */
export function getLeftWhiteLabel(note: NoteData): string {
    const noteIdx = NOTE_NAMES.indexOf(note.note as NoteName);
    const prevNoteName = NOTE_NAMES[(noteIdx - 1 + 12) % 12];
    const candidate = `${prevNoteName}${note.octave}`;
    return WHITE_NOTE_IDX[candidate] !== undefined ? candidate : "";
}

/** Resolve a KeyboardEvent to a note label, or null */
export function resolveKeyToNote(e: KeyboardEvent): string | null {
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
