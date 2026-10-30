import {
  applyMove,
  movePosPath,
  nearestCopy,
  neighbourPos,
  pcAt,
  sameTriad,
  triadIndex,
  triadPitches,
  triangleAt,
  triangleCentroid,
  triangleContaining,
  triangleCorners,
  latticeToXY,
  xyToLattice,
  voiceProgression,
  type ArrowDir,
  type Move,
  type Triad,
  type TriPos,
} from '@/lib/theory/tonnetz';
import { Motion, snapToCentroid, type Vec2 } from '@/lib/tonnetz/motion';
import { COPY_ORIGIN, PERIOD_A, PERIOD_B } from '@/lib/tonnetz/lattice-shader';
import { playChord, playProgression } from '@/lib/playback/playback';
import { getAudioEngine } from '@/lib/audio/engine';

export const FOV = 40;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
export const H_MIN = 3.6;
export const H_DEFAULT = 8.5;
/** Fraction the camera pulls back while dragging. */
const DRAG_PULLBACK = 0.22;
/** Duration of the selection / focus highlight tween. */
const LIT_EASE_S = 0.14;
/** Furthest zoom-out: the lattice shrinks to a wide field, labels fade first. */
export const H_MAX = 30;
/** Node disc radius in world units (the shader's R), plus a little slack for the pointer. */
const NODE_HIT = 0.19 * 1.15;

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
}

/** What the shader needs each frame, in coordinates kept near the origin. */
export interface FrameUniforms {
  cam: { i: number; j: number };
  copyBase: { a: number; b: number };
  focus: { i: number; j: number };
}

type Listener = (s: WorldUiState) => void;

/**
 * Everything the 3D world does, outside React: camera motion and zoom, focus /
 * selection / history, moves and playback, picking. The scene reads it once
 * per frame (`update`, `frameUniforms`) and copies it into uniforms; the DOM
 * chrome subscribes to discrete changes only, so nothing re-renders while
 * moving.
 */
export class WorldController {
  readonly centre: number;
  readonly motion: Motion;
  showChords: boolean;
  reducedMotion = false;

  /** Camera height as rendered: the zoom plus a momentary pull-back while dragging. */
  h = H_DEFAULT;
  /** The zoom the user set, eased toward hTarget. */
  hZoom = H_DEFAULT;
  hTarget = H_DEFAULT;
  /** 0..1, how far the drag pull-back has eased in. */
  private dragOut = 0;
  /** Set once a press has moved far enough to be a drag, so a click never pulls back. */
  pulling = false;
  aspect = 1;
  time = 0;

  focus: Triad;
  selection: Triad[];
  history: Triad[];
  playing = false;

  /** Smoothed per-triad light levels (selection / focus) and playback. */
  readonly lit = new Float32Array(24);
  readonly play = new Float32Array(24);
  /** Per pitch class: a node clicked on its own, glowing while it sounds. */
  readonly notePlay = new Float32Array(12);
  // per-triad ease-in-out tween of lit: start value, end value, start time
  private litFrom = new Float32Array(24);
  private litTo = new Float32Array(24);
  private litT0 = new Float32Array(24);
  private playTarget = new Float32Array(24);
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

  /**
   * Camera and focus shifted together by whole pairs of torus periods (same
   * pitch classes, same copy tints), so the shader's floats stay small however
   * far you travel. The motion itself keeps exact positions, so a drag never
   * re-bases mid-gesture.
   */
  frameUniforms(): FrameUniforms {
    const c = this.camLattice;
    const { a, b } = copyIndex(c.i, c.j);
    const na = 2 * Math.round(a / 2);
    const nb = 2 * Math.round(b / 2);
    const di = na * PERIOD_A.i + nb * PERIOD_B.i;
    const dj = na * PERIOD_A.j + nb * PERIOD_B.j;
    const f = triangleCentroid(nearestCopy(this.centre, this.focus, c.i, c.j));
    return {
      cam: { i: c.i - di, j: c.j - dj },
      copyBase: { a: a - na, b: b - nb },
      focus: { i: f.i - di, j: f.j - dj },
    };
  }

