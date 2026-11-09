import type { Portals } from '@/lib/theory/portals';
import {
  homeId,
  isGroup,
  members,
  type LabelKind,
  type MapChord,
  type ProgressionMap,
  type ResolvedChord,
} from '@/lib/theory/progressions';

/**
 * Geometry for a progression map, in viewBox units. Pure: the SVG scene, the
 * explainer and a future poster export all draw from the same layout. Chords
 * are glass nodes (circles, or capsules when the label runs wide) and arrows
 * are Ways Home roads: a round stroke into a filled tip, stopping short of the
 * node they reach.
 */

export const VIEW_W = 1240;
const MAIN_Y = 296;
const HEIGHT = 592;
const LANE_DY = 330;
const BORROWED_HEIGHT = 752;
const MARGIN = 28;

export const FONT = 46;
export const LANE_FONT = 38;
export const NAME_FONT = 19;
const NODE_H = { names: 100, bare: 86 };
const LANE_NODE_H = { names: 86, bare: 74 };
const MEMBER_DY = 70;
const BRACKET_PAD = 40; // room inside a bracket for its swap arrows
const GAP = 58; // between neighbouring slots: the flow arrow lives here
const FAN_W = 142;
const LANE_GAP = 24;
const ARC_CLEAR = 20; // an arc's least clearance over (or under) the slots it passes

/** A node shows its labels in order: the first in the big face, the second (if any) as the subtitle. */
export type { LabelKind };

/** Stroke widths by kind; arrowheads scale with them, as on Ways Home. */
export const STROKE: Record<EdgeKind, number> = { flow: 4, arc: 4, fan: 4, swap: 3, lane: 3, twin: 2.4, portal: 3, tritone: 3 };

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PlacedChord {
  id: string;
  /** Node centre. */
  x: number;
  y: number;
  /** Drawn size: a circle, or a capsule when the label runs wide. */
  w: number;
  h: number;
  font: number;
  /** The space it takes in the layout (wider than w × h when the node is tilted). */
  box: Box;
  lane: boolean;
  /** Angle of the capsule's long axis in the layout (radians): nodes drawn upright in a turned frame. */
  tilt?: number;
}

export interface Bracket {
  id: string;
  box: Box;
}

export type EdgeKind = 'flow' | 'arc' | 'swap' | 'fan' | 'twin' | 'lane' | 'portal' | 'tritone';

export interface Edge {
  key: string;
  kind: EdgeKind;
  d: string;
  /** Arrowhead triangle (polygon points); none for twin links. */
  tip?: string;
  /** "from>to" chord moves this edge carries; '*' as a target = anywhere. */
  carries: string[];
}

export interface MapLayout {
  /** viewBox: wide maps (7ths, long numerals) widen it, and the height follows to keep the stage's shape. */
  viewBox: string;
  chords: Map<string, PlacedChord>;
  brackets: Bracket[];
  edges: Edge[];
}

// ---- text metrics (Fraunces bold numerals, estimated) ----

const ROMAN_W: Record<string, number> = { I: 0.42, V: 0.74, i: 0.32, v: 0.58 };

export interface NumeralParts {
  acc: string;
  roman: string;
  /** °, ø or +, set as a superscript. */
  sym: string;
  /** 7, maj7…, set as a smaller superscript. */
  suffix: string;
}

export function numeralParts(numeral: string): NumeralParts {
  const m = /^([♭♯]?)([IViv]+)([°ø+]?)(.*)$/.exec(numeral);
  if (!m) return { acc: '', roman: numeral, sym: '', suffix: '' };
  return { acc: m[1], roman: m[2], sym: m[3], suffix: m[4] };
}

function numeralWidth(numeral: string, font: number): number {
  const p = numeralParts(numeral);
  let w = p.acc ? 0.4 : 0;
  for (const ch of p.roman) w += ROMAN_W[ch] ?? 0.6;
  w += p.sym ? 0.3 : 0;
  w += p.suffix.length * 0.29;
  return w * font;
}

const nameWidth = (name: string, font: number) => name.length * 0.6 * font;

