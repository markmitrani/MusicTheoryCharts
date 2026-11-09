import type { NoteName } from '@/lib/theory/note';
import {
  getProgressionMap,
  homeId,
  mapChords,
  resolveChord,
  type ProgressionMap,
  type ResolvedChord,
} from '@/lib/theory/progressions';
import { layoutMap, nodeSize, type LabelKind, type MapLayout, type PlacedChord } from './layout';

/**
 * The mandala: every mode's map as one arm around a twin hub, I on the left
 * and i on the right (the same tonic). Clockwise the modes darken: Lydian
 * lowest on the left, up through major to Mixolydian, coming into I; then
 * Dorian at the top, down through minor and Phrygian to Locrian, into i.
 *
 * Each arm is that mode's own linear layout placed by one rigid transform:
 * rotated so its flow points at the hub (mirrored on the right, so its arcs
 * keep their sides). Roads and brackets take the transform; nodes are moved
 * by it but drawn upright.
 */

export interface ArmSpec {
  mode: string;
  side: 'major' | 'minor';
  /** Direction of the arm from its hub, degrees counterclockwise from →. */
  angle: number;
  /** Mirror the arm across its own axis, to send its long arc home into open space. */
  flip?: boolean;
}

export const ARMS: ArmSpec[] = [
  { mode: 'mixolydian', side: 'major', angle: 128 },
  { mode: 'major', side: 'major', angle: 180 },
  { mode: 'lydian', side: 'major', angle: 232 },
  { mode: 'dorian', side: 'minor', angle: 82, flip: true },
  { mode: 'minor', side: 'minor', angle: 29 },
  { mode: 'phrygian', side: 'minor', angle: -24 },
  { mode: 'locrian', side: 'minor', angle: -77 },
];

/** Hubs sit a node apart either side of the centre. */
const HUB_X = 64;
/** Opened gap into home, so arms clear the hub and each other near the centre. */
const HOME_GAP = 320;
const ARC_SCALE = 0.42;
/** Arcs into home arrive this far off their arm, inside its wedge (arms sit about 52° apart). */
const HOME_ARC = 24;
const LABEL_OUT = 96;
const MARGIN = 70;

type Pt = { x: number; y: number };

export interface Arm extends ArmSpec {
  map: ProgressionMap;
  layout: MapLayout;
  resolved: Map<string, ResolvedChord>;
  /** SVG transform for the arm's roads and brackets. */
  transform: string;
  /** Upright nodes at their mandala positions (home left out: the hub stands for it). */
  nodes: PlacedChord[];
  label: Pt & { anchor: 'start' | 'middle' | 'end' };
}

export interface MandalaLayout {
  arms: Arm[];
  hubs: { major: PlacedChord & { mode: string }; minor: PlacedChord & { mode: string } };
  hubResolved: { major: ResolvedChord; minor: ResolvedChord };
  viewBox: { x: number; y: number; w: number; h: number };
}

const rad = (deg: number) => (deg * Math.PI) / 180;

