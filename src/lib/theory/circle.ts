import type { NoteName } from './note';

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
