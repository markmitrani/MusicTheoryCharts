/**
 * A note defined by pitch-class name (e.g. "C#") and octave (1–8).
 * Supports conversion between name/octave and absolute semitones,
 * and transposition. Ported from legacy/src/note.ts.
 */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export type NoteName = (typeof NOTE_NAMES)[number];

const MAX_TOTAL = (8 - 1) * 12 + 11; // B8

export class Note {
  readonly name: NoteName;
  readonly octave: number;

  constructor(name: string, octave: number) {
    if (!NOTE_NAMES.includes(name as NoteName)) {
      throw new Error(`Invalid note name: ${name}`);
    }
    if (octave < 1 || octave > 8) {
      throw new Error(`Invalid octave: ${octave}`);
    }
    this.name = name as NoteName;
    this.octave = octave;
  }

  get semitoneIndex(): number {
    return NOTE_NAMES.indexOf(this.name);
  }

  get totalSemitones(): number {
    return (this.octave - 1) * 12 + this.semitoneIndex;
  }

  move(semitones: number): Note {
    return Note.fromTotalSemitones(this.totalSemitones + semitones);
  }

  toString(): string {
    return `${this.name}${this.octave}`;
  }

  static fromTotalSemitones(total: number): Note {
    if (total < 0 || total > MAX_TOTAL) {
      throw new Error('Total semitones out of valid range (C1 to B8)');
    }
    return new Note(NOTE_NAMES[total % 12], Math.floor(total / 12) + 1);
  }
}