/** A chord name set big: the root letter full size, its quality smaller (see ChordNode). */
function bigNameWidth(name: string, font: number): number {
  const m = /^([A-G])([♭♯]?)(.*)$/.exec(name);
  if (!m) return nameWidth(name, font);
  return (0.7 + (m[2] ? 0.36 : 0) + m[3].length * 0.34) * font;
}

/** A node's drawn size for its labels: the first in the big face, the second as the subtitle. */
export function nodeSize(r: ResolvedChord, labels: LabelKind[], lane = false): { w: number; h: number; font: number } {
  const font = lane ? LANE_FONT : FONT;
  const [main, sub] = labels;
  const h = (lane ? LANE_NODE_H : NODE_H)[sub ? 'names' : 'bare'];
  const mainW = main === 'notes' ? bigNameWidth(r.name, font) : numeralWidth(r.numeral, font);
  const subW = sub ? nameWidth(sub === 'notes' ? r.name : r.numeral, NAME_FONT) + 30 : 0;
  return { w: Math.max(h, Math.max(mainW + 34, subW)), h, font };
}

// ---- geometry helpers ----

type Pt = { x: number; y: number };

const fmt = (n: number) => Math.round(n * 10) / 10;

function unit(dx: number, dy: number) {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

/** Clear space between a road and the node it meets (Ways Home's gap). */
const gapFor = (kind: EdgeKind) => 3 + STROKE[kind] * 1.5;

/**
 * A cubic road from a to b with a filled arrowhead, sized like Ways Home's:
 * the stroke runs to b and the tip carries on a little past it, along the
 * last control point's tangent.
 */
function cubic(key: string, kind: EdgeKind, a: Pt, c1: Pt, c2: Pt, b: Pt, carries: string[], arrow = true): Edge {
  const d = `M${fmt(a.x)} ${fmt(a.y)}C${fmt(c1.x)} ${fmt(c1.y)} ${fmt(c2.x)} ${fmt(c2.y)} ${fmt(b.x)} ${fmt(b.y)}`;
  if (!arrow) return { key, kind, d, carries };
  const u = c2.x === b.x && c2.y === b.y ? unit(b.x - a.x, b.y - a.y) : unit(b.x - c2.x, b.y - c2.y);
  const w = STROKE[kind];
  const L = 3.5 + w * 2.6;
  const W = 2 + w * 1.5;
  const reach = gapFor(kind) * 0.6;
  const base = { x: b.x - u.x * L, y: b.y - u.y * L };
  const tip = [
    `${fmt(b.x + u.x * reach)},${fmt(b.y + u.y * reach)}`,
    `${fmt(base.x + u.y * W)},${fmt(base.y - u.x * W)}`,
    `${fmt(base.x - u.y * W)},${fmt(base.y + u.x * W)}`,
  ].join(' ');
  return { key, kind, d, carries, tip };
}

const line = (key: string, kind: EdgeKind, a: Pt, b: Pt, carries: string[]) => cubic(key, kind, a, a, b, b, carries);

/** Points along a road's path: one cubic, or several chained ("M… C… C…"), `n` per cubic. */
function sampleCubic(d: string, n = 48): Pt[] {
  const v = d.match(/-?[\d.]+/g)!.map(Number);
  const out: Pt[] = [];
  for (let at = 0; at + 8 <= v.length; at += 6) {
    const [a, c1, c2, b] = [0, 2, 4, 6].map((i) => ({ x: v[at + i], y: v[at + i + 1] }));
    for (let k = at ? 1 : 0; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      const f = (p: number, q: number, r: number, s: number) => u * u * u * p + 3 * u * u * t * q + 3 * u * t * t * r + t * t * t * s;
      out.push({ x: f(a.x, c1.x, c2.x, b.x), y: f(a.y, c1.y, c2.y, b.y) });
    }
  }
  return out;
}

/** A point on a node's rim at angle θ (radians, y down), offset outward by `out`: on the end cap facing θ. */
function rim(p: PlacedChord, theta: number, out = 0): Pt {
  const r = p.h / 2;
  const t = p.tilt ?? 0;
  const c = Math.max(0, (p.w - p.h) / 2) * Math.sign(Math.cos(theta - t));
  return { x: p.x + Math.cos(t) * c + Math.cos(theta) * (r + out), y: p.y + Math.sin(t) * c + Math.sin(theta) * (r + out) };
}

/** Distance from a node's centre to its edge, straight out at angle θ. */
function along(p: PlacedChord, theta: number): number {
  const r = p.h / 2;
  const c = Math.max(0, (p.w - p.h) / 2);
  const sin = Math.abs(Math.sin(theta - (p.tilt ?? 0)));
  const cos = Math.abs(Math.cos(theta - (p.tilt ?? 0)));
  if (c === 0) return r;
  if (sin > 1e-9 && (r / sin) * cos <= c) return r / sin;
  return c * cos + Math.sqrt(Math.max(0, r * r - c * c * sin * sin));
}

const pairs = (map: ProgressionMap, from: string, to: string) =>
  members(map, from).flatMap((a) => members(map, to).map((z) => `${a}>${z}`));

// ---- layout ----

export function layoutMap(
  map: ProgressionMap,
  resolved: Map<string, ResolvedChord>,
  opts: {
    labels: LabelKind[];
    borrowed: boolean;
    /** Gap before home (default: the even flow gap). The mandala opens it so arms clear the hub. */
    homeGap?: number;
    /** Draw home's "anywhere" fan (default true). */
    fan?: boolean;
    /** Scales how far arcs bow off the line (default 1). */
    arcScale?: number;
    /** Arcs into home meet it this many degrees off the flow line, not square on its top or bottom. */
    homeArc?: number;
    /** Nodes are drawn upright in a frame turned so their long axis lies at this angle (radians). */
    tilt?: number;
    /** Home's drawn width, when another map's home is drawn for it (the mandala's hub). */
    homeW?: number;
    /** Each slot's distance before home's centre, over the even gaps (the mandala's rings). */
    slotAt?: Array<number | undefined>;
  },
): MapLayout {
  const fan = opts.fan !== false;
  const home = homeId(map);
  const tilt = opts.tilt ?? 0;
  const gapAfter = (i: number) => (i === map.spine.length - 2 ? (opts.homeGap ?? GAP) : GAP);
  const node = (x: number, y: number, ch: MapChord, lane: boolean): PlacedChord => {
    const size = nodeSize(resolved.get(ch.id)!, opts.labels, lane);
    const { h, font } = size;
    const w = ch.id === home && opts.homeW ? opts.homeW : size.w;
    const c = (w - h) / 2;
    const hx = c * Math.abs(Math.cos(tilt)) + h / 2;
    const hy = c * Math.abs(Math.sin(tilt)) + h / 2;
    return { id: ch.id, x, y, w, h, font, lane, tilt, box: { left: x - hx, right: x + hx, top: y - hy, bottom: y + hy } };
  };
  const widthOf = (ch: MapChord, lane = false) => {
    const { box } = node(0, 0, ch, lane);
    return box.right - box.left;
  };
  const halfHeight = (ch: MapChord) => {
    const { box } = node(0, 0, ch, false);
    return (box.bottom - box.top) / 2;
  };

  // Slot widths (a bracket leaves room for its swap arrows), then centre the
  // spine and the fan across the view with an even gap for each flow arrow.
  const widths = map.spine.map((s) =>
    isGroup(s) ? Math.max(widthOf(s.top), widthOf(s.bottom)) + 2 * BRACKET_PAD : widthOf(s),
  );
  const total =
    widths.reduce((a, w) => a + w, 0) + widths.slice(1).reduce((a, _, i) => a + gapAfter(i), 0) + (fan ? FAN_W : 0);
  const width = Math.max(VIEW_W, total + 2 * MARGIN);
  let cursor = (width - total) / 2;

  const chords = new Map<string, PlacedChord>();
  const slotBox = new Map<string, Box>();
  const slotX = new Map<string, number>();
  const brackets: Bracket[] = [];

  const xs = map.spine.map((_, i) => {
    const x = cursor + widths[i] / 2;
    cursor += widths[i] + gapAfter(i);
    return x;
  });
  opts.slotAt?.forEach((d, i) => {
    if (d !== undefined) xs[i] = xs[xs.length - 1] - d;
  });

  map.spine.forEach((s, i) => {
    const x = xs[i];
    slotX.set(s.id, x);
    if (isGroup(s)) {
      // Tilted capsules stand taller, so the pair spreads to keep its gap.
      const dy = Math.max(MEMBER_DY, (halfHeight(s.top) + halfHeight(s.bottom)) / 2 + 20);
      const top = node(x, MAIN_Y - dy, s.top, false);
      const bottom = node(x, MAIN_Y + dy, s.bottom, false);
      chords.set(top.id, top);
      chords.set(bottom.id, bottom);
      const box = { left: x - widths[i] / 2, right: x + widths[i] / 2, top: top.box.top - 12, bottom: bottom.box.bottom + 12 };
      slotBox.set(s.id, box);
      brackets.push({ id: s.id, box });
    } else {
      const placed = node(x, MAIN_Y, s, false);
      chords.set(s.id, placed);
      slotBox.set(s.id, placed.box);
    }
  });

  const edges: Edge[] = [];
  const flowGap = gapFor('flow');

  // Flow arrows between neighbouring slots, along the main line: from a
  // bracket's side, or a chord's own edge.
  const edgeX = (id: string, side: 1 | -1) => {
    const p = chords.get(id);
    if (!p) return side > 0 ? slotBox.get(id)!.right : slotBox.get(id)!.left;
    return p.x + side * along(p, side > 0 ? 0 : Math.PI);
  };
  map.spine.forEach((s, i) => {
    if (i === 0) return;
    const prev = map.spine[i - 1];
    const a = { x: edgeX(prev.id, 1) + 4, y: MAIN_Y };
    const b = { x: edgeX(s.id, -1) - flowGap, y: MAIN_Y };
    edges.push(line(`f-${prev.id}-${s.id}`, 'flow', a, b, pairs(map, prev.id, s.id)));
  });

  // Swaps inside brackets: down the left side, back up the right, rim to rim.
  for (const s of map.spine) {
    if (!isGroup(s) || !s.swap) continue;
    const top = chords.get(s.top.id)!;
    const bottom = chords.get(s.bottom.id)!;
    const g = gapFor('swap');
    const deg = Math.PI / 180;
    const down = { a: rim(top, 128 * deg, 3), b: rim(bottom, 232 * deg, g) };
    const up = { a: rim(bottom, -52 * deg, 3), b: rim(top, 52 * deg, g) };
    const bow = 26;
    edges.push(
      cubic(`s-${s.id}-down`, 'swap', down.a, { x: down.a.x - bow, y: down.a.y + 20 }, { x: down.b.x - bow, y: down.b.y - 20 }, down.b, [
        `${s.top.id}>${s.bottom.id}`,
      ]),
      cubic(`s-${s.id}-up`, 'swap', up.a, { x: up.a.x + bow, y: up.a.y - 20 }, { x: up.b.x + bow, y: up.b.y + 20 }, up.b, [
        `${s.bottom.id}>${s.top.id}`,
      ]),
    );
  }

  // Arcs over or under the line. Arcs leave a bracket from its centre, above or
  // below its chord; an over-arc arrives on its left half, clear of the flow
  // arrow, and under-arcs meet at a bracket's bottom centre.
  // Each bows off the line, then lifts until it clears every slot it passes.
  const spineAt = (id: string) => map.spine.findIndex((s) => s.id === id || members(map, s.id).includes(id));
  for (const arc of map.arcs) {
    const over = arc.side === 'over';
    const sign = over ? -1 : 1;
    const anchor = (id: string, leaving: boolean) => {
      const box = slotBox.get(id)!;
      const x = slotX.get(id)!;
      const isGrp = brackets.some((br) => br.id === id);
      const shift = over && isGrp && !leaving ? (box.right - x) * -0.45 : 0;
      const gap = leaving ? 4 : gapFor('arc');
      const p = chords.get(id);
      if (p) return { x, y: p.y + sign * (along(p, (sign * Math.PI) / 2) + gap) };
      return { x: x + shift, y: over ? box.top - gap : box.bottom + gap };
    };
    const a = anchor(arc.from, true);
    const homeNode = chords.get(home)!;
    // Into home at an angle, it comes in along that ray (its own wedge of the
    // mandala's hub), opened past the last slot's corner when that stands taller.
    let ray: number | null = null;
    if (arc.to === home && opts.homeArc !== undefined) {
      const last = slotBox.get(map.spine[map.spine.length - 2].id)!;
      const corner = Math.atan2((over ? MAIN_Y - last.top : last.bottom - MAIN_Y) + ARC_CLEAR, homeNode.x - last.right);
      ray = Math.PI - sign * Math.max(opts.homeArc * (Math.PI / 180), corner);
    }
    const b = ray === null ? anchor(arc.to, false) : rim(homeNode, ray, gapFor('arc'));
    const [i0, i1] = [spineAt(arc.from), spineAt(arc.to)].sort((p, q) => p - q);
    const passed = map.spine.slice(i0 + 1, i1).map((s) => slotBox.get(s.id)!);
    const span = Math.abs(b.x - a.x);
    const lean = (a.x - b.x) * 0.16;
    const clears = (e: Edge) =>
      sampleCubic(e.d).every((p) =>
        passed.every((box) =>
          p.x < box.left - 10 || p.x > box.right + 10 || (over ? p.y <= box.top - ARC_CLEAR : p.y >= box.bottom + ARC_CLEAR),
        ),
      );
    let h = Math.min(190, Math.max(100, span * 0.42)) * (opts.arcScale ?? 1);
    let edge: Edge;
    do {
      const c1 = { x: a.x - lean * 0.4, y: a.y + sign * h };
      const c2 =
        ray === null
          ? { x: b.x + lean, y: b.y + sign * h }
          : rim(homeNode, ray, gapFor('arc') + (homeNode.h / 2 + h) / Math.sin(Math.abs(Math.PI - ray)));
      edge = cubic(`a-${arc.from}-${arc.to}`, 'arc', a, c1, c2, b, pairs(map, arc.from, arc.to));
      h += 8;
    } while (!clears(edge) && h < 600);
    edges.push(edge);
  }

  // Home goes anywhere: three arrows fan out to the right, into open space.
  const homeBox = slotBox.get(home)!;
  const fx = homeBox.right + 4;
  const reach = FAN_W - 30;
  if (fan) edges.push(
    line('fan-mid', 'fan', { x: fx, y: MAIN_Y }, { x: fx + reach, y: MAIN_Y }, [`${home}>*`]),
    cubic('fan-up', 'fan', { x: fx, y: MAIN_Y - 14 }, { x: fx + reach * 0.6, y: MAIN_Y - 14 }, { x: fx + reach * 0.78, y: MAIN_Y - 34 }, { x: fx + reach * 0.8, y: MAIN_Y - 92 }, [
      `${home}>*`,
    ]),
    cubic('fan-down', 'fan', { x: fx, y: MAIN_Y + 14 }, { x: fx + reach * 0.6, y: MAIN_Y + 14 }, { x: fx + reach * 0.78, y: MAIN_Y + 34 }, { x: fx + reach * 0.8, y: MAIN_Y + 92 }, [
      `${home}>*`,
    ]),
  );

  // Borrowed lane: each chord under the slot it stands in for, linked up to it.
  if (opts.borrowed) {
    const laneY = MAIN_Y + LANE_DY;
    const bySlot = new Map<string, typeof map.borrowed>();
    for (const bc of map.borrowed) bySlot.set(bc.slot, [...(bySlot.get(bc.slot) ?? []), bc]);
    // Side by side under the slot each stands in for, spaced by their own widths.
    const lane: Array<{ bc: (typeof map.borrowed)[number]; x: number; w: number }> = [];
    for (const [slot, list] of bySlot) {
      const ws = list.map((bc) => widthOf(bc, true));
      let x0 = slotX.get(slot)! - (ws.reduce((a, w) => a + w, 0) + LANE_GAP * (ws.length - 1)) / 2;
      list.forEach((bc, k) => {
        lane.push({ bc, x: x0 + ws[k] / 2, w: ws[k] });
        x0 += ws[k] + LANE_GAP;
      });
    }
    // Neighbouring slots can crowd: push overlaps apart, then recentre the run.
    lane.sort((a, b) => a.x - b.x);
    const before = lane.reduce((a, n) => a + n.x, 0);
    for (let i = 1; i < lane.length; i++) {
      const min = lane[i - 1].x + (lane[i - 1].w + lane[i].w) / 2 + LANE_GAP;
      if (lane[i].x < min) lane[i].x = min;
    }
    const drift = (lane.reduce((a, n) => a + n.x, 0) - before) / Math.max(1, lane.length);
    for (const { bc, x: lx } of lane) {
      const x = lx - drift;
      const placed = node(x, laneY, bc, true);
      chords.set(bc.id, placed);
      const target = slotBox.get(bc.slot)!;
      const tx = Math.min(target.right - 18, Math.max(target.left + 18, x));
      edges.push(
        cubic(
          `t-${bc.id}`,
          'twin',
          { x, y: placed.box.top - 4 },
          { x, y: placed.box.top - 56 },
          { x: tx, y: target.bottom + 56 },
          { x: tx, y: target.bottom + 4 },
          members(map, bc.slot).flatMap((t) => [`${t}>${bc.id}`, `${bc.id}>${t}`]),
          false,
        ),
      );
    }
    for (const [from, to] of map.borrowedMoves) {
      const a = chords.get(from)!;
      const z = chords.get(to)!;
      const pa = { x: a.x, y: a.box.bottom + 4 };
      const pz = { x: z.x, y: z.box.bottom + gapFor('lane') };
      const h = 54;
      edges.push(cubic(`l-${from}-${to}`, 'lane', pa, { x: pa.x, y: pa.y + h }, { x: pz.x, y: pz.y + h }, pz, [`${from}>${to}`]));
    }
  }

  const base = opts.borrowed ? BORROWED_HEIGHT : HEIGHT;
  const height = (base * width) / VIEW_W;
  return { viewBox: `0 ${fmt((base - height) / 2)} ${fmt(width)} ${fmt(height)}`, chords, brackets, edges };
}

// ---- portals ----

export const PORTAL_SCALE = 0.75;

export interface PortalLayout {
  viewBox: string;
  /** Full-size places, drawn at PORTAL_SCALE about their centres. */
  nodes: PlacedChord[];
  edges: Edge[];
}

/**
 * Portal chords in a band above the map (below it for chords that lead into a
 * bracket's lower member), each over the chord it resolves into; subs sit
 * beside the dominant they stand in for. A borrowed chord that is already a
 * dominant keeps its arrow on the map. The viewBox grows to hold the bands.
 */
export function layoutPortals(base: MapLayout, portals: Portals, labels: LabelKind[]): PortalLayout {
  const [vx, vy, vw, vh] = base.viewBox.split(' ').map(Number);
  const onMap = portals.moves.flatMap((m) => {
    const a = base.chords.get(m.from);
    const z = base.chords.get(m.to);
    return a && z ? [onMapArrow(base, a, z)] : [];
  });
  let top = Infinity;
  let bottom = -Infinity;
  for (const p of base.chords.values()) {
    top = Math.min(top, p.box.top);
    bottom = Math.max(bottom, p.box.bottom);
  }
  for (const e of [...base.edges, ...onMap]) {
    for (const p of sampleCubic(e.d, 16)) {
      top = Math.min(top, p.y);
      bottom = Math.max(bottom, p.y);
    }
  }
  const half = (NODE_H[labels[1] ? 'names' : 'bare'] * PORTAL_SCALE) / 2;
  const rows = { above: top - half - 34, below: bottom + half + 34 };

  const placed = new Map<string, PlacedChord>();
  const scaled = (p: PlacedChord): PlacedChord => ({ ...p, w: p.w * PORTAL_SCALE, h: p.h * PORTAL_SCALE });
  const byRow = { above: [] as PlacedChord[], below: [] as PlacedChord[] };
  for (const ch of portals.chords) {
    const target = base.chords.get(ch.into[0]);
    if (!target) continue;
    const side = target.y > MAIN_Y ? 'below' : 'above';
    const size = nodeSize(ch, labels);
    const dom = ch.standsFor ? placed.get(ch.standsFor) : undefined;
    const x = dom ? dom.x + ((dom.w + size.w) * PORTAL_SCALE) / 2 + 26 : target.x;
    const y = dom ? dom.y : rows[side];
    const p: PlacedChord = { id: ch.id, x, y, w: size.w, h: size.h, font: size.font, lane: false, box: { left: 0, right: 0, top: 0, bottom: 0 } };
    placed.set(ch.id, p);
    byRow[y < MAIN_Y ? 'above' : 'below'].push(p);
  }
  // Nudge neighbours in a band apart.
  for (const row of Object.values(byRow)) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const min = row[i - 1].x + ((row[i - 1].w + row[i].w) * PORTAL_SCALE) / 2 + 20;
      if (row[i].x < min) row[i].x = min;
    }
  }

  const edges: Edge[] = [...onMap];
  for (const ch of portals.chords) {
    const from = placed.get(ch.id);
    const dom = ch.standsFor ? (placed.get(ch.standsFor) ?? base.chords.get(ch.standsFor)) : undefined;
    if (from && dom && placed.has(ch.standsFor!)) {
      const a = scaled(from);
      const b = scaled(dom);
      edges.push(cubic(`pt-${ch.id}`, 'twin', rim(b, 0, 4), rim(b, 0, 4), rim(a, Math.PI, 4), rim(a, Math.PI, 4), [], false));
    }
  }
  for (const m of portals.moves) {
    const fromP = placed.get(m.from);
    const to = base.chords.get(m.to);
    if (!fromP || !to) continue;
    const a = scaled(fromP);
    const theta = Math.atan2(a.y - to.y, a.x - to.x);
    const kind = m.kind === 'secondary' ? 'portal' : m.kind;
    const start = rim(a, theta + Math.PI, 4);
    const end = rim(to, theta, gapFor(kind));
    const reach = Math.abs(end.y - start.y) * 0.45;
    const dir = a.y < to.y ? 1 : -1;
    edges.push(
      cubic(`p-${m.kind}-${m.from}-${m.to}`, kind, start, { x: start.x, y: start.y + dir * reach }, rim(to, theta, gapFor(kind) + reach), end, [`${m.from}>${m.to}`]),
    );
  }

  const nodes = [...placed.values()];
  const y0 = Math.min(vy, ...nodes.filter((p) => p.y < MAIN_Y).map((p) => p.y - half - 24));
  const y1 = Math.max(vy + vh, ...nodes.filter((p) => p.y > MAIN_Y).map((p) => p.y + half + 24));
  return { viewBox: `${fmt(vx)} ${fmt(y0)} ${fmt(vw)} ${fmt(y1 - y0)}`, nodes, edges };
}