  // ---- subscriptions ----

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    fn(this.ui());
    return () => void this.listeners.delete(fn);
  }

  private ui(): WorldUiState {
    return { focus: this.focus, selection: this.selection, history: this.history, playing: this.playing };
  }

  private emit() {
    const s = this.ui();
    this.listeners.forEach((l) => l(s));
  }

  // ---- frame ----

  update(dt: number) {
    this.time += dt;
    const k = 1 - Math.exp(-dt * 10);
    this.hZoom += (this.hTarget - this.hZoom) * (this.reducedMotion ? 1 : k);
    const dragging = this.pulling && this.motion.mode === 'drag' && !this.reducedMotion;
    this.dragOut += ((dragging ? 1 : 0) - this.dragOut) * (1 - Math.exp(-dt * (dragging ? 5 : 3.5)));
    const e = this.dragOut * this.dragOut * (3 - 2 * this.dragOut);
    this.h = Math.min(H_MAX, this.hZoom * (1 + DRAG_PULLBACK * e));
    this.motion.update(dt);

    for (let n = this.timers.length - 1; n >= 0; n--) {
      if (this.timers[n].at <= this.time) {
        const t = this.timers.splice(n, 1)[0];
        t.fn();
      }
    }

    // Selection / focus: a short ease-in-out tween per triad, restarted from the current level.
    // Playback: fast attack, slow release (as the harmony chips).
    const attack = 1 - Math.exp(-dt * 22);
    const release = 1 - Math.exp(-dt * 3.2);
    const target = new Float32Array(24);
    this.selection.forEach((t) => (target[triadIndex(t)] = 1));
    target[triadIndex(this.focus)] = 1;
    for (let n = 0; n < 24; n++) {
      if (target[n] !== this.litTo[n]) {
        this.litFrom[n] = this.lit[n];
        this.litTo[n] = target[n];
        this.litT0[n] = this.time;
      }
      const u = this.reducedMotion ? 1 : Math.min(1, (this.time - this.litT0[n]) / LIT_EASE_S);
      const eased = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.lit[n] = this.litFrom[n] + (this.litTo[n] - this.litFrom[n]) * eased;
      const pt = this.playTarget[n];
      this.play[n] += (pt - this.play[n]) * (pt > this.play[n] ? attack : release);
    }
    for (let n = 0; n < 12; n++) this.notePlay[n] += (0 - this.notePlay[n]) * release;
  }

  private after(seconds: number, fn: () => void) {
    this.timers.push({ at: this.time + seconds, fn });
  }

  // ---- picking ----

  /**
   * Screen point → world point on the curved plane (relative to the camera).
   * Drags pass the set zoom (hZoom), so the pull-back doesn't slide the grabbed point.
   */
  screenToRel(nx: number, ny: number, h = this.h): Vec2 {
    const curve = 0.2 / h;
    const dx = nx * TAN * this.aspect;
    const dy = ny * TAN;
    let z = 0;
    let x = 0;
    let y = 0;
    for (let n = 0; n < 5; n++) {
      const t = h - z; // ray from (0,0,h) along (dx, dy, −1)
      x = dx * t;
      y = dy * t;
      z = -curve * (x * x + y * y);
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

  /** The note whose disc is under a screen point, if any (shader disc radius, a touch generous). */
  pickNode(nx: number, ny: number): number | null {
    const rel = this.screenToRel(nx, ny);
    const w = { x: this.motion.pos.x + rel.x, y: this.motion.pos.y + rel.y };
    const l = xyToLattice(w.x, w.y);
    for (const [i, j] of triangleCorners(triangleContaining(l.i, l.j))) {
      const c = latticeToXY(i, j);
      if (Math.hypot(c.x - w.x, c.y - w.y) < NODE_HIT) return pcAt(this.centre, i, j);
    }
    return null;
  }

  /** A single note: sounds and glows, leaving focus, selection and history alone. */
  playNote(pc: number) {
    getAudioEngine().triggerNote(36 + pc, 900); // the card's note register
    this.notePlay[pc] = 1;
  }

  clickAt(nx: number, ny: number, shift: boolean) {
    const pc = this.pickNode(nx, ny);
    if (pc !== null) {
      this.playNote(pc);
      return;
    }
    const p = this.pickTriangle(nx, ny);
    const t = triangleAt(this.centre, p);
    this.setFocus(t, { add: shift });
    this.playTriad(t);
  }

  /**
   * Arrow keys: across an edge to a neighbour, or (toward the corner that holds
   * the third) straight to the Slide triangle touching it there. Either way it
   * is one step: focus lands on it directly, with no route implied.
   */
  arrow(dir: ArrowDir, shift: boolean) {
    const next = neighbourPos(this.focusPos(), dir).pos;
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

  // ---- zoom ----

  zoomBy(factor: number) {
    this.hTarget = Math.min(H_MAX, Math.max(H_MIN, this.hTarget * factor));
  }

  pinch(dist: number, start: boolean) {
    if (start || !this.pinchStart) {
      this.pinchStart = { dist, h: this.hTarget };
      return;
    }
    const want = (this.pinchStart.h * this.pinchStart.dist) / Math.max(dist, 1);
    this.hTarget = Math.min(H_MAX, Math.max(H_MIN, want));
  }

  endPinch() {
    this.pinchStart = null;
  }

  /** Settle the camera on the nearest triangle (e.g. after a pinch). */
  settle() {
    if (this.motion.mode === 'idle') this.motion.springTo(snapToCentroid(this.motion.pos));
  }
}
