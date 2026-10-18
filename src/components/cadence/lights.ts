import { CADENCES, type CadenceType, type Direction, type WalkStep } from '@/lib/theory/cadence';
import { posKeyOf } from './geometry';

/** A node lit while its chord sounds, in the colour of the move it makes. */
export interface LitNode {
  key: string;
  color: string;
}

/**
 * The node sounding at each chord of a move from the centre along `rel`
 * (same order as runToProgression): ways in, from the clicked node back to
 * the centre; homes, from the centre out to the clicked node. The centre
 * takes the colour of the move that lands on it (or leaves it).
 */
export function moveLights(walk: WalkStep[], dir: Direction, rel: CadenceType[]): LitNode[] {
  const base = walk.map((s) => s.type);
  return Array.from({ length: rel.length + 1 }, (_, j) => {
    const path = dir === 'in' ? rel.slice(0, rel.length - j) : rel.slice(0, j);
    const type = path.length ? path[path.length - 1] : rel[0];
    return { key: posKeyOf([...base, ...path]), color: CADENCES[type].colorVar };
  });
}

/** The walk's nodes in the order walkToProgression plays them (its last run). */
export function walkLights(walk: WalkStep[]): LitNode[] {
  if (walk.length === 0) return [{ key: posKeyOf([]), color: 'var(--accent)' }];
  const last = walk[walk.length - 1].dir;
  let start = walk.length - 1;
  while (start > 0 && walk[start - 1].dir === last) start--;
  const types = walk.map((s) => s.type);
  const node = (i: number): LitNode => ({
    key: posKeyOf(types.slice(0, i)),
    color: CADENCES[i > start ? types[i - 1] : types[start]].colorVar,
  });
  const order = Array.from({ length: walk.length - start + 1 }, (_, j) => start + j);
  return (last === 'in' ? order.reverse() : order).map(node);
}
