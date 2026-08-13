import { describe, it, expect } from 'vitest';
import { Note } from './note';
import { SCALE_GROUPS, buildScale, getScaleDef, scaleDisplayName } from './scales';

const LEGACY_SCALE_IDS = [
  'major', 'minor', 'melodicMinor', 'harmonicMinor', 'harmonicMajor',
  'pentatonicMajor', 'pentatonicMinor', 'bluesMajor', 'bluesMinor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'phrygianDominant', 'halfWholeDiminished', 'altered', 'mixolydianFlat6',
  'dominantBebop', 'majorBebop', 'minorBebop', 'chromatic',
];

describe('scale catalog', () => {
  it('keeps every legacy scale, organized into groups', () => {
    const all = SCALE_GROUPS.flatMap((g) => g.scales.map((s) => s.id));
    for (const id of LEGACY_SCALE_IDS) expect(all).toContain(id);
    expect(SCALE_GROUPS.length).toBeGreaterThanOrEqual(5);
    for (const g of SCALE_GROUPS) expect(g.scales.length).toBeGreaterThan(0);
  });

  it('builds C major including the octave root', () => {
    const notes = buildScale(new Note('C', 4), getScaleDef('major'));
    expect(notes.map(String)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
  });

  it('builds F lydian', () => {
    const notes = buildScale(new Note('F', 3), getScaleDef('lydian'));
    expect(notes.map(String)).toEqual(['F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4']);
  });

  it('every scale spans exactly one octave', () => {
    for (const id of LEGACY_SCALE_IDS) {
      const def = getScaleDef(id);
      const sum = def.intervals.reduce((a, b) => a + b, 0);
      expect(sum, `${id} should span 12 semitones`).toBe(12);
    }
  });

  it('formats display names', () => {
    expect(scaleDisplayName('F', 'lydian')).toBe('F Lydian');
    expect(scaleDisplayName('C#', 'mixolydianFlat6')).toBe('C# Mixolydian ♭6');
  });
});
