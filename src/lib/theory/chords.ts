import { Note, NoteName } from './note';

/**
 * Jazz chord catalog. Formulas are semitone offsets from the root.
 * Quality ids are URL-safe (no unicode); display labels carry the glyphs.
 */
export interface ChordDef {
  id: string;
  /** Suffix appended to the root in display names ('' for major). */
  label: string;
  formula: number[];
}

export interface ChordGroup {
  id: string;
  label: string;
  chords: ChordDef[];
}

export const CHORD_GROUPS: ChordGroup[] = [
  {
    id: 'triads',
    label: 'Triads',
    chords: [
      { id: 'maj', label: '', formula: [0, 4, 7] },
      { id: 'min', label: 'm', formula: [0, 3, 7] },
      { id: 'dim', label: 'dim', formula: [0, 3, 6] },
      { id: 'aug', label: 'aug', formula: [0, 4, 8] },
      { id: 'sus2', label: 'sus2', formula: [0, 2, 7] },
      { id: 'sus4', label: 'sus4', formula: [0, 5, 7] },
    ],
  },
  {
    id: 'sevenths',
    label: 'Sevenths & Sixths',
    chords: [
      { id: 'maj7', label: 'maj7', formula: [0, 4, 7, 11] },
      { id: 'm7', label: 'm7', formula: [0, 3, 7, 10] },
      { id: '7', label: '7', formula: [0, 4, 7, 10] },
      { id: 'm7b5', label: 'm7♭5', formula: [0, 3, 6, 10] },
      { id: 'dim7', label: 'dim7', formula: [0, 3, 6, 9] },
      { id: '6', label: '6', formula: [0, 4, 7, 9] },
      { id: 'm6', label: 'm6', formula: [0, 3, 7, 9] },
    ],
  },
  {
    id: 'extensions',
    label: 'Extensions',
    chords: [
      { id: '9', label: '9', formula: [0, 4, 7, 10, 14] },
      { id: 'm9', label: 'm9', formula: [0, 3, 7, 10, 14] },
      { id: '11', label: '11', formula: [0, 4, 7, 10, 14, 17] },
      { id: '13', label: '13', formula: [0, 4, 7, 10, 14, 21] },
    ],
  },
  {
    id: 'altered',
    label: 'Altered',
    chords: [
      { id: 'maj7s11', label: 'maj7♯11', formula: [0, 4, 7, 11, 18] },
      { id: '7b9', label: '7♭9', formula: [0, 4, 7, 10, 13] },
      { id: '7s9', label: '7♯9', formula: [0, 4, 7, 10, 15] },
      { id: '7s11', label: '7♯11', formula: [0, 4, 7, 10, 18] },
      { id: '7b13', label: '7♭13', formula: [0, 4, 7, 10, 20] },
    ],
  },
];

const CHORDS_BY_ID = new Map<string, ChordDef>(
  CHORD_GROUPS.flatMap((g) => g.chords.map((c) => [c.id, c])),
);

export function getChordDef(id: string): ChordDef {
  const def = CHORDS_BY_ID.get(id);
  if (!def) throw new Error(`Unknown chord quality: ${id}`);
  return def;
}

export function buildChord(root: Note, qualityId: string): Note[] {
  return getChordDef(qualityId).formula.map((offset) => root.move(offset));
}

/** Number of distinct inversions = number of chord tones (incl. root position). */
export function inversionCount(qualityId: string): number {
  return getChordDef(qualityId).formula.length;
}

/** Inversion n: the lowest n notes move up an octave (n=0 is root position). */
export function invert(notes: Note[], n: number): Note[] {
  const count = ((n % notes.length) + notes.length) % notes.length;
  const lifted = notes.slice(0, count).map((note) => note.move(12));
  return [...notes.slice(count), ...lifted];
}

/**
 * Universal 7ths toggle (spec): maj → maj7, min → m7, dim → dim7;
 * qualities that inherently carry a 7th map to themselves (visual no-op),
 * as do qualities with no 7th form in the catalog (sus2/sus4/aug/6/m6).
 */
const SEVENTH_OF: Record<string, string> = {
  maj: 'maj7',
  min: 'm7',
  dim: 'dim7',
};

export function withSeventh(qualityId: string): string {
  return SEVENTH_OF[qualityId] ?? qualityId;
}

export function hasInherentSeventh(qualityId: string): boolean {
  const formula = getChordDef(qualityId).formula;
  return formula.includes(10) || formula.includes(11) || qualityId === 'dim7';
}

const ORDINALS = ['root position', '1st inversion', '2nd inversion', '3rd inversion', '4th inversion', '5th inversion'];

/** "Gmaj7 (1st inversion)"; root position has no suffix; never slash notation. */
export function chordDisplayName(root: NoteName | string, qualityId: string, inversion: number): string {
  const base = `${root}${getChordDef(qualityId).label}`;
  return inversion === 0 ? base : `${base} (${ORDINALS[inversion]})`;
}
