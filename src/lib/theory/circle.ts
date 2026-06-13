import type { NoteName } from './note';

/**
 * Circle-of-fifths data: keys in fifths order starting from C, with
 * conventional display labels (flat side shows flats), key signatures,
 * and relative minors. Storage uses our sharp-only NoteName set.
 */
export interface CircleKey {
  note: NoteName;
  label: string;
  /** e.g. "3♯", "2♭", "" for C. */
  signature: string;
  relativeMinor: string;
}

export const CIRCLE_KEYS: CircleKey[] = [
  { note: 'C', label: 'C', signature: '', relativeMinor: 'Am' },
  { note: 'G', label: 'G', signature: '1♯', relativeMinor: 'Em' },
  { note: 'D', label: 'D', signature: '2♯', relativeMinor: 'Bm' },
  { note: 'A', label: 'A', signature: '3♯', relativeMinor: 'F♯m' },
  { note: 'E', label: 'E', signature: '4♯', relativeMinor: 'C♯m' },
  { note: 'B', label: 'B', signature: '5♯', relativeMinor: 'G♯m' },
  { note: 'F#', label: 'F♯', signature: '6♯', relativeMinor: 'D♯m' },
  { note: 'C#', label: 'D♭', signature: '5♭', relativeMinor: 'B♭m' },
  { note: 'G#', label: 'A♭', signature: '4♭', relativeMinor: 'Fm' },
  { note: 'D#', label: 'E♭', signature: '3♭', relativeMinor: 'Cm' },
  { note: 'A#', label: 'B♭', signature: '2♭', relativeMinor: 'Gm' },
  { note: 'F', label: 'F', signature: '1♭', relativeMinor: 'Dm' },
];

export function circleIndexOf(note: NoteName): number {
  return CIRCLE_KEYS.findIndex((k) => k.note === note);
}
