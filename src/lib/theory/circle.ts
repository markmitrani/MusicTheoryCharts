import { NOTE_NAMES, type NoteName } from './note';

/**
 * Circle-of-fifths data: keys in fifths order starting from C, with
 * conventional display labels (flat side shows flats), key signatures,
 * and relative minors. Storage uses our sharp-only NoteName set.
 */
export interface CircleKey {
  note: NoteName;
  label: string;
  /** e.g. "3♯", "2♭", "" for C. Compact text form. */
  signature: string;
  /** Number of accidentals in the key signature (0–6). */
  accidentals: number;
  accidentalType: 'sharp' | 'flat' | 'none';
  relativeMinor: string;
}

export const CIRCLE_KEYS: CircleKey[] = [
  { note: 'C', label: 'C', signature: '', accidentals: 0, accidentalType: 'none', relativeMinor: 'Am' },
  { note: 'G', label: 'G', signature: '1♯', accidentals: 1, accidentalType: 'sharp', relativeMinor: 'Em' },
  { note: 'D', label: 'D', signature: '2♯', accidentals: 2, accidentalType: 'sharp', relativeMinor: 'Bm' },
  { note: 'A', label: 'A', signature: '3♯', accidentals: 3, accidentalType: 'sharp', relativeMinor: 'F♯m' },
  { note: 'E', label: 'E', signature: '4♯', accidentals: 4, accidentalType: 'sharp', relativeMinor: 'C♯m' },
  { note: 'B', label: 'B', signature: '5♯', accidentals: 5, accidentalType: 'sharp', relativeMinor: 'G♯m' },
  { note: 'F#', label: 'F♯', signature: '6♯', accidentals: 6, accidentalType: 'sharp', relativeMinor: 'D♯m' },
  { note: 'C#', label: 'D♭', signature: '5♭', accidentals: 5, accidentalType: 'flat', relativeMinor: 'B♭m' },
  { note: 'G#', label: 'A♭', signature: '4♭', accidentals: 4, accidentalType: 'flat', relativeMinor: 'Fm' },
  { note: 'D#', label: 'E♭', signature: '3♭', accidentals: 3, accidentalType: 'flat', relativeMinor: 'Cm' },
  { note: 'A#', label: 'B♭', signature: '2♭', accidentals: 2, accidentalType: 'flat', relativeMinor: 'Gm' },
  { note: 'F', label: 'F', signature: '1♭', accidentals: 1, accidentalType: 'flat', relativeMinor: 'Dm' },
];

export function circleIndexOf(note: NoteName): number {
  return CIRCLE_KEYS.findIndex((k) => k.note === note);
}

/**
 * Vertical staff positions of key-signature accidentals on a treble clef,
 * in the canonical order they are written. A "step" is a diatonic step above
 * the bottom staff line (E4 = 0, F4 = 1, … F5 = 8). Used to lay out the
 * accidental glyphs on a rendered staff.
 *
 * Sharps order: F♯ C♯ G♯ D♯ A♯ E♯ B♯
 * Flats order:  B♭ E♭ A♭ D♭ G♭ C♭ F♭
 */
export const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
export const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];

const LETTERS = 'CDEFGAB';
const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
const NOTE_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Spell pitch class `pc` on the given letter, e.g. (E, 5) → "E♯". */
function spell(letter: string, pc: number): string {
  let acc = (((pc - NATURAL_PC[LETTERS.indexOf(letter)]) % 12) + 12) % 12;
  if (acc > 6) acc -= 12;
  return letter + (acc === 1 ? '♯' : acc === -1 ? '♭' : acc === 2 ? '𝄪' : acc === -2 ? '𝄫' : '');
}

/** The note `steps` letters above the key's tonic, `semis` semitones up. */
function above(key: CircleKey, steps: number, semis: number): string {
  const tonic = key.label[0];
  const pc = NOTE_PC[tonic] + (key.label[1] === '♯' ? 1 : key.label[1] === '♭' ? -1 : 0);
  return spell(LETTERS[(LETTERS.indexOf(tonic) + steps) % 7], (pc + semis + 12) % 12);
}

/** The half-diminished vii of a major key (B° in C), spelled for that key. */
export const leadingToneChord = (key: CircleKey) => `${above(key, 6, 11)}ø`;

/** The dominant seventh of the relative minor (E7 in C / in Am), spelled for that key. */
export const secondaryDominantChord = (key: CircleKey) => `${above(key, 2, 4)}7`;

/** Pitch class of the key's relative minor tonic as a sharp-only NoteName. */
export function relativeMinorNote(key: CircleKey): NoteName {
  const i = NOTE_NAMES.indexOf(key.note);
  return NOTE_NAMES[(i + 9) % 12];
}
