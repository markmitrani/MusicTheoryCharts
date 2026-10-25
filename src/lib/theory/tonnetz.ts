import { NOTE_NAMES } from './note';

/**
 * Tonnetz theory core: the lattice of notes linked by fifths and thirds, where
 * every triangle is a major or minor triad, plus the neo-Riemannian moves.
 * Pure; shared by the flat card and the 3D world.
 *
 * Flat layout (i, j) = (fifths, major thirds): pc = centre + 7i + 4j.
 * Screen basis e_i = (1, 0), e_j = (1/2, √3/2).
 * Up triangle at (i, j): corners (i,j) (i+1,j) (i,j+1): major, root at (i,j).
 * Down triangle at (i, j): corners (i+1,j) (i,j+1) (i+1,j+1): minor, root at (i,j+1).
 * The lattice repeats by (0, 3) (three major thirds) and (4, −4) (four minor
 * thirds): folded, it is a torus of 12 notes and 24 triangles.
 */

export interface Triad {
  root: number;
  minor: boolean;
}

/** All 24 triads in codec order `root * 2 + minor` (append-only). */
export const TRIADS: Triad[] = Array.from({ length: 24 }, (_, k) => ({ root: k >> 1, minor: (k & 1) === 1 }));

export const triadIndex = (t: Triad) => t.root * 2 + (t.minor ? 1 : 0);
export const sameTriad = (a: Triad | null, b: Triad | null) =>
  !!a && !!b && a.root === b.root && a.minor === b.minor;

const mod12 = (n: number) => ((n % 12) + 12) % 12;

type Step = 'P' | 'L' | 'R';
const STEP: Record<Step, (t: Triad) => Triad> = {
  P: (t) => ({ root: t.root, minor: !t.minor }),
  R: (t) => (t.minor ? { root: mod12(t.root + 3), minor: false } : { root: mod12(t.root - 3), minor: true }),
  L: (t) => (t.minor ? { root: mod12(t.root - 4), minor: false } : { root: mod12(t.root + 4), minor: true }),
};

/** Move registry; order fixed, append-only. */
export const MOVES = ['P', 'L', 'R', 'N', 'S', 'H'] as const;
export type Move = (typeof MOVES)[number];

export const MOVE_NAMES: Record<Move, string> = {
  P: 'Parallel',
  L: 'Leading-tone exchange',
  R: 'Relative',
  N: 'Nebenverwandt',
  S: 'Slide',
  H: 'Hexatonic pole',
};

/** Compound moves as their P/L/R steps, applied left to right. */
export const MOVE_STEPS: Record<Move, Step[]> = {
  P: ['P'],
  L: ['L'],
  R: ['R'],
  N: ['R', 'L', 'P'],
  S: ['L', 'P', 'R'],
  H: ['L', 'P', 'L'],
};

/** Every triad passed through, start and end included. */
export function movePath(t: Triad, move: Move): Triad[] {
  const path = [t];
  for (const s of MOVE_STEPS[move]) path.push(STEP[s](path[path.length - 1]));
  return path;
}

export function applyMove(t: Triad, move: Move): Triad {
  const path = movePath(t, move);
  return path[path.length - 1];
}

/** "C", "Am". */
export function triadName(t: Triad): string {
  return `${NOTE_NAMES[t.root]}${t.minor ? 'm' : ''}`;
}

/** "C major", "A minor". */
export function triadLongName(t: Triad): string {
  return `${NOTE_NAMES[t.root]} ${t.minor ? 'minor' : 'major'}`;
}

/** Tooltip text for a move from `t`: "R – A minor". */
export function moveLabel(t: Triad, move: Move): string {
  return `${move} – ${triadLongName(applyMove(t, move))}`;
}

/** Pitch classes of a triad: root, third, fifth. */
export function triadPcs(t: Triad): [number, number, number] {
  return [t.root, mod12(t.root + (t.minor ? 3 : 4)), mod12(t.root + 7)];
}

// ---- lattice ----

export function pcAt(centre: number, i: number, j: number): number {
  return mod12(centre + 7 * i + 4 * j);
}

/** A triangle's place on the flat lattice. */
export interface TriPos {
  i: number;
  j: number;
  up: boolean;
}

export const SQRT3_2 = Math.sqrt(3) / 2;

/** Lattice coordinate → flat world position (edge length 1). */
export const latticeToXY = (i: number, j: number) => ({ x: i + j / 2, y: j * SQRT3_2 });
/** Flat world position → continuous lattice coordinate. */
export const xyToLattice = (x: number, y: number) => {
  const j = y / SQRT3_2;
  return { i: x - j / 2, j };
};

export function triangleCorners(p: TriPos): [number, number][] {
  return p.up
    ? [
        [p.i, p.j],
        [p.i + 1, p.j],
        [p.i, p.j + 1],
      ]
    : [
        [p.i + 1, p.j],
        [p.i, p.j + 1],
        [p.i + 1, p.j + 1],
      ];
}

/** Centroid in lattice coordinates. */
export function triangleCentroid(p: TriPos): { i: number; j: number } {
  return p.up ? { i: p.i + 1 / 3, j: p.j + 1 / 3 } : { i: p.i + 2 / 3, j: p.j + 2 / 3 };
}

