import { describe, it, expect } from 'vitest';
import { Note } from './note';
import {
  CHORD_GROUPS,
  buildChord,
  getChordDef,
  invert,
  inversionCount,
  withSeventh,
  hasInherentSeventh,
  chordDisplayName,
} from './chords';

describe('chord catalog', () => {
  it('covers the jazz quality list, grouped', () => {
    const all = CHORD_GROUPS.flatMap((g) => g.chords.map((c) => c.id));
    for (const id of [
      'maj', 'min', 'dim', 'aug', 'sus2', 'sus4',
      'maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6',
      '9', 'm9', '11', '13',
      'maj7s11', '7b9', '7s9', '7s11', '7b13',
    ]) {
      expect(all, `missing ${id}`).toContain(id);
    }
    expect(CHORD_GROUPS.map((g) => g.id)).toEqual(['triads', 'sevenths', 'extensions', 'altered']);
  });

  it('builds Cmaj7 in root position', () => {
    expect(buildChord(new Note('C', 4), 'maj7').map(String)).toEqual(['C4', 'E4', 'G4', 'B4']);
  });

  it('builds C7♭9 with the flat nine on top', () => {
    expect(buildChord(new Note('C', 3), '7b9').map(String)).toEqual(['C3', 'E3', 'G3', 'A#3', 'C#4']);
  });

  it('inverts by moving bass notes up an octave', () => {
    const gmaj7 = buildChord(new Note('G', 3), 'maj7'); // G3 B3 D4 F#4
    expect(invert(gmaj7, 1).map(String)).toEqual(['B3', 'D4', 'F#4', 'G4']);
    expect(invert(gmaj7, 2).map(String)).toEqual(['D4', 'F#4', 'G4', 'B4']);
    expect(invert(gmaj7, 0).map(String)).toEqual(['G3', 'B3', 'D4', 'F#4']);
  });

  it('inversion count equals chord size', () => {
    expect(inversionCount('maj')).toBe(3);
    expect(inversionCount('maj7')).toBe(4);
    expect(inversionCount('13')).toBe(6);
  });

  it('maps the universal 7ths toggle', () => {
    expect(withSeventh('maj')).toBe('maj7');
    expect(withSeventh('min')).toBe('m7');
    expect(withSeventh('dim')).toBe('dim7');
    expect(withSeventh('m7b5')).toBe('m7b5'); // inherently has a 7th — no-op
    expect(withSeventh('7b9')).toBe('7b9');
    expect(withSeventh('sus4')).toBe('sus4'); // no defined 7th form in catalog — no-op
    expect(hasInherentSeventh('m7b5')).toBe(true);
    expect(hasInherentSeventh('maj')).toBe(false);
  });

  it('names chords with parenthesized inversion ordinals, never slash notation', () => {
    expect(chordDisplayName('G', 'maj7', 1)).toBe('Gmaj7 (1st inversion)');
    expect(chordDisplayName('C', 'maj', 0)).toBe('C');
    expect(chordDisplayName('D', 'min', 2)).toBe('Dm (2nd inversion)');
    expect(chordDisplayName('G', 'sus2', 2)).toBe('Gsus2 (2nd inversion)');
    expect(chordDisplayName('F', '7s9', 3)).toBe('F7♯9 (3rd inversion)');
    expect(chordDisplayName('B', 'm7b5', 0)).toBe('Bm7♭5');
  });
});
