import { describe, expect, it } from 'vitest';
import { CIRCLE_KEYS, leadingToneChord, relativeMinorNote, secondaryDominantChord } from './circle';

const key = (label: string) => CIRCLE_KEYS.find((k) => k.label === label)!;

describe('circle chord spelling', () => {
  it('spells the viiø for sharp and flat keys', () => {
    expect(leadingToneChord(key('C'))).toBe('Bø');
    expect(leadingToneChord(key('F♯'))).toBe('E♯ø');
    expect(leadingToneChord(key('D♭'))).toBe('Cø');
    expect(leadingToneChord(key('F'))).toBe('Eø');
  });

  it('spells V7/vi (the dominant of the relative minor)', () => {
    expect(secondaryDominantChord(key('C'))).toBe('E7');
    expect(secondaryDominantChord(key('D♭'))).toBe('F7');
    expect(secondaryDominantChord(key('F♯'))).toBe('A♯7');
    expect(secondaryDominantChord(key('B♭'))).toBe('D7');
  });

  it('finds the relative minor tonic', () => {
    expect(relativeMinorNote(key('C'))).toBe('A');
    expect(relativeMinorNote(key('E♭'))).toBe('C');
  });
});
