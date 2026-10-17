import { describe, it, expect } from 'vitest';
import {
  CADENCE_TYPES,
  approachOf,
  homeOf,
  approachesOf,
  homesOf,
  numeral,
  fractal,
  walkPcs,
  walkToProgression,
  runToProgression,
  MAP_CHAINS,
  JAZZ_CHAINS,
  chordLabel,
  rootName,
  chordName,
  voiceProgression,
  type WalkStep,
} from './cadence';
import { NOTE_NAMES } from './note';

const pcs = (rec: Record<string, number>) => CADENCE_TYPES.map((t) => rec[t]);

describe('cadence moves', () => {
  it('finds the four ways into C', () => {
    // dominant G, plagal F, backdoor B♭, tritone D♭
    expect(pcs(approachesOf(0))).toEqual([7, 5, 10, 1]);
  });

  it('finds the four homes of G', () => {
    // as V → C, as IV → D, as ♭VII → A, as ♭II → F♯
    expect(pcs(homesOf(7))).toEqual([0, 2, 9, 6]);
  });

  it('home undoes approach for every type and pitch class', () => {
    for (const t of CADENCE_TYPES) {
      for (let pc = 0; pc < 12; pc++) {
        expect(homeOf(approachOf(pc, t), t)).toBe(pc);
      }
    }
  });

  it('dominant and plagal are one road driven both ways', () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(approachOf(pc, 'dominant')).toBe(homeOf(pc, 'plagal'));
      expect(approachOf(pc, 'plagal')).toBe(homeOf(pc, 'dominant'));
    }
  });

  it('spells one numeral per semitone', () => {
    expect([...Array(12).keys()].map(numeral)).toEqual([
      'I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII',
    ]);
  });
});

describe('fractal', () => {
  it('has 85 nodes four levels deep', () => {
    expect(fractal(0, 'in', 4)).toHaveLength(85);
  });

  it('matches the approved sketch (ways in from I)', () => {
    const nodes = fractal(0, 'in', 3);
    const at = (...path: string[]) => numeral(nodes.find((n) => n.path.join() === path.join())!.pc);
    expect(['dominant', 'plagal', 'backdoor', 'tritone'].map((t) => at(t))).toEqual(['V', 'IV', '♭VII', '♭II']);
    expect(CADENCE_TYPES.map((t) => at('dominant', t))).toEqual(['II', 'I', 'IV', '♭VI']);
    expect(CADENCE_TYPES.map((t) => at('plagal', t))).toEqual(['I', '♭VII', '♭III', '♭V']);
    expect(CADENCE_TYPES.map((t) => at('backdoor', t))).toEqual(['IV', '♭III', '♭VI', 'VII']);
    expect(CADENCE_TYPES.map((t) => at('tritone', t))).toEqual(['♭VI', '♭V', 'VII', 'II']);
  });

  it('shows homes when flipped', () => {
    const corners = fractal(7, 'out', 2).filter((n) => n.level === 1);
    expect(corners.map((n) => numeral(n.pc))).toEqual(['I', 'II', 'VI', '♭V']);
  });
});

describe('walks and playback order', () => {
  const step = (dir: 'in' | 'out', type: WalkStep['type']): WalkStep => ({ dir, type });

  it('tracks pitch classes along a walk', () => {
    expect(walkPcs([step('in', 'dominant'), step('in', 'dominant')])).toEqual([0, 7, 2]);
  });

  it('plays an empty walk as home', () => {
    expect(walkToProgression([])).toEqual([{ pc: 0, quality: 'maj7' }]);
  });

  it('plays a ways-in run from the outside back home: II7–V7–Imaj7', () => {
    expect(walkToProgression([step('in', 'dominant'), step('in', 'dominant')])).toEqual([
      { pc: 2, quality: '7' },
      { pc: 7, quality: '7' },
      { pc: 0, quality: 'maj7' },
    ]);
  });

  it('plays a homes run forward: C7–F7–B♭maj7', () => {
    expect(walkToProgression([step('out', 'dominant'), step('out', 'dominant')])).toEqual([
      { pc: 0, quality: '7' },
      { pc: 5, quality: '7' },
      { pc: 10, quality: 'maj7' },
    ]);
  });

  it('plays only the steps since the last flip', () => {
    // in to V, flip, G as IV goes home to D
    expect(walkToProgression([step('in', 'dominant'), step('out', 'plagal')])).toEqual([
      { pc: 7, quality: 'maj7' },
      { pc: 2, quality: 'maj7', seventhBelow: true },
    ]);
  });

  it('marks only plagal arrivals for a falling 7th', () => {
    expect(runToProgression(0, 'in', ['plagal']).at(-1)).toEqual({ pc: 0, quality: 'maj7', seventhBelow: true });
    expect(runToProgression(0, 'in', ['dominant']).at(-1)).toEqual({ pc: 0, quality: 'maj7' });
    // homes run: the last step lands, here plagal (C as IV goes home to G)
    expect(runToProgression(0, 'out', ['dominant', 'plagal']).at(-1)?.seventhBelow).toBe(true);
  });

  it('gives plagal approaches a maj7 and dominant-family approaches a 7', () => {
    expect(runToProgression(0, 'in', ['plagal'])[0]).toEqual({ pc: 5, quality: 'maj7' });
    expect(runToProgression(0, 'in', ['backdoor'])[0]).toEqual({ pc: 10, quality: '7' });
    expect(runToProgression(0, 'in', ['tritone'])[0]).toEqual({ pc: 1, quality: '7' });
  });
});

