/**
 * Motion core for the 3D Tonnetz: one 2D camera position in flat world units
 * (edge length 1), advanced once per frame. Every input feeds the same state,
 * so switching from a drag to a move mid-motion never jumps:
 *
 * - drag: the position follows the pointer directly; velocity is sampled over
 *   the last ~100 ms for the throw.
 * - spring: an analytic critically damped spring toward a target, seeded with
 *   the current velocity. With ω = λ and the target at the projected rest point
 *   p + v/λ this is exactly an exponential glide, so a throw decays like
 *   phantom.land's inertia and still settles on a triangle, with no overshoot.
 *
 * Integration is the closed-form solution, so 60 Hz and 120 Hz produce the
 * same motion and a dropped frame never jolts. Pure; no three.js or React.
 */

export interface Vec2 {
  x: number;
  y: number;
}

/** Glide rate for throws (1/s); equals the spring ω so throws never overshoot. */
export const THROW_OMEGA = 5.5;
/** Spring rate for travel to a triangle (1/s). */
export const STEP_OMEGA = 11;
/** Largest frame step integrated at once (tab switches, debugger pauses). */
export const MAX_DT = 0.1;

/**
 * One axis of a critically damped spring after `dt`, exactly.
 * x(t) = T + (d0 + (v0 + ω·d0)·t)·e^(−ωt), d0 = x0 − T.
 */
export function springStep(x0: number, v0: number, target: number, omega: number, dt: number) {
  const d0 = x0 - target;
  const e = Math.exp(-omega * dt);
  const k = v0 + omega * d0;
  return {
    x: target + (d0 + k * dt) * e,
    v: (v0 - omega * k * dt) * e,
  };
}

/**
 * Clamp a velocity component so the spring can't cross its target: a
 * critically damped spring overshoots only if it heads toward the target
 * faster than ω·distance.
 */
export function clampToward(x: number, v: number, target: number, omega: number) {
  const d = target - x;
  if (d === 0) return 0;
  if (Math.sign(v) !== Math.sign(d)) return v;
  const max = omega * Math.abs(d);
  return Math.sign(v) * Math.min(Math.abs(v), max);
}

/**
 * Snap points: the centroids of every triangle (both kinds). Major centroids
 * sit at lattice (i+⅓, j+⅓), minor ones at (i+⅔, j+⅔); world y = −j·√3/2.
 */
export function snapToCentroid(p: Vec2): Vec2 {
  const s = Math.sqrt(3) / 2;
  const j = -p.y / s;
  const i = p.x - j / 2;
  let best = p;
  let bestD = Infinity;
  for (const off of [1 / 3, 2 / 3]) {
    const bi = Math.round(i - off) + off;
    const bj = Math.round(j - off) + off;
    // the rounded point and its neighbours (the lattice is skewed)
    for (const [di, dj] of [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, -1],
      [-1, 1],
    ]) {
      const ci = bi + di;
      const cj = bj + dj;
      const q = { x: ci + cj / 2, y: -cj * s };
      const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = q;
      }
    }
  }
  return best;
}

type Mode = 'idle' | 'drag' | 'spring';

interface Sample {
  t: number;
  x: number;
  y: number;
}

export class Motion {
  pos: Vec2 = { x: 0, y: 0 };
  vel: Vec2 = { x: 0, y: 0 };
  target: Vec2 = { x: 0, y: 0 };
  omega = STEP_OMEGA;
  mode: Mode = 'idle';
  reducedMotion = false;
  private samples: Sample[] = [];
  private waypoints: Vec2[] = [];
  private dwell = 0;
  private dwellFor = 0.16;

  constructor(start?: Vec2) {
    if (start) {
      this.pos = { ...start };
      this.target = { ...start };
    }
  }

  get moving() {
    return this.mode !== 'idle';
  }

  // ---- drag ----

  beginDrag(t: number) {
    this.mode = 'drag';
    this.waypoints = [];
    this.vel = { x: 0, y: 0 };
    this.samples = [{ t, x: this.pos.x, y: this.pos.y }];
  }

  dragTo(p: Vec2, t: number) {
    if (this.mode !== 'drag') return;
    this.pos = { ...p };
    this.samples.push({ t, x: p.x, y: p.y });
    while (this.samples.length > 2 && t - this.samples[0].t > 0.1) this.samples.shift();
  }

  /** Release velocity from the last ~100 ms of samples. */
  sampledVelocity(t: number): Vec2 {
    const s = this.samples.filter((q) => t - q.t <= 0.12);
    if (s.length < 2) return { x: 0, y: 0 };
    const a = s[0];
    const b = s[s.length - 1];
    const dt = b.t - a.t;
    if (dt < 1e-3) return { x: 0, y: 0 };
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }

  endDrag(t: number) {
    if (this.mode !== 'drag') return;
    const v = this.reducedMotion ? { x: 0, y: 0 } : this.sampledVelocity(t);
    this.vel = v;
    // Project the glide's rest point, settle on the step nearest it.
    const rest = { x: this.pos.x + v.x / THROW_OMEGA, y: this.pos.y + v.y / THROW_OMEGA };
    this.springTo(snapToCentroid(rest), THROW_OMEGA);
  }

  // ---- springs ----

  springTo(target: Vec2, omega = STEP_OMEGA) {
    this.target = { ...target };
    this.omega = omega;
    this.mode = 'spring';
    this.vel = {
      x: clampToward(this.pos.x, this.vel.x, target.x, omega),
      y: clampToward(this.pos.y, this.vel.y, target.y, omega),
    };
    if (this.reducedMotion) {
      this.pos = { ...target };
      this.vel = { x: 0, y: 0 };
      this.mode = 'idle';
    }
  }

  /** Travel through waypoints, dwelling `dwell` seconds on each. */
  travel(points: Vec2[], dwell = 0.16) {
    if (points.length === 0) return;
    if (this.reducedMotion) {
      this.springTo(points[points.length - 1]);
      return;
    }
    this.waypoints = points.slice(1);
    this.dwellFor = dwell;
    this.dwell = dwell;
    this.springTo(points[0]);
  }

  // ---- frame ----

  update(dtRaw: number) {
    const dt = Math.min(Math.max(dtRaw, 0), MAX_DT);
    if (this.mode !== 'spring' || dt === 0) return;
    const sx = springStep(this.pos.x, this.vel.x, this.target.x, this.omega, dt);
    const sy = springStep(this.pos.y, this.vel.y, this.target.y, this.omega, dt);
    this.pos = { x: sx.x, y: sy.x };
    this.vel = { x: sx.v, y: sy.v };
    const dist = Math.hypot(this.target.x - this.pos.x, this.target.y - this.pos.y);
    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (this.waypoints.length > 0) {
      this.dwell -= dt;
      if ((this.dwell <= 0 && dist < 0.15) || this.dwell <= -0.5) {
        const next = this.waypoints.shift()!;
        this.target = { ...next };
        this.dwell = this.dwellFor;
      }
      return;
    }
    if (dist < 1e-4 && speed < 1e-3) {
      this.pos = { ...this.target };
      this.vel = { x: 0, y: 0 };
      this.mode = 'idle';
    }
  }
}
