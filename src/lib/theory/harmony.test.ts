import { describe, it, expect } from 'vitest';
import { Note } from './note';
import { HARMONY_MODES, hasHarmony, harmonyChords } from './harmony';

describe('harmony', () => {
  it('knows which scales have harmony definitions', () => {
    expect(hasHarmony('major')).toBe(true);
    expect(hasHarmony('mixolydianFlat6')).toBe(true);
    expect(hasHarmony('chromatic')).toBe(false);
    expect(hasHarmony('pentatonicMajor')).toBe(false);
  });

  it('generates the C major diatonic chords', () => {
    const chords = harmonyChords(new Note('C', 4), 'major');
    expect(chords.map((c) => c.numeral)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
    expect(chords.map((c) => c.name)).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim']);
    expect(chords.map((c) => c.quality)).toEqual(['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim']);
    // degree ii = D minor: D4 F4 A4
    expect(chords[1].pitches).toEqual([new Note('D', 4), new Note('F', 4), new Note('A', 4)].map((n) => n.totalSemitones));
  });

  it('generates A harmonic minor with the augmented bIII and major V', () => {
    const chords = harmonyChords(new Note('A', 3), 'harmonicMinor');
    expect(chords.map((c) => c.numeral)).toEqual(['i', 'ii°', '♭III+', 'iv', 'V', '♭VI', 'vii°']);
    expect(chords[2].quality).toBe('aug');
    expect(chords[4].name).toBe('E');
  });

  it('uses only the first seven degrees of eight-note scales', () => {
    const chords = harmonyChords(new Note('C', 4), 'halfWholeDiminished');
    expect(chords.length).toBe(7);
    expect(chords.every((c) => c.quality === 'dim')).toBe(true);
  });

  it('covers every mode in HARMONY_MODES with 7 numerals and qualities', () => {
    for (const [id, def] of Object.entries(HARMONY_MODES)) {
      expect(def.numerals.length, id).toBe(7);
      expect(def.qualities.length, id).toBe(7);
    }
  });
});
