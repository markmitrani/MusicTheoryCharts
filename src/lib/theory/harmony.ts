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

/**
 * The label for the diatonic seventh formed over a triad of the given quality,
 * decided by the actual seventh interval (semitones above the chord root):
 * 11 = major 7th, 10 = minor 7th, 9 = diminished 7th.
 */
function seventhLabel(quality: ModeHarmony['qualities'][number], interval: number): string {
  switch (quality) {
    case 'maj':
      return interval === 11 ? 'maj7' : '7';
    case 'min':
      return interval === 11 ? 'mMaj7' : 'm7';
    case 'dim':
      return interval === 9 ? 'dim7' : 'm7♭5';
    case 'aug':
      return interval === 11 ? 'maj7♯5' : '7♯5';
    default:
      return '7';
  }
}

/**
 * The roman-numeral form with its seventh appended, following the same quality
 * the chord name carries: a major-7th interval is spelled "maj7" (so I → Imaj7,
 * IV → IVmaj7), a minor 7th is a plain "7" (V → V7, ii → ii7). On a diminished
 * triad, a fully-diminished 7th keeps the "°" (vii°7) while a half-diminished
 * one switches to "ø" (vii° → viiø7); an augmented triad keeps its "+".
 */
function seventhNumeral(base: string, quality: ModeHarmony['qualities'][number], interval: number): string {
  if (quality === 'dim') {
    return interval === 9 ? `${base}7` : `${base.replace('°', 'ø')}7`;
  }
  return interval === 11 ? `${base}maj7` : `${base}7`;
}

/**
 * The seven diatonic degree chords of a scale, voiced from the given root note.
 * With `sevenths`, each degree stacks the scale's own thirds one note further
 * (degrees i, i+2, i+4, i+6) so the added seventh is the true diatonic one —
 * e.g. the V of a major scale becomes a dominant 7 (not maj7), and vii° becomes
 * a half-diminished m7♭5. The triad `quality` is preserved for chip colouring.
 */
export function harmonyChords(root: Note, scaleId: string, sevenths = false): DegreeChord[] {
  const mode = HARMONY_MODES[scaleId];
  if (!mode) throw new Error(`No harmony definition for scale: ${scaleId}`);
  // degree positions = cumulative semitone offsets of the scale's intervals
  const positions: number[] = [0];
  for (const step of getScaleDef(scaleId).intervals) {
    positions.push(positions[positions.length - 1] + step);
  }
  const degreeCount = positions.length - 1; // scale notes per octave (7, sometimes 8)
  const degreeSemis = (i: number, third: number) =>
    positions[(i + third) % degreeCount] + 12 * Math.floor((i + third) / degreeCount);

  return mode.numerals.map((numeral, i) => {
    const chordRoot = root.move(positions[i]);
    const quality = mode.qualities[i];
    if (!sevenths) {
      return {
        numeral,
        name: `${chordRoot.name}${getChordDef(quality).label}`,
        quality,
        pitches: buildChord(chordRoot, quality).map((n) => n.totalSemitones),
      };
    }
    const semis = [0, 2, 4, 6].map((t) => degreeSemis(i, t));
    const interval = (((semis[3] - semis[0]) % 12) + 12) % 12;
    return {
      numeral: seventhNumeral(numeral, quality, interval),
      name: `${chordRoot.name}${seventhLabel(quality, interval)}`,
      quality,
      pitches: semis.map((s) => root.move(s).totalSemitones),
    };
  });
}
