import {
  CADENCES,
  CADENCE_TYPES,
  CORNER_VECTOR,
  stepOf,
  walkPcs,
  type CadenceType,
  type Direction,
  type WalkStep,
} from '@/lib/theory/cadence';

/**
 * Pure layout for the Ways Home fractal. Nodes live in "world" space around
 * the frame root; a camera (centre c, zoom depth z) maps them to the 600-unit
 * viewBox. Every level is the previous one scaled by RATIO, so zooming one
 * level in and re-rooting is visually seamless.
 */
export const VIEW = 600;
export const CENTRE = VIEW / 2;
export const D1 = 150; // per-axis offset of a level-1 corner
export const RATIO = 0.45;
/** Relative bow of every road; clears the inward-facing child of each corner. */
export const BOW = 0.32;

const RADII = [34, 27, 21, 4.5];
const FONTS = [26, 21, 15, 15];
const STROKES = [2.6, 2.6, 1.7, 0.9];

export interface Frame {
  walk: WalkStep[];
  dir: Direction;
}

export interface Point {
  x: number;
  y: number;
}

export function worldPos(path: CadenceType[]): Point {
  let x = 0;
  let y = 0;
  path.forEach((t, i) => {
    const v = CORNER_VECTOR[CADENCES[t].corner];
    const d = D1 * RATIO ** i;
    x += v.x * d;
    y += v.y * d;
  });
  return { x, y };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Table value at a fractional level; extrapolates geometrically past the ends. */
function atLevel(table: number[], a: number): number {
  if (a <= 0) return table[0] * Math.min(1.8, (1 / RATIO) ** -a);
  const last = table.length - 1;
  if (a >= last) return table[last] * RATIO ** (a - last);
  const i = Math.floor(a);
  return lerp(table[i], table[i + 1], a - i);
}

export const radiusAt = (a: number) => atLevel(RADII, a);
export const fontAt = (a: number) => atLevel(FONTS, a);
export const strokeAt = (a: number) => atLevel(STROKES, a);

export interface Camera {
  c: Point;
  /** Zoom depth in levels; screen scale is (1/RATIO)^z. */
  z: number;
}

/**
 * Camera for a zoom of `k` levels toward world point `target` at eased
 * progress e. The target's screen position moves linearly to (or from) the
 * centre while the scale grows exponentially, so it never drifts.
 */
export function zoomCamera(target: Point, k: number, e: number, mode: 'in' | 'out'): Camera {
  const z = mode === 'in' ? k * e : k * (1 - e);
  const s = (1 / RATIO) ** z;
  const f = mode === 'in' ? 1 - (1 - e) / s : 1 - e / s;
  return { c: { x: target.x * f, y: target.y * f }, z };
}

export function toScreen(p: Point, cam: Camera): Point {
  const s = (1 / RATIO) ** cam.z;
  return { x: CENTRE + (p.x - cam.c.x) * s, y: CENTRE + (p.y - cam.c.y) * s };
}

export interface EdgeShape {
  d: string;
  /** Arrowhead triangle at the end of `d`. */
  tip: string;
}

const unit = (dx: number, dy: number) => {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
};

/**
 * A bowed road between a child and its parent node, drawn in the direction
 * of travel: child → parent for ways in, parent → child for homes.
 */
export function edgeShape(
  child: Point,
  parent: Point,
  rChild: number,
  rParent: number,
  width: number,
  toParent: boolean,
): EdgeShape {
  const len = Math.hypot(parent.x - child.x, parent.y - child.y);
  const d = unit(parent.x - child.x, parent.y - child.y);
  const q = {
    x: (child.x + parent.x) / 2 + d.y * BOW * len,
    y: (child.y + parent.y) / 2 - d.x * BOW * len,
  };
  const gap = 3 + width * 1.5;
  const uc = unit(q.x - child.x, q.y - child.y);
  const up = unit(q.x - parent.x, q.y - parent.y);
  const a = { x: child.x + uc.x * (rChild + (toParent ? 0 : gap)), y: child.y + uc.y * (rChild + (toParent ? 0 : gap)) };
  const b = { x: parent.x + up.x * (rParent + (toParent ? gap : 0)), y: parent.y + up.y * (rParent + (toParent ? gap : 0)) };
  const [from, to] = toParent ? [a, b] : [b, a];
  const u = unit(to.x - q.x, to.y - q.y);
  const L = 3.5 + width * 2.6;
  const W = 2 + width * 1.5;
  const base = { x: to.x - u.x * L, y: to.y - u.y * L };
  // The road stops at the arrowhead's base; the tip carries on to `to`.
  const tip = [
    `${to.x + u.x * gap * 0.6},${to.y + u.y * gap * 0.6}`,
    `${base.x + u.y * W},${base.y - u.x * W}`,
    `${base.x - u.y * W},${base.y + u.x * W}`,
  ].join(' ');
  return { d: `M ${from.x} ${from.y} Q ${q.x} ${q.y} ${to.x} ${to.y}`, tip };
}

// ---- scene ----

export interface SceneParams {
  root: Frame;
  /** Zoom in progress: path from the frame root to the zoom target. */
  target?: { rel: CadenceType[]; mode: 'in' | 'out'; e: number } | null;
  /** Deepest level visible at rest (2 = labelled levels; 3 adds faint dots). */
  maxLevel: number;
  /** Level-1 corners shown (lesson reveal); deeper nodes follow their corner. */
  corners?: CadenceType[] | null;
}

export interface SceneNode {
  posKey: string;
  pc: number;
  rel: CadenceType[];
  type: CadenceType | null;
  x: number;
  y: number;
  r: number;
  /** Apparent level after the camera's zoom (0 = centre). */
  a: number;
  opacity: number;
  labelOpacity: number;
  font: number;
}

export interface SceneEdge {
  posKey: string;
  type: CadenceType;
  rel: CadenceType[];
  shape: EdgeShape;
  width: number;
  opacity: number;
}

const startsWith = (p: CadenceType[], prefix: CadenceType[]) => prefix.every((t, i) => p[i] === t);

function enumerate(base: CadenceType[], depth: number, out: CadenceType[][]) {
  out.push(base);
  if (depth === 0) return;
  for (const t of CADENCE_TYPES) enumerate([...base, t], depth - 1, out);
}

export function buildScene({ root, target, maxLevel, corners }: SceneParams): { nodes: SceneNode[]; edges: SceneEdge[] } {
  const rootPc = walkPcs(root.walk).at(-1)!;
  const rootKey = root.walk.map((s) => s.type[0]).join('');
  const k = target?.rel.length ?? 0;
  const e = target?.e ?? 0;
  const cam: Camera = target ? zoomCamera(worldPos(target.rel), k, e, target.mode) : { c: { x: 0, y: 0 }, z: 0 };

  const paths: CadenceType[][] = [];
  enumerate([], 3, paths);
  if (target) {
    const sub: CadenceType[][] = [];
    enumerate(target.rel, 3, sub);
    for (let i = 1; i < k; i++) sub.push(target.rel.slice(0, i));
    const seen = new Set(paths.map((p) => p.join()));
    for (const p of sub) if (!seen.has(p.join())) paths.push(p);
  }

  const allowed = (p: CadenceType[]) => !corners || p.length === 0 || corners.includes(p[0]);
  const restOpacity = (len: number) => clamp01(maxLevel + 1 - len);

  const nodes: SceneNode[] = [];
  const byKey = new Map<string, SceneNode>();
  for (const rel of paths) {
    if (!allowed(rel)) continue;
    const a = rel.length - cam.z;
    const inTarget = target ? startsWith(rel, target.rel) : true;
    let opacity: number;
    if (!target) opacity = restOpacity(rel.length);
    else if (inTarget) opacity = clamp01(maxLevel + 1 - a);
    else if (target.mode === 'in') opacity = restOpacity(rel.length) * (1 - e) ** 1.5;
    else opacity = restOpacity(rel.length) * e ** 1.5;
    if (opacity <= 0.001) continue;

    let pc = rootPc;
    for (const t of rel) pc = stepOf(pc, root.dir, t);
    const p = toScreen(worldPos(rel), cam);
    const node: SceneNode = {
      posKey: rootKey + rel.map((t) => t[0]).join('') || '.',
      pc,
      rel,
      type: rel.length ? rel[rel.length - 1] : null,
      x: p.x,
      y: p.y,
      r: radiusAt(a),
      a,
      opacity,
      labelOpacity: clamp01((3 - a) * 1.5 - 0.5) * opacity,
      font: fontAt(a),
    };
    nodes.push(node);
    byKey.set(rel.join(), node);
  }

  const edges: SceneEdge[] = [];
  for (const n of nodes) {
    if (!n.type) continue;
    const parent = byKey.get(n.rel.slice(0, -1).join());
    if (!parent) continue;
    const width = strokeAt(n.a);
    edges.push({
      posKey: n.posKey,
      type: n.type,
      rel: n.rel,
      shape: edgeShape(n, parent, n.r, parent.r, width, root.dir === 'in'),
      width,
      opacity: Math.min(n.opacity, parent.opacity) * clamp01(3 - n.a),
    });
  }
  return { nodes, edges };
}
