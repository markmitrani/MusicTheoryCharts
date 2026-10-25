import {
  applyMove,
  movePosPath,
  nearestCopy,
  neighbourPos,
  sameTriad,
  triadIndex,
  triadPitches,
  triangleAt,
  triangleCentroid,
  triangleContaining,
  latticeToXY,
  xyToLattice,
  voiceProgression,
  type ArrowDir,
  type Move,
  type Triad,
  type TriPos,
} from '@/lib/theory/tonnetz';
import { Motion, MAJOR_THIRD, MINOR_THIRD, snapToCentroid, type Vec2 } from '@/lib/tonnetz/motion';
import { COPY_ORIGIN, PERIOD_A, PERIOD_B } from '@/lib/tonnetz/lattice-shader';
import { playChord, playProgression } from '@/lib/playback/playback';

export const FOV = 40;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
export const H_MIN = 3.6;
export const H_DEFAULT = 8.5;
export const H_ROLL_START = 12.5;
export const H_ROLL_END = 19;
export const H_MAX = 21;

const P_A = latticeToXY(PERIOD_A.i, PERIOD_A.j);
const P_B = latticeToXY(PERIOD_B.i, PERIOD_B.j);

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Torus copy index of a lattice point (same parallelogram as the shader). */
const copyIndex = (i: number, j: number) => {
  const s = (i - COPY_ORIGIN.i) / 4;
  const t = (j - COPY_ORIGIN.j + 4 * s) / 3;
  return { a: Math.floor(s), b: Math.floor(t) };
};

export interface WorldUiState {
  focus: Triad;
  selection: Triad[];
  history: Triad[];
  playing: boolean;
  roll: number;
}

type Listener = (s: WorldUiState) => void;

/**
 * Everything the 3D world does, outside React: camera motion, zoom and roll,
 * focus / selection / history, moves and playback, picking. The scene reads
 * it once per frame (`update`) and copies it into uniforms; the DOM chrome
 * subscribes to discrete changes only, so nothing re-renders while moving.
 */
export class WorldController {
  readonly centre: number;
  readonly motion: Motion;
  showChords: boolean;
  reducedMotion = false;

  /** Camera height (zoom) and its target. */
  h = H_DEFAULT;
  hTarget = H_DEFAULT;
  aspect = 1;
  viewportH = 800;
  time = 0;

  focus: Triad;
  selection: Triad[];
  history: Triad[];
  playing = false;

  /** Smoothed per-triad light levels (selection / focus) and playback. */
  readonly lit = new Float32Array(24);
  readonly play = new Float32Array(24);
  private playTarget = new Float32Array(24);
  private bump = 0;
  private timers: { at: number; fn: () => void }[] = [];
  private listeners = new Set<Listener>();
  private pinchStart: { dist: number; h: number } | null = null;

  constructor(centre: number, triad: Triad | null, showChords: boolean) {
    this.centre = centre;
    this.showChords = showChords;
    this.focus = triad ?? { root: centre, minor: false };
    this.selection = [this.focus];
    this.history = [this.focus];
    const p = nearestCopy(centre, this.focus, 0.3, 0.3);
    const c = triangleCentroid(p);
    this.motion = new Motion(latticeToXY(c.i, c.j));
  }

  // ---- derived ----

  get camLattice() {
    return xyToLattice(this.motion.pos.x, this.motion.pos.y);
  }

  get roll() {
    return smoothstep(H_ROLL_START, H_ROLL_END, this.h);
  }

  get curve() {
    return 0.2 / this.h;
  }

  /** Visible half-height of the plane in world units. */
  get halfHeight() {
    return this.h * TAN;
  }

  get fadeRadius() {
    return this.halfHeight * Math.hypot(1, this.aspect) * 1.02;
  }

  focusPos(): TriPos {
    const c = this.camLattice;
    return nearestCopy(this.centre, this.focus, c.i, c.j);
  }

  copyBase() {
    const c = this.camLattice;
    return copyIndex(c.i, c.j);
  }