/**
 * A borrowed chord's pull into a chord on the map. Into a chord on or below the
 * line: under both, deep enough to clear every chord between. Into a bracket's
 * top chord: up through the gap beside its bracket, then down onto it.
 */
function onMapArrow(base: MapLayout, a: PlacedChord, z: PlacedChord): Edge {
  const key = `p-on-${a.id}-${z.id}`;
  const carries = [`${a.id}>${z.id}`];
  if (z.y >= MAIN_Y) {
    // A chord whose bottom already takes a lane road is left or met from its outer side instead.
    const lanes = base.edges.filter((e) => e.kind === 'lane');
    const busy = (id: string) => lanes.some((e) => e.carries.some((c) => c.startsWith(`${id}>`) || c.endsWith(`>${id}`)));
    const way = z.x < a.x ? -1 : 1;
    const start = busy(a.id) ? rim(a, way < 0 ? 0 : Math.PI, 4) : { x: a.x, y: a.box.bottom + 4 };
    const end = busy(z.id) ? rim(z, way < 0 ? Math.PI : 0, gapFor('portal')) : { x: z.x, y: z.box.bottom + gapFor('portal') };
    const [lo, hi] = [Math.min(a.x, z.x), Math.max(a.x, z.x)];
    const between = [...base.chords.values()].filter((p) => p !== a && p !== z && p.box.right > lo && p.box.left < hi);
    const roads = lanes.flatMap((e) => sampleCubic(e.d, 40));
    const clear = (e: Edge) =>
      sampleCubic(e.d, 40)
        .slice(3, -3)
        .every(
          (q) =>
            between.every((p) => q.x < p.box.left - 12 || q.x > p.box.right + 12 || q.y > p.box.bottom + 18) &&
            roads.every((r) => Math.abs(q.x - r.x) > 8 || q.y > r.y + 16),
        );
    let h = 46;
    let e: Edge;
    do {
      const y = Math.max(start.y, end.y) + h;
      const c1 = busy(a.id) ? { x: start.x - way * 70, y } : { x: start.x, y };
      const c2 = busy(z.id) ? { x: end.x + way * 70, y } : { x: end.x, y };
      e = cubic(key, 'portal', start, c1, c2, end, carries);
      h += 8;
    } while (!clear(e) && h < 400);
    return e;
  }
  // Up through the gap on either side of its bracket: the side crossing fewer roads (and no chords), else the nearer.
  const slot = base.brackets.find((b) => b.box.left <= z.x && z.x <= b.box.right)!.box;
  const slots = [...base.brackets.map((b) => b.box), ...[...base.chords.values()].filter((p) => !p.lane && p.y === MAIN_Y).map((p) => p.box)];
  const route = (side: 1 | -1): Edge => {
    const next = slots
      .filter((b) => (side > 0 ? b.left >= slot.right : b.right <= slot.left))
      .sort((p, q) => (side > 0 ? p.left - q.left : q.right - p.right))[0];
    const edge = side > 0 ? slot.right : slot.left;
    const gx = next ? (edge + (side > 0 ? next.left : next.right)) / 2 : edge + side * 30;
    const peak = { x: gx, y: slot.top - 28 };
    const start = rim(a, gx < a.x ? Math.PI : 0, 4);
    const end = rim(z, -Math.PI / 2, gapFor('portal'));
    const turn = { x: gx, y: start.y };
    const up = cubic(`${key}-up`, 'portal', start, turn, turn, peak, [], false);
    const down = cubic(key, 'portal', peak, { x: gx, y: peak.y - 50 }, { x: z.x, y: end.y - 70 }, end, carries);
    return { ...down, d: up.d + down.d.replace(/^M[^C]+/, '') };
  };
  const others = [...base.chords.values()].filter((p) => p !== a && p !== z);
  const strokes = base.brackets.flatMap(({ box }) => [
    [{ x: box.left + 16, y: box.top }, { x: box.left, y: box.top }, { x: box.left, y: box.bottom }, { x: box.left + 16, y: box.bottom }],
    [{ x: box.right - 16, y: box.top }, { x: box.right, y: box.top }, { x: box.right, y: box.bottom }, { x: box.right - 16, y: box.bottom }],
  ]);
  const cost = (e: Edge) => {
    const path = sampleCubic(e.d, 40);
    const hits = path.filter((q) => others.some((p) => q.x > p.box.left - 6 && q.x < p.box.right + 6 && q.y > p.box.top - 6 && q.y < p.box.bottom + 6));
    const roads = base.edges.reduce((n, r) => n + crossings(path, sampleCubic(r.d, 40)), 0);
    return roads + 10 * strokes.reduce((n, st) => n + crossings(path, st), 0) + 100 * hits.length;
  };
  const near = route(a.x > z.x ? 1 : -1);
  const far = route(a.x > z.x ? -1 : 1);
  return cost(far) < cost(near) ? far : near;
}

/** How many times two polylines cross. */
function crossings(p: Pt[], q: Pt[]): number {
  const cut = (a: Pt, b: Pt, c: Pt, d: Pt) => {
    const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
    if (Math.abs(den) < 1e-9) return false;
    const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
    const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
    return t > 0 && t < 1 && u > 0 && u < 1;
  };
  let n = 0;
  for (let i = 1; i < p.length; i++) for (let j = 1; j < q.length; j++) if (cut(p[i - 1], p[i], q[j - 1], q[j])) n++;
  return n;
}