describe('chains', () => {
  it('map chains repeat one move three times', () => {
    expect(MAP_CHAINS.dominant.map(chordLabel)).toEqual(['VI7', 'II7', 'V7', 'Imaj7']);
    expect(MAP_CHAINS.plagal.map(chordLabel)).toEqual(['♭IIImaj7', '♭VIImaj7', 'IVmaj7', 'Imaj7']);
    expect(MAP_CHAINS.backdoor.map(chordLabel)).toEqual(['♭V7', '♭VI7', '♭VII7', 'Imaj7']);
    expect(MAP_CHAINS.tritone.map(chordLabel)).toEqual(['♭III7', 'II7', '♭II7', 'Imaj7']);
  });

  it('jazz versions use idiomatic qualities', () => {
    expect(JAZZ_CHAINS.dominant.map(chordLabel)).toEqual(['ii7', 'V7', 'Imaj7']);
    expect(JAZZ_CHAINS.plagal.map(chordLabel)).toEqual(['IVmaj7', 'iv6', 'Imaj7']);
    expect(JAZZ_CHAINS.backdoor.map(chordLabel)).toEqual(['iv7', '♭VII7', 'Imaj7']);
    expect(JAZZ_CHAINS.tritone.map(chordLabel)).toEqual(['ii7', '♭II7', 'Imaj7']);
  });
});

describe('spelling in a key', () => {
  it('spells C with flats on the flat degrees', () => {
    expect([...Array(12).keys()].map((pc) => rootName(pc, 'C'))).toEqual([
      'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B',
    ]);
  });

  it('never shows double accidentals or white-key enharmonics', () => {
    for (const key of NOTE_NAMES) {
      for (let pc = 0; pc < 12; pc++) {
        const name = rootName(pc, key);
        expect(name).not.toMatch(/𝄫|𝄪|♭♭|♯♯|C♭|F♭|E♯|B♯/);
        expect(name).toMatch(/^[A-G][♭♯]?$/);
      }
    }
  });

  it('spells keys from the circle of fifths labels', () => {
    expect(rootName(0, 'C#')).toBe('D♭');
    expect(rootName(1, 'C#')).toBe('D'); // ♭II of D♭ collapses from E♭♭
    expect(rootName(10, 'F#')).toBe('E');
    expect(rootName(6, 'F')).toBe('B'); // ♭V of F collapses from C♭
  });

  it('names chords with their quality', () => {
    expect(chordName({ pc: 10, quality: '7' }, 'C')).toBe('B♭7');
    expect(chordName({ pc: 5, quality: 'm6' }, 'C')).toBe('Fm6');
    expect(chordName({ pc: 0, quality: 'maj7' }, 'G')).toBe('Gmaj7');
  });
});

describe('voicing', () => {
  const pcSet = (ps: number[]) => new Set(ps.map((p) => p % 12));

  it('puts the root in the bass and the chord in the right hand', () => {
    const voiced = voiceProgression(JAZZ_CHAINS.dominant);
    expect(voiced.map((v) => v[0] % 12)).toEqual([2, 7, 0]);
    expect(pcSet(voiced[1].slice(1))).toEqual(new Set([7, 11, 2, 5])); // G B D F
    for (const v of voiced) {
      expect(v.slice(1)).toHaveLength(4);
      expect(Math.min(...v.slice(1))).toBeGreaterThan(v[0]);
    }
  });

  it('voice-leads by small steps', () => {
    const voiced = voiceProgression([
      { pc: 7, quality: '7' },
      { pc: 0, quality: 'maj7' },
    ]);
    const a = voiced[0].slice(1);
    const b = voiced[1].slice(1);
    const moved = a.reduce((sum, p, i) => sum + Math.abs(p - b[i]), 0);
    expect(moved).toBeLessThanOrEqual(5);
  });

  it('drops into I after IV: the 7th sits under the root and every voice falls', () => {
    const [iv, i] = voiceProgression(runToProgression(0, 'in', ['plagal']));
    const a = iv.slice(1);
    const b = i.slice(1);
    expect(b[0] % 12).toBe(11); // B under C
    b.forEach((p, k) => expect(p).toBeLessThanOrEqual(a[k]));
  });

  it('transposes to a key', () => {
    const voiced = voiceProgression([{ pc: 0, quality: 'maj7' }], 'G');
    expect(voiced[0][0] % 12).toBe(7);
  });
});
