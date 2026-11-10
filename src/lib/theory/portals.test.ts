import { describe, expect, it } from 'vitest';
import { getProgressionMap } from './progressions';
import { mapPortals } from './portals';

describe('mapPortals', () => {
  it('spawns secondary dominants only for chords off the map', () => {
    const p = mapPortals(getProgressionMap('major'), 'C', false, false, ['secondary']);
    expect(p.chords.map((c) => c.numeral).sort()).toEqual(['V/V', 'V/ii', 'V/iii', 'V/vi']);
  });

  it('keeps a borrowed dominant as an arrow, with its sub, instead of a copy', () => {
    const p = mapPortals(getProgressionMap('minor'), 'C', false, true, ['secondary', 'tritone']);
    expect(p.moves).toContainEqual({ from: 'IV', to: 'VII', kind: 'secondary' });
    expect(p.chords.some((c) => c.kind === 'secondary' && c.name === 'F')).toBe(false);
    expect(p.chords.find((c) => c.standsFor === 'IV')?.name).toBe('B7');
  });

  it('leads into a stand-in below the line rather than through it to its twin', () => {
    const p = mapPortals(getProgressionMap('phrygian'), 'C', false, true, ['secondary']);
    const f = p.chords.find((c) => c.name === 'F')!;
    expect(f.into).toEqual(['VII']);
    expect(f.numeral).toBe('V/♭VII');
  });

  it('leaves a stand-in out when its twin sits on the line', () => {
    const p = mapPortals(getProgressionMap('phrygian'), 'C', false, true, ['secondary']);
    expect(p.chords.find((c) => c.name === 'G')!.into).toEqual(['i']);
  });
});
