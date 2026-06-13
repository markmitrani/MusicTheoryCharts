import { Note } from './note';
import { getScaleDef } from './scales';
import { buildChord, getChordDef } from './chords';

/**
 * Diatonic harmony per scale/mode: roman numerals and triad quality for each
 * of the first seven degrees. Ported from legacy/src/scale-harmonies.ts with
 * qualities normalized to our chord-quality ids (maj/min/dim/aug).
 */
export interface ModeHarmony {
  numerals: string[];
  qualities: Array<'maj' | 'min' | 'dim' | 'aug'>;
}

export const HARMONY_MODES: Record<string, ModeHarmony> = {
  major: {
    numerals: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    qualities: ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'],
  },
  harmonicMajor: {
    numerals: ['I', 'ii°', 'iii', 'ivm', 'V', '♭VI+', 'vii°'],
    qualities: ['maj', 'dim', 'min', 'min', 'maj', 'aug', 'dim'],
  },
  minor: {
    numerals: ['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'],
    qualities: ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'],
  },
  harmonicMinor: {
    numerals: ['i', 'ii°', '♭III+', 'iv', 'V', '♭VI', 'vii°'],
    qualities: ['min', 'dim', 'aug', 'min', 'maj', 'maj', 'dim'],
  },
  melodicMinor: {
    numerals: ['i', 'ii', '♭III+', 'IV', 'V', 'vi°', 'vii°'],
    qualities: ['min', 'min', 'aug', 'maj', 'maj', 'dim', 'dim'],
  },
  dorian: {
    numerals: ['i', 'ii', '♭III', 'IV', 'v', 'vi°', '♭VII'],
    qualities: ['min', 'min', 'maj', 'maj', 'min', 'dim', 'maj'],
  },
  phrygian: {
    numerals: ['i', '♭II', '♭III', 'iv', 'v°', '♭VI', '♭vii'],
    qualities: ['min', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
  },
  lydian: {
    numerals: ['I', 'II', 'iii', '♯iv°', 'V', 'vi', 'vii'],
    qualities: ['maj', 'maj', 'min', 'dim', 'maj', 'min', 'min'],
  },
  mixolydian: {
    numerals: ['I', 'ii', 'iii°', 'IV', 'v', 'vi', '♭VII'],
    qualities: ['maj', 'min', 'dim', 'maj', 'min', 'min', 'maj'],
  },
  phrygianDominant: {
    numerals: ['I', '♭II', 'III', 'iv', 'v°', '♭VI', '♭vii'],
    qualities: ['maj', 'maj', 'maj', 'min', 'dim', 'maj', 'min'],
  },
  halfWholeDiminished: {
    numerals: ['i°', '♭ii°', '♭iii°', '♭iv°', '♭v°', '♭vi°', '♭vii°'],
    qualities: ['dim', 'dim', 'dim', 'dim', 'dim', 'dim', 'dim'],
  },
  altered: {
    numerals: ['i°', '♭II', '♭iii', 'iv', '♭v', '♭VI', '♭vii'],
    qualities: ['dim', 'maj', 'min', 'min', 'min', 'maj', 'min'],
  },
  mixolydianFlat6: {
    numerals: ['I', 'ii', 'iii°', 'IV', 'v', '♭VI', '♭VII'],
    qualities: ['maj', 'min', 'dim', 'maj', 'min', 'maj', 'maj'],
  },
};

export function hasHarmony(scaleId: string): boolean {
  return scaleId in HARMONY_MODES;
}

export interface DegreeChord {
  numeral: string;
  /** e.g. "Dm", "Bdim" — chord root name + quality label. */
  name: string;
  quality: ModeHarmony['qualities'][number];
  pitches: number[];
}

/** The seven diatonic triads of a scale, voiced from the given root note. */
export function harmonyChords(root: Note, scaleId: string): DegreeChord[] {
  const mode = HARMONY_MODES[scaleId];
  if (!mode) throw new Error(`No harmony definition for scale: ${scaleId}`);
  // degree positions = cumulative semitone offsets of the scale's intervals
  const positions: number[] = [0];
  for (const step of getScaleDef(scaleId).intervals) {
    positions.push(positions[positions.length - 1] + step);
  }
  return mode.numerals.map((numeral, i) => {
    const chordRoot = root.move(positions[i]);
    const quality = mode.qualities[i];
    return {
      numeral,
      name: `${chordRoot.name}${getChordDef(quality).label}`,
      quality,
      pitches: buildChord(chordRoot, quality).map((n) => n.totalSemitones),
    };
  });
}