export function triangleAt(centre: number, p: TriPos): Triad {
  return p.up ? { root: pcAt(centre, p.i, p.j), minor: false } : { root: pcAt(centre, p.i, p.j + 1), minor: true };
}

/** The triangle containing a continuous lattice point. */
export function triangleContaining(fi: number, fj: number): TriPos {
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  return { i, j, up: fi - i + (fj - j) < 1 };
}

export type ArrowDir = 'left' | 'right' | 'up' | 'down';

/**
 * Neighbour across an edge, or null where there is no edge (a triangle has one
 * horizontal edge: ↓ on up triangles, ↑ on down ones). Up: ← R, → L, ↓ P.
 * Down: ← L, → R, ↑ P.
 */
export function neighbourPos(p: TriPos, dir: ArrowDir): TriPos | null {
  if (p.up) {
    if (dir === 'left') return { i: p.i - 1, j: p.j, up: false };
    if (dir === 'right') return { i: p.i, j: p.j, up: false };
    if (dir === 'down') return { i: p.i, j: p.j - 1, up: false };
    return null;
  }
  if (dir === 'left') return { i: p.i, j: p.j, up: true };
  if (dir === 'right') return { i: p.i + 1, j: p.j, up: true };
  if (dir === 'up') return { i: p.i, j: p.j + 1, up: true };
  return null;
}

/** The P/L/R neighbour of a placed triangle (the one sharing that edge). */
export function stepPos(p: TriPos, step: Step): TriPos {
  if (step === 'P') return p.up ? { i: p.i, j: p.j - 1, up: false } : { i: p.i, j: p.j + 1, up: true };
  if (step === 'R') return p.up ? { i: p.i - 1, j: p.j, up: false } : { i: p.i + 1, j: p.j, up: true };
  return p.up ? { i: p.i, j: p.j, up: false } : { i: p.i, j: p.j, up: true };
}

/** Placed triangles walked by a move from `p` (start included). */
export function movePosPath(p: TriPos, move: Move): TriPos[] {
  const path = [p];
  for (const s of MOVE_STEPS[move]) path.push(stepPos(path[path.length - 1], s));
  return path;
}

/** Torus coordinates: u major-third steps (mod 3), v minor-third steps (mod 4). */
export function toTorus(i: number, j: number): { u: number; v: number } {
  return { u: (((i + j) % 3) + 3) % 3, v: ((i % 4) + 4) % 4 };
}

/** The copy of `t` whose centroid is nearest a continuous lattice point. */
export function nearestCopy(centre: number, t: Triad, fi: number, fj: number): TriPos {
  let base: TriPos | null = null;
  outer: for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 3; j++) {
      const p = { i, j, up: !t.minor };
      if (sameTriad(triangleAt(centre, p), t)) {
        base = p;
        break outer;
      }
    }
  }
  const b = base!;
  const c = triangleCentroid(b);
  // Solve (fi, fj) − c ≈ a·(0, 3) + k·(4, −4), then test the nearby integers.
  const k0 = (fi - c.i) / 4;
  const a0 = (fj - c.j + 4 * k0) / 3;
  let best = b;
  let bestD = Infinity;
  for (const k of [Math.floor(k0), Math.ceil(k0)]) {
    for (const a of [Math.floor(a0) - 1, Math.floor(a0), Math.ceil(a0), Math.ceil(a0) + 1]) {
      const p = { i: b.i + 4 * k, j: b.j + 3 * a - 4 * k, up: b.up };
      const pc = triangleCentroid(p);
      const d1 = latticeToXY(pc.i - fi, pc.j - fj);
      const d = d1.x * d1.x + d1.y * d1.y;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

// ---- voicing ----

/** Register window for Tonnetz playback (C3–C5, in Note.totalSemitones). */
export const VOICE_LO = 24;
export const VOICE_HI = 48;

function voicings(t: Triad): number[][] {
  const pcs = triadPcs(t);
  const out: number[][] = [];
  for (let base = VOICE_LO; base <= VOICE_HI; base++) {
    const pc = base % 12;
    if (!pcs.includes(pc)) continue;
    // Close voicing starting on `base`: the other two tones stacked above it.
    const rest = pcs.filter((x) => x !== pc).map((x) => base + mod12(x - pc));
    const v = [base, ...rest].sort((a, b) => a - b);
    if (v[2] <= VOICE_HI) out.push(v);
  }
  return out;
}

/** Root-position triad around C3–C4. */
export function triadPitches(t: Triad): number[] {
  const root = VOICE_LO + t.root;
  return [root, root + (t.minor ? 3 : 4), root + 7];
}

/** Voicing of `t` closest to `from` (common tones hold), within C3–C5. */
export function voiceTriad(from: number[], t: Triad): number[] {
  const src = [...from].sort((a, b) => a - b);
  let best: number[] = triadPitches(t);
  let bestCost = Infinity;
  for (const v of voicings(t)) {
    const cost = v.reduce((s, p, k) => s + Math.abs(p - src[k]), 0);
    if (cost < bestCost) {
      bestCost = cost;
      best = v;
    }
  }
  return best;
}

/** Voice-led pitches for a sequence of triads. */
export function voiceProgression(triads: Triad[]): number[][] {
  const out: number[][] = [];
  for (const t of triads) out.push(out.length === 0 ? triadPitches(t) : voiceTriad(out[out.length - 1], t));
  return out;
}