  // ---- subscriptions ----

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.ui());
    return () => void this.listeners.delete(fn);
  }

  private ui(): WorldUiState {
    return { focus: this.focus, selection: this.selection, history: this.history, playing: this.playing, roll: this.roll };
  }

  private emit() {
    const s = this.ui();
    this.listeners.forEach((l) => l(s));
  }

  private lastRollBucket = 0;

  // ---- frame ----

  update(dt: number) {
    this.time += dt;
    // Zoom eases; the roll between plane and torus takes a slower, even pace.
    const rolling = Math.max(this.h, this.hTarget) > H_ROLL_START;
    const k = 1 - Math.exp(-dt * (rolling ? 4.5 : 10));
    this.h += (this.hTarget - this.h) * (this.reducedMotion ? 1 : k);
    this.motion.update(dt);
    this.wrap();

    for (let n = this.timers.length - 1; n >= 0; n--) {
      if (this.timers[n].at <= this.time) {
        const t = this.timers.splice(n, 1)[0];
        t.fn();
      }
    }

    // Light levels: fast attack, slow release (as the harmony chips).
    const attack = 1 - Math.exp(-dt * 22);
    const release = 1 - Math.exp(-dt * 3.2);
    const target = new Float32Array(24);
    this.selection.forEach((t) => (target[triadIndex(t)] = 1));
    target[triadIndex(this.focus)] = 1;
    for (let n = 0; n < 24; n++) {
      this.lit[n] += (target[n] - this.lit[n]) * (target[n] > this.lit[n] ? attack : release);
      const pt = this.playTarget[n];
      this.play[n] += (pt - this.play[n]) * (pt > this.play[n] ? attack : release);
    }

    this.bump *= Math.exp(-dt * 9);
    const bucket = Math.round(this.roll * 10);
    if (bucket !== this.lastRollBucket) {
      this.lastRollBucket = bucket;
      this.emit();
    }
  }

  /** Keep the camera near the origin by double periods (invisible: same pc, same tint). */
  private wrap() {
    const c = this.camLattice;
    const { a, b } = copyIndex(c.i, c.j);
    let dx = 0;
    let dy = 0;
    if (Math.abs(a) > 1) {
      const n = 2 * Math.round(a / 2);
      dx -= n * P_A.x;
      dy -= n * P_A.y;
    }
    if (Math.abs(b) > 1) {
      const n = 2 * Math.round(b / 2);
      dx -= n * P_B.x;
      dy -= n * P_B.y;
    }
    if (dx !== 0 || dy !== 0) this.motion.translate({ x: dx, y: dy });
  }

  /** Small sideways nudge of the camera when an arrow has no edge to cross. */
  get bumpOffset() {
    return this.bump * 0.06 * Math.sin(this.time * 40);
  }

  private after(seconds: number, fn: () => void) {
    this.timers.push({ at: this.time + seconds, fn });
  }

  // ---- picking ----

  /** Screen point → world point on the curved plane (relative to the camera). */
  screenToRel(nx: number, ny: number): Vec2 {
    const dx = nx * TAN * this.aspect;
    const dy = ny * TAN;
    let z = 0;
    let x = 0;
    let y = 0;
    for (let n = 0; n < 5; n++) {
      const t = this.h - z; // ray from (0,0,h) along (dx, dy, −1)
      x = dx * t;
      y = dy * t;
      z = -this.curve * (x * x + y * y);
    }
    return { x, y };
  }

  pickTriangle(nx: number, ny: number): TriPos {
    const rel = this.screenToRel(nx, ny);
    const p = { x: this.motion.pos.x + rel.x, y: this.motion.pos.y + rel.y };
    const l = xyToLattice(p.x, p.y);
    return triangleContaining(l.i, l.j);
  }

  // ---- focus, selection ----

  private follow(p: TriPos) {
    const c = triangleCentroid(p);
    const w = latticeToXY(c.i, c.j);
    const d = Math.hypot(w.x - this.motion.pos.x, w.y - this.motion.pos.y);
    if (d > this.halfHeight * 0.45) this.motion.springTo(w);
  }

  setFocus(t: Triad, opts: { add?: boolean; history?: boolean } = {}) {
    this.focus = t;
    if (opts.add) {
      if (!this.selection.some((s) => sameTriad(s, t))) this.selection = [...this.selection, t];
    } else {
      this.selection = [t];
    }
    if (opts.history !== false && !sameTriad(this.history[this.history.length - 1], t)) {
      this.history = [...this.history, t].slice(-24);
    }
    this.emit();
  }

  clickAt(nx: number, ny: number, shift: boolean) {
    if (this.roll > 0.3) return;
    const p = this.pickTriangle(nx, ny);
    const t = triangleAt(this.centre, p);
    this.setFocus(t, { add: shift });
    this.playTriad(t);
  }

  arrow(dir: ArrowDir, shift: boolean) {
    const from = this.focusPos();
    const next = neighbourPos(from, dir);
    if (!next) {
      this.bump = 1;
      return;
    }
    const t = triangleAt(this.centre, next);
    this.setFocus(t, { add: shift });
    this.follow(next);
    this.playTriad(t);
  }

  /** History entry → focus it and bring its nearest copy into view. */
  travelTo(t: Triad) {
    this.setFocus(t, { history: false });
    this.follow(this.focusPos());
    this.playTriad(t);
  }

  // ---- moves ----

  doMove(move: Move) {
    const start = this.focusPos();
    const path = movePosPath(start, move);
    const from = this.focus;
    const to = applyMove(from, move);
    const dwell = 0.17;
    const centroids = path.map((p) => {
      const c = triangleCentroid(p);
      return latticeToXY(c.i, c.j);
    });
    // The camera travels the route only when it would leave the central view.
    const end = centroids[centroids.length - 1];
    const far = Math.hypot(end.x - this.motion.pos.x, end.y - this.motion.pos.y) > this.halfHeight * 0.45;
    if (far) this.motion.travel(centroids.slice(1), dwell);
    // Light each triangle passed, then land on the new one.
    if (!this.reducedMotion) {
      path.slice(1, -1).forEach((p, k) => {
        const idx = triadIndex(triangleAt(this.centre, p));
        this.after(dwell * (k + 1) - 0.05, () => (this.playTarget[idx] = 0.7));
        this.after(dwell * (k + 2), () => (this.playTarget[idx] = 0));
      });
    }
    const landAt = this.reducedMotion ? 0 : dwell * (path.length - 1);
    this.after(landAt, () => {
      this.setFocus(to);
      this.playPair(from, to);
    });
  }

  // ---- sound ----

  private lightOnly(t: Triad | null) {
    this.playTarget.fill(0);
    if (t) this.playTarget[triadIndex(t)] = 1;
  }

  playTriad(t: Triad) {
    this.playing = true;
    this.lightOnly(t);
    playChord(triadPitches(t), {
      onLit: (s) => {
        if (s.size === 0) this.lightOnly(null);
      },
      onDone: () => {
        this.playing = false;
        this.emit();
      },
    });
    this.emit();
  }

  private playSeq(triads: Triad[], stepMs: number) {
    if (triads.length === 0) return;
    this.playing = true;
    playProgression(
      voiceProgression(triads),
      {
        onStep: (k) => this.lightOnly(k < 0 ? null : triads[k]),
        onDone: () => {
          this.playing = false;
          this.lightOnly(null);
          this.emit();
        },
      },
      stepMs,
    );
    this.emit();
  }

  playPair(from: Triad, to: Triad) {
    this.playSeq([from, to], 620);
  }

  playSelection() {
    this.playSeq(this.selection.length > 0 ? this.selection : [this.focus], 700);
  }

  // ---- camera input ----

  /** WASD: W/S ± major third, A/D ∓/± minor third (in step units). */
  static keyStep(key: string): Vec2 | null {
    switch (key) {
      case 'w':
        return MAJOR_THIRD;
      case 's':
        return { x: -MAJOR_THIRD.x, y: -MAJOR_THIRD.y };
      case 'd':
        return MINOR_THIRD;
      case 'a':
        return { x: -MINOR_THIRD.x, y: -MINOR_THIRD.y };
      default:
        return null;
    }
  }

  /**
   * Zoom by a factor. Crossing into the roll range commits the gesture: the
   * plane rolls all the way into the torus (or all the way back), so the
   * in-between curl is only ever seen in motion.
   */
  zoomBy(factor: number) {
    const inTorus = this.hTarget >= H_ROLL_END;
    let next = Math.min(H_MAX, Math.max(H_MIN, this.hTarget * factor));
    if (!inTorus && next > H_ROLL_START) next = factor > 1 ? H_MAX : H_ROLL_START;
    if (inTorus && factor < 1) next = H_ROLL_START - 1.5;
    this.hTarget = next;
  }

  pinch(dist: number, start: boolean) {
    if (start || !this.pinchStart) {
      this.pinchStart = { dist, h: this.hTarget };
      return;
    }
    const want = (this.pinchStart.h * this.pinchStart.dist) / Math.max(dist, 1);
    const factor = want / this.hTarget;
    if (Math.abs(factor - 1) > 1e-3) this.zoomBy(factor);
    if (this.hTarget >= H_ROLL_END || this.hTarget <= H_ROLL_START - 1.5) this.pinchStart = { dist, h: this.hTarget };
  }

  endPinch() {
    this.pinchStart = null;
  }

  /** Settle the camera on the nearest triangle (e.g. after a pinch). */
  settle() {
    if (this.motion.mode === 'idle') this.motion.springTo(snapToCentroid(this.motion.pos));
  }
}
