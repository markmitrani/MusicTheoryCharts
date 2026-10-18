import { describe, it, expect } from 'vitest';
import { moveLights, walkLights } from './lights';

describe('playback lights', () => {
  it('ways in: the clicked node first, then each node back to the centre', () => {
    // at I, click V's own V (II): II7 → V7 → Imaj7
    expect(moveLights([], 'in', ['dominant', 'dominant']).map((l) => l.key)).toEqual(['dd', 'd', '.']);
  });

  it('homes: the centre first, then out to the clicked node', () => {
    expect(moveLights([], 'out', ['plagal']).map((l) => l.key)).toEqual(['.', 'p']);
  });

  it('keys are absolute, so they survive a zoom into the clicked node', () => {
    const walk = [{ dir: 'in' as const, type: 'tritone' as const }];
    expect(moveLights(walk, 'in', ['backdoor']).map((l) => l.key)).toEqual(['tb', 't']);
  });

  it('colours each node by its move; the centre by the move that lands', () => {
    const [v, i] = moveLights([], 'in', ['dominant']);
    expect(v.color).toBe('var(--cadence-dominant)');
    expect(i.color).toBe('var(--cadence-dominant)');
  });

  it('walk playback follows walkToProgression order', () => {
    const walk = [
      { dir: 'in' as const, type: 'dominant' as const },
      { dir: 'in' as const, type: 'dominant' as const },
    ];
    expect(walkLights(walk).map((l) => l.key)).toEqual(['dd', 'd', '.']);
  });
});
