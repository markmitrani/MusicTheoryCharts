import { describe, it, expect } from 'vitest';
import {
  TRIADS,
  MOVES,
  applyMove,
  movePath,
  movePosPath,
  moveLabel,
  triadName,
  triadPcs,
  triadIndex,
  pcAt,
  triangleAt,
  triangleCorners,
  neighbourPos,
  nearestCopy,
  triangleCentroid,
  triangleContaining,
  toTorus,
  voiceTriad,
  voiceProgression,
  VOICE_LO,
  VOICE_HI,
  type Triad,
  type Move,
} from './tonnetz';

const C: Triad = { root: 0, minor: false };
const common = (a: Triad, b: Triad) => triadPcs(a).filter((x) => triadPcs(b).includes(x)).length;

describe('tonnetz triads and moves', () => {
  it('lists the 24 triads in codec order', () => {
    expect(TRIADS).toHaveLength(24);
    expect(TRIADS[0]).toEqual({ root: 0, minor: false });
    expect(TRIADS[1]).toEqual({ root: 0, minor: true });
    TRIADS.forEach((t, k) => expect(triadIndex(t)).toBe(k));
  });

  it('maps C major through each move', () => {
    const names = Object.fromEntries(MOVES.map((m) => [m, triadName(applyMove(C, m))]));
    expect(names).toEqual({ P: 'Cm', R: 'Am', L: 'Em', N: 'Fm', S: 'C#m', H: 'G#m' });
  });

  it('every move is an involution', () => {
    for (const m of MOVES) for (const t of TRIADS) expect(applyMove(applyMove(t, m), m)).toEqual(t);
  });

  it('keeps the expected common tones from C major', () => {
    const counts = Object.fromEntries(MOVES.map((m) => [m, common(C, applyMove(C, m))]));
    expect(counts).toEqual({ P: 2, R: 2, L: 2, N: 1, S: 1, H: 0 });
  });

  it('every move flips quality', () => {
    for (const m of MOVES) for (const t of TRIADS) expect(applyMove(t, m).minor).toBe(!t.minor);
  });

  it('movePath runs from start to result', () => {
    for (const m of MOVES) {
      const p = movePath(C, m);
      expect(p[0]).toEqual(C);
      expect(p[p.length - 1]).toEqual(applyMove(C, m));
      expect(p).toHaveLength(m === 'P' || m === 'L' || m === 'R' ? 2 : 4);
    }
  });

  it('labels moves for tooltips', () => {
    expect(moveLabel(C, 'R')).toBe('R – A minor');
  });
});

describe('tonnetz lattice', () => {
  it('places fifths and thirds on the axes and wraps', () => {
    expect(pcAt(0, 0, 0)).toBe(0);
    expect(pcAt(0, 1, 0)).toBe(7);
    expect(pcAt(0, 0, 1)).toBe(4);
    expect(pcAt(0, 0, 3)).toBe(0);
    expect(pcAt(0, 1, -1)).toBe(3);
    expect(pcAt(0, 4, -4)).toBe(0);
    expect(pcAt(5, 0, 0)).toBe(5);
  });

  it('triangle corners carry the triad pitch classes', () => {
    for (let i = -3; i <= 3; i++)
      for (let j = -3; j <= 3; j++)
        for (const up of [true, false]) {
          const p = { i, j, up };
          const t = triangleAt(2, p);
          expect(t.minor).toBe(!up);
          const pcs = triangleCorners(p).map(([a, b]) => pcAt(2, a, b)).sort();
          expect(pcs).toEqual([...triadPcs(t)].sort());
        }
  });

  it('arrow neighbours are P, L and R', () => {
    const up = { i: 0, j: 0, up: true };
    expect(triadName(triangleAt(0, neighbourPos(up, 'left')!))).toBe('Am');
    expect(triadName(triangleAt(0, neighbourPos(up, 'right')!))).toBe('Em');
    expect(triadName(triangleAt(0, neighbourPos(up, 'down')!))).toBe('Cm');
    expect(neighbourPos(up, 'up')).toBeNull();
    const down = { i: 0, j: -1, up: false }; // C minor
    expect(triadName(triangleAt(0, down))).toBe('Cm');
    expect(triadName(triangleAt(0, neighbourPos(down, 'left')!))).toBe('G#');
    expect(triadName(triangleAt(0, neighbourPos(down, 'right')!))).toBe('D#');
    expect(triadName(triangleAt(0, neighbourPos(down, 'up')!))).toBe('C');
    expect(neighbourPos(down, 'down')).toBeNull();
    // Neighbours share an edge: two common tones.
    for (const p of [up, down])
      for (const d of ['left', 'right', 'up', 'down'] as const) {
        const n = neighbourPos(p, d);
        if (n) expect(common(triangleAt(0, p), triangleAt(0, n))).toBe(2);
      }
  });

  it('placed move paths agree with the theory', () => {
    for (const m of MOVES as readonly Move[])
      for (const t of TRIADS) {
        const start = nearestCopy(3, t, 0, 0);
        const path = movePosPath(start, m);
        expect(path.map((p) => triangleAt(3, p))).toEqual(movePath(t, m));
      }
  });

  it('one torus copy holds each of the 24 triads exactly once', () => {
    const seen = new Set<number>();
    for (let u = 0; u < 3; u++)
      for (let v = 0; v < 4; v++) {
        // (u, v) → (i, j) = (v, u − v)
        const i = v;
        const j = u - v;
        expect(toTorus(i, j)).toEqual({ u, v });
        seen.add(triadIndex(triangleAt(0, { i, j, up: true })));
        seen.add(triadIndex(triangleAt(0, { i, j, up: false })));
      }
    expect(seen.size).toBe(24);
  });

  it('finds the nearest copy of a triad', () => {
    for (const t of TRIADS) {
      const p = nearestCopy(0, t, 10.2, -7.4);
      expect(triangleAt(0, p)).toEqual(t);
      const c = triangleCentroid(p);
      // within one torus copy of the target
      expect(Math.abs(c.i - 10.2) + Math.abs(c.j + 7.4)).toBeLessThan(8);
    }
    expect(nearestCopy(0, C, 0.3, 0.3)).toEqual({ i: 0, j: 0, up: true });
  });

  it('locates the triangle containing a point', () => {
    expect(triangleContaining(0.2, 0.2)).toEqual({ i: 0, j: 0, up: true });
    expect(triangleContaining(0.7, 0.7)).toEqual({ i: 0, j: 0, up: false });
    expect(triangleContaining(-0.05, 0.1)).toEqual({ i: -1, j: 0, up: false });
  });
});

describe('tonnetz voicing', () => {
  it('holds common tones and moves minimally', () => {
    const from = [24, 28, 31]; // C3 E3 G3
    const am = voiceTriad(from, { root: 9, minor: true });
    expect(am).toEqual([24, 28, 33]); // C E A
    const cm = voiceTriad(from, { root: 0, minor: true });
    expect(cm).toEqual([24, 27, 31]);
  });

  it('stays inside the register window over long progressions', () => {
    let t = C;
    const seq: Triad[] = [t];
    for (let k = 0; k < 60; k++) {
      t = applyMove(t, (['R', 'L', 'S', 'N', 'H', 'P'] as Move[])[k % 6]);
      seq.push(t);
    }
    for (const v of voiceProgression(seq)) {
      expect(Math.min(...v)).toBeGreaterThanOrEqual(VOICE_LO);
      expect(Math.max(...v)).toBeLessThanOrEqual(VOICE_HI);
    }
  });
});
