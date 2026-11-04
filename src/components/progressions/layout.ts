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

/** A node shows its labels in order: the first in the big face, the second (if any) as the subtitle. */
export type { LabelKind };

/** Stroke widths by kind; arrowheads scale with them, as on Ways Home. */
export const STROKE: Record<EdgeKind, number> = { flow: 4, arc: 4, fan: 4, swap: 3, lane: 3, twin: 2.4 };

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
  w: number;
  h: number;
  font: number;
  box: Box;
  lane: boolean;
}

export interface Bracket {
  id: string;
  box: Box;
}

export type EdgeKind = 'flow' | 'arc' | 'swap' | 'fan' | 'twin' | 'lane';

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

/** A point on a node's rim at angle θ (radians, y down), offset outward by `out`. */
function rim(p: PlacedChord, theta: number, out = 0): Pt {
  const r = p.h / 2;
  const cx = p.x + Math.sign(Math.cos(theta)) * Math.max(0, (p.w - p.h) / 2);
  return { x: cx + Math.cos(theta) * (r + out), y: p.y + Math.sin(theta) * (r + out) };
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
  },
): MapLayout {
  const fan = opts.fan !== false;
  const gapAfter = (i: number) => (i === map.spine.length - 2 ? (opts.homeGap ?? GAP) : GAP);
  const node = (x: number, y: number, ch: MapChord, lane: boolean): PlacedChord => {
    const r = resolved.get(ch.id)!;
    const font = lane ? LANE_FONT : FONT;
    const [main, sub] = opts.labels;
    const h = (lane ? LANE_NODE_H : NODE_H)[sub ? 'names' : 'bare'];
    const mainW = main === 'notes' ? bigNameWidth(r.name, font) : numeralWidth(r.numeral, font);
    const subW = sub ? nameWidth(sub === 'notes' ? r.name : r.numeral, NAME_FONT) + 30 : 0;
    const label = Math.max(mainW + 34, subW);
    const w = Math.max(h, label);
    return { id: ch.id, x, y, w, h, font, lane, box: { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 } };
  };
  const widthOf = (ch: MapChord, lane = false) => node(0, 0, ch, lane).w;

  // Slot widths (a bracket leaves room for its swap arrows), then centre the
  // spine and the fan across the view with an even gap for each flow arrow.
  const home = homeId(map);
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

  map.spine.forEach((s, i) => {
    const x = cursor + widths[i] / 2;
    cursor += widths[i] + gapAfter(i);
    slotX.set(s.id, x);
    if (isGroup(s)) {
      const top = node(x, MAIN_Y - MEMBER_DY, s.top, false);
      const bottom = node(x, MAIN_Y + MEMBER_DY, s.bottom, false);
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

  // Flow arrows between neighbouring slots, along the main line.
  map.spine.forEach((s, i) => {
    if (i === 0) return;
    const prev = map.spine[i - 1];
    const a = { x: slotBox.get(prev.id)!.right + 4, y: MAIN_Y };
    const b = { x: slotBox.get(s.id)!.left - flowGap, y: MAIN_Y };
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

  // Arcs over or under the line. A group's over-arc leaves from its right half,
  // so it clears the flow arrow; under-arcs meet at a bracket's bottom centre.
  for (const arc of map.arcs) {
    const over = arc.side === 'over';
    const anchor = (id: string, leaving: boolean) => {
      const box = slotBox.get(id)!;
      const x = slotX.get(id)!;
      const isGrp = brackets.some((br) => br.id === id);
      const shift = over && isGrp ? (box.right - x) * (leaving ? 0.45 : -0.45) : 0;
      const gap = leaving ? 4 : gapFor('arc');
      return { x: x + shift, y: over ? box.top - gap : box.bottom + gap };
    };
    const a = anchor(arc.from, true);
    const b = anchor(arc.to, false);
    const span = Math.abs(b.x - a.x);
    const h = Math.min(190, Math.max(100, span * 0.42)) * (opts.arcScale ?? 1) * (over ? -1 : 1);
    const lean = (a.x - b.x) * 0.16;
    edges.push(
      cubic(`a-${arc.from}-${arc.to}`, 'arc', a, { x: a.x - lean * 0.4, y: a.y + h }, { x: b.x + lean, y: b.y + h }, b, pairs(map, arc.from, arc.to)),
    );
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
