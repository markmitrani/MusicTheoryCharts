import { describe, it, expect } from 'vitest';
import { Motion, springStep, snapToCentroid, THROW_OMEGA } from './motion';

const run = (m: Motion, seconds: number, hz: number) => {
  const dt = 1 / hz;
  for (let t = 0; t < seconds - 1e-9; t += dt) m.update(dt);
};

describe('tonnetz motion', () => {
  it('composes exactly: one big step equals many small ones', () => {
    let a = { x: 0, v: 3 };
    for (let k = 0; k < 120; k++) a = springStep(a.x, a.v, 2, 7, 1 / 120);
    const b = springStep(0, 3, 2, 7, 1);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.v).toBeCloseTo(b.v, 9);
  });

  it('is frame-rate independent', () => {
    const m60 = new Motion();
    const m120 = new Motion();
    for (const m of [m60, m120]) {
      m.beginDrag(0);
      m.dragTo({ x: 0.6, y: 0.1 }, 0.05);
      m.dragTo({ x: 1.2, y: 0.2 }, 0.1);
      m.endDrag(0.1);
    }
    run(m60, 0.4, 60);
    run(m120, 0.4, 120);
    expect(m60.pos.x).toBeCloseTo(m120.pos.x, 6);
    expect(m60.pos.y).toBeCloseTo(m120.pos.y, 6);
  });

  it('never overshoots its target', () => {
    const m = new Motion();
    m.vel = { x: 40, y: 0 }; // far faster than the step allows
    m.springTo({ x: 1, y: 0 });
    let max = 0;
    for (let k = 0; k < 400; k++) {
      m.update(1 / 120);
      max = Math.max(max, m.pos.x);
    }
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
    expect(m.pos.x).toBeCloseTo(1, 6);
    expect(m.mode).toBe('idle');
  });

  it('a fast throw settles further than a slow one, on a centroid', () => {
    const throwAt = (speed: number) => {
      const m = new Motion();
      m.beginDrag(0);
      m.dragTo({ x: speed * 0.05, y: 0 }, 0.05);
      m.dragTo({ x: speed * 0.1, y: 0 }, 0.1);
      m.endDrag(0.1);
      run(m, 3, 60);
      return m.pos;
    };
    const slow = throwAt(1);
    const fast = throwAt(12);
    expect(fast.x).toBeGreaterThan(slow.x + 1);
    expect(fast.x).toBeCloseTo(snapToCentroid({ x: 1.2 + 12 / THROW_OMEGA, y: 0 }).x, 6);
    const snapped = snapToCentroid(fast);
    expect(snapped.x).toBeCloseTo(fast.x, 6);
    expect(snapped.y).toBeCloseTo(fast.y, 6);
  });

  it('a long drag tracks the pointer exactly, with no jump on release', () => {
    const m = new Motion();
    m.beginDrag(0);
    // drag slowly across many torus copies, then stop and hold still
    for (let k = 1; k <= 200; k++) m.dragTo({ x: k * 0.25, y: -k * 0.1 }, k * 0.016);
    for (let k = 1; k <= 10; k++) m.dragTo({ x: 50, y: -20 }, 3.2 + k * 0.016);
    expect(m.pos).toEqual({ x: 50, y: -20 });
    m.endDrag(3.36);
    run(m, 2, 60);
    // came to rest on the triangle under the pointer, not thrown away
    expect(Math.hypot(m.pos.x - 50, m.pos.y + 20)).toBeLessThan(0.6);
  });

  it('travels through waypoints and stops on the last', () => {
    const m = new Motion();
    m.travel([{ x: 0.5, y: 0 }, { x: 1, y: 0 }, { x: 1.5, y: 0.3 }], 0.1);
    run(m, 3, 60);
    expect(m.pos.x).toBeCloseTo(1.5, 5);
    expect(m.pos.y).toBeCloseTo(0.3, 5);
  });

  it('clamps huge frame gaps', () => {
    const m = new Motion();
    m.springTo({ x: 5, y: 0 });
    m.update(10);
    expect(m.pos.x).toBeLessThan(5);
  });

  it('reduced motion jumps without gliding', () => {
    const m = new Motion();
    m.reducedMotion = true;
    m.beginDrag(0);
    m.dragTo({ x: 3, y: 0 }, 0.05);
    m.endDrag(0.05);
    expect(m.mode).toBe('idle');
    expect(m.pos).toEqual(snapToCentroid({ x: 3, y: 0 }));
  });
});