export function layoutMandala(root: NoteName, opts: { labels: LabelKind[]; sevenths: boolean }): MandalaLayout {
  // Every arm on a side comes home to the same hub: its home is laid out at the hub's size.
  const hubW = (mode: string) => {
    const map = getProgressionMap(mode);
    const home = mapChords(map).find((ch) => ch.id === homeId(map))!;
    return nodeSize(resolveChord(map, home, root, opts.sevenths), opts.labels).w;
  };
  const homeW = { major: hubW('major'), minor: hubW('minor') };

  const arms: Arm[] = ARMS.map((spec) => {
    const map = getProgressionMap(spec.mode);
    const resolved = new Map(mapChords(map).map((ch) => [ch.id, resolveChord(map, ch, root, opts.sevenths)]));
    // Flow (+x in the linear layout) must point from the arm's tip toward its hub.
    const turn = spec.side === 'major' ? 180 - spec.angle : -spec.angle;
    const mirror = spec.side === 'minor' ? -1 : 1;
    const flip = spec.flip ? -1 : 1;
    const layout = layoutMap(map, resolved, {
      labels: opts.labels,
      borrowed: false,
      homeGap: HOME_GAP,
      fan: false,
      arcScale: ARC_SCALE,
      homeArc: HOME_ARC,
      // Nodes stay upright on the page, so in the arm's frame they lie turned back.
      tilt: Math.atan2(-flip * Math.sin(rad(turn)), mirror * Math.cos(rad(turn))),
      homeW: homeW[spec.side],
      // Flat arcs leaving a bracket's shoulder would hug its top chord.
      centredArcs: true,
    });
    const home = layout.chords.get(homeId(map))!;
    const hub = { x: spec.side === 'major' ? -HUB_X : HUB_X, y: 0 };
    const cos = Math.cos(rad(turn));
    const sin = Math.sin(rad(turn));
    const place = (p: Pt): Pt => {
      const dx = (p.x - home.x) * mirror;
      const dy = (p.y - home.y) * flip;
      return { x: hub.x + dx * cos - dy * sin, y: hub.y + dx * sin + dy * cos };
    };
    const transform = `translate(${hub.x} ${hub.y}) rotate(${turn}) scale(${mirror} ${flip}) translate(${-home.x} ${-home.y})`;
    const nodes = [...layout.chords.values()]
      .filter((p) => p.id !== home.id)
      .map((p) => {
        const q = place(p);
        return { ...p, x: q.x, y: q.y, box: { left: q.x - p.w / 2, right: q.x + p.w / 2, top: q.y - p.h / 2, bottom: q.y + p.h / 2 } };
      });
    // The label sits beyond the arm's farthest node, along its direction.
    const dir = { x: Math.cos(rad(spec.angle)), y: -Math.sin(rad(spec.angle)) };
    const reach = Math.max(...nodes.map((n) => (n.x - hub.x) * dir.x + (n.y - hub.y) * dir.y));
    const lx = hub.x + dir.x * (reach + LABEL_OUT);
    const ly = hub.y + dir.y * (reach + LABEL_OUT);
    const anchor = Math.abs(dir.x) < 0.35 ? 'middle' : dir.x < 0 ? 'end' : 'start';
    return { ...spec, map, layout, resolved, transform, nodes, label: { x: lx, y: ly, anchor } };
  });

  // Hubs: each family's home, drawn once.
  const hubOf = (side: 'major' | 'minor') => {
    const arm = arms.find((a) => a.side === side && (a.mode === 'major' || a.mode === 'minor'))!;
    const home = arm.layout.chords.get(homeId(arm.map))!;
    const x = side === 'major' ? -HUB_X : HUB_X;
    return {
      placed: { ...home, x, y: 0, mode: arm.mode, box: { left: x - home.w / 2, right: x + home.w / 2, top: -home.h / 2, bottom: home.h / 2 } },
      resolved: arm.resolved.get(home.id)!,
    };
  };
  const major = hubOf('major');
  const minor = hubOf('minor');

  // Frame every node and label (labels get room for their text).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const arm of arms) {
    for (const n of arm.nodes) {
      grow(n.box.left, n.box.top);
      grow(n.box.right, n.box.bottom);
    }
    const textW = 180;
    const lx = arm.label.anchor === 'end' ? arm.label.x - textW : arm.label.anchor === 'start' ? arm.label.x + textW : arm.label.x;
    grow(lx, arm.label.y - 30);
    grow(lx, arm.label.y + 30);
  }
  const viewBox = { x: minX - MARGIN, y: minY - MARGIN, w: maxX - minX + 2 * MARGIN, h: maxY - minY + 2 * MARGIN };

  return { arms, hubs: { major: major.placed, minor: minor.placed }, hubResolved: { major: major.resolved, minor: minor.resolved }, viewBox };
}

/**
 * Conic gradient arguments with one colour stop per arm, at the arm's own
 * angle (CSS conic angles run clockwise from 12 o'clock), starting and closing
 * on the first arm so the circle has no seam: "from 8deg, c1 0deg, …, c1 360deg".
 * Used for the angular wash and the card's focus outline.
 */
export function conicStops(arms: ArmSpec[], colourOf: (mode: string) => string): string {
  const stops = arms
    .map((a) => ({ mode: a.mode, deg: (((90 - a.angle) % 360) + 360) % 360 }))
    .sort((a, b) => a.deg - b.deg);
  const start = stops[0].deg;
  const body = stops.map((s) => `${colourOf(s.mode)} ${(s.deg - start).toFixed(1)}deg`).join(', ');
  return `from ${start.toFixed(1)}deg, ${body}, ${colourOf(stops[0].mode)} 360deg`;
}

/** "from 24deg, …" → a conic gradient centred at `at` (any CSS position). */
export function conicAt(at: string, stops: string): string {
  const [from, ...rest] = stops.split(', ');
  return `conic-gradient(${from} at ${at}, ${rest.join(', ')})`;
}

/**
 * How warm each mode's node colour reads, 0 (cool) to 1 (warm). The focus
 * outline lets warm tones through strongly and cool ones only as a wash.
 */
export const MODE_WARMTH: Record<string, number> = {
  phrygian: 0.95,
  locrian: 0.9,
  major: 0.38,
  mixolydian: 0.38,
  lydian: 0.3,
  dorian: 0.3,
  minor: 0.3,
};

/**
 * The modes' angular gradient, centred at `at`: each mode's node colour at
 * the angle its arm sits in the mandala. `focus` weights each colour by its
 * warmth and lays the result over the theme's selected stroke.
 */
export function modeRing(at: string, kind: 'plain' | 'focus'): string {
  if (kind === 'plain') return conicAt(at, conicStops(ARMS, (mode) => `var(--prog-${mode}-node)`));
  const overlay = conicAt(
    at,
    conicStops(ARMS, (mode) => `color-mix(in srgb, var(--prog-${mode}-node) ${Math.round(MODE_WARMTH[mode] * 100)}%, transparent)`),
  );
  return `${overlay}, linear-gradient(var(--element-stroke-selected), var(--element-stroke-selected))`;
}
