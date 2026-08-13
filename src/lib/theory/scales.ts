import { Note, NoteName } from './note';

/**
 * Scale catalog: every scale from the legacy app, organized into groups
 * for presentation. Intervals are consecutive semitone steps; each scale
 * spans exactly one octave (the built scale ends on the octave root).
 */
export interface ScaleDef {
  id: string;
  label: string;
  intervals: number[];
}

export interface ScaleGroup {
  id: string;
  label: string;
  scales: ScaleDef[];
}

export const SCALE_GROUPS: ScaleGroup[] = [
  {
    id: 'majorMinor',
    label: 'Major & Minor',
    scales: [
      { id: 'major', label: 'Major', intervals: [2, 2, 1, 2, 2, 2, 1] },
      { id: 'minor', label: 'Minor', intervals: [2, 1, 2, 2, 1, 2, 2] },
      { id: 'melodicMinor', label: 'Melodic Minor', intervals: [2, 1, 2, 2, 2, 2, 1] },
      { id: 'harmonicMinor', label: 'Harmonic Minor', intervals: [2, 1, 2, 2, 1, 3, 1] },
      { id: 'harmonicMajor', label: 'Harmonic Major', intervals: [2, 2, 1, 2, 1, 3, 1] },
    ],
  },
  {
    id: 'modes',
    label: 'Modes',
    scales: [
      { id: 'dorian', label: 'Dorian', intervals: [2, 1, 2, 2, 2, 1, 2] },
      { id: 'phrygian', label: 'Phrygian', intervals: [1, 2, 2, 2, 1, 2, 2] },
      { id: 'lydian', label: 'Lydian', intervals: [2, 2, 2, 1, 2, 2, 1] },
      { id: 'mixolydian', label: 'Mixolydian', intervals: [2, 2, 1, 2, 2, 1, 2] },
      { id: 'locrian', label: 'Locrian', intervals: [1, 2, 2, 1, 2, 2, 2] },
    ],
  },
  {
    id: 'pentatonicBlues',
    label: 'Pentatonic & Blues',
    scales: [
      { id: 'pentatonicMajor', label: 'Major Pentatonic', intervals: [2, 2, 3, 2, 3] },
      { id: 'pentatonicMinor', label: 'Minor Pentatonic', intervals: [3, 2, 2, 3, 2] },
      { id: 'bluesMajor', label: 'Major Blues', intervals: [2, 1, 1, 3, 2, 3] },
      { id: 'bluesMinor', label: 'Minor Blues', intervals: [3, 2, 1, 1, 3, 2] },
    ],
  },
  {
    id: 'jazzExotic',
    label: 'Jazz & Exotic',
    scales: [
      { id: 'phrygianDominant', label: 'Phrygian Dominant', intervals: [1, 3, 1, 2, 1, 2, 2] },
      { id: 'halfWholeDiminished', label: 'Half-Whole Diminished', intervals: [1, 2, 1, 2, 1, 2, 1, 2] },
      { id: 'wholeHalfDiminished', label: 'Whole-Half Diminished', intervals: [2, 1, 2, 1, 2, 1, 2, 1] },
      { id: 'altered', label: 'Altered', intervals: [1, 2, 1, 2, 2, 2, 2] },
      { id: 'mixolydianFlat6', label: 'Mixolydian ♭6', intervals: [2, 2, 1, 2, 1, 2, 2] },
    ],
  },
  {
    id: 'bebop',
    label: 'Bebop',
    scales: [
      { id: 'dominantBebop', label: 'Dominant Bebop', intervals: [2, 2, 1, 2, 2, 1, 1, 1] },
      { id: 'majorBebop', label: 'Major Bebop', intervals: [2, 2, 1, 2, 1, 1, 2, 1] },
      { id: 'minorBebop', label: 'Minor Bebop', intervals: [2, 1, 2, 2, 1, 2, 1, 1] },
    ],
  },
  {
    id: 'chromatic',
    label: 'Chromatic',
    scales: [{ id: 'chromatic', label: 'Chromatic', intervals: Array(12).fill(1) }],
  },
];

const SCALES_BY_ID = new Map<string, ScaleDef>(
  SCALE_GROUPS.flatMap((g) => g.scales.map((s) => [s.id, s])),
);

export function getScaleDef(id: string): ScaleDef {
  const def = SCALES_BY_ID.get(id);
  if (!def) throw new Error(`Unknown scale: ${id}`);
  return def;
}

/** Builds the scale's notes from a root, including the octave root at the end. */
export function buildScale(root: Note, def: ScaleDef): Note[] {
  const notes = [root];
  let current = root;
  for (const step of def.intervals) {
    current = current.move(step);
    notes.push(current);
  }
  return notes;
}

export function scaleDisplayName(root: NoteName | string, scaleId: string): string {
  return `${root} ${getScaleDef(scaleId).label}`;
}
