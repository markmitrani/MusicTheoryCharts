import { describe, it, expect } from 'vitest';
import { CADENCE_TYPES } from '@/lib/theory/cadence';
import { buildScene, worldPos, zoomCamera, toScreen, radiusAt, CENTRE, BOW, RATIO } from './geometry';

describe('fractal geometry', () => {
  it('puts V top-right and its corners around it at RATIO scale', () => {
    const v = worldPos(['dominant']);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
    const vv = worldPos(['dominant', 'dominant']);
    expect(vv.x - v.x).toBeCloseTo(v.x * RATIO);
  });

  it('zoom camera starts at identity and ends centred on the target', () => {
    const t = worldPos(['plagal']);
    const start = zoomCamera(t, 1, 0, 'in');
    expect([start.c.x, start.c.y, start.z].map((v) => v + 0)).toEqual([0, 0, 0]);
    const end = zoomCamera(t, 1, 1, 'in');
    expect(toScreen(t, end)).toEqual({ x: CENTRE, y: CENTRE });
    expect(end.z).toBe(1);
    const back = zoomCamera(t, 1, 1, 'out');
    expect(back.z).toBe(0);
    expect(back.c.x).toBeCloseTo(0);
  });

  it('every level-1 road clears its corner’s inward-facing child', () => {
    const { edges, nodes } = buildScene({ root: { walk: [], dir: 'in' }, maxLevel: 2 });
    const opposite = { dominant: 'backdoor', plagal: 'tritone', backdoor: 'dominant', tritone: 'plagal' } as const;
    for (const t of CADENCE_TYPES) {
      const road = edges.find((e) => e.rel.join() === t)!;
      const inward = nodes.find((n) => n.rel.join() === [t, opposite[t]].join())!;
      // sample the quadratic and measure the closest approach
      const [, x0, y0, , qx, qy, x1, y1] = road.shape.d.split(' ').map(Number);
      let min = Infinity;
      for (let i = 0; i <= 100; i++) {
        const s = i / 100;
        const x = (1 - s) ** 2 * x0 + 2 * s * (1 - s) * qx + s ** 2 * x1;
        const y = (1 - s) ** 2 * y0 + 2 * s * (1 - s) * qy + s ** 2 * y1;
        min = Math.min(min, Math.hypot(x - inward.x, y - inward.y));
      }
      expect(min).toBeGreaterThan(inward.r + 8);
    }
    expect(BOW).toBeGreaterThan(0);
  });

  it('shows labelled levels at rest and hides the deepest dots', () => {
    const { nodes } = buildScene({ root: { walk: [], dir: 'in' }, maxLevel: 2 });
    expect(nodes).toHaveLength(21);
    expect(nodes[0].r).toBe(radiusAt(0));
  });

  it('filters corners for the lesson reveal', () => {
    const { nodes, edges } = buildScene({ root: { walk: [], dir: 'in' }, maxLevel: 1, corners: ['dominant'] });
    expect(nodes.map((n) => n.rel.join())).toEqual(['', 'dominant']);
    expect(edges).toHaveLength(1);
  });

  it('is seamless at both ends of a zoom', () => {
    const rest = buildScene({ root: { walk: [{ dir: 'in', type: 'dominant' }], dir: 'in' }, maxLevel: 2 });
    const end = buildScene({
      root: { walk: [], dir: 'in' },
      target: { rel: ['dominant'], mode: 'in', e: 1 },
      maxLevel: 2,
    });
    const visible = end.nodes.filter((n) => n.opacity > 0.99);
    expect(visible.map((n) => n.posKey).sort()).toEqual(rest.nodes.map((n) => n.posKey).sort());
    for (const n of visible) {
      const twin = rest.nodes.find((m) => m.posKey === n.posKey)!;
      expect(n.x).toBeCloseTo(twin.x);
      expect(n.y).toBeCloseTo(twin.y);
      expect(n.r).toBeCloseTo(twin.r);
      expect(n.pc).toBe(twin.pc);
    }
  });
});
