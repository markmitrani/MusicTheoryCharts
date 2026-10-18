'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CADENCES, mod12, numeral, rootName, type CadenceType } from '@/lib/theory/cadence';
import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import { useSurfaces } from '@/lib/use-surfaces';
import { Glyphs, GlassGradient } from './FractalScene';
import styles from './RoadsRing.module.scss';

/** A stop lit while its chord sounds; `road` (see roadId) carries the travelling pulse. */
export interface RingLight {
  pc: number;
  color: string;
  /** Carries the travelling pulse (first stop only). */
  road?: string;
  /** The road being played: the others dim until it ends. */
  focus?: string;
}

export const roadId = (r: { from: number; to: number; type: CadenceType }) => `${r.from}-${r.to}-${r.type}`;

/** Lights for playing a road: its start stop (with the pulse along it), then its end stop. */
export function roadLights(r: Road): RingLight[] {
  const color = CADENCES[r.type].colorVar;
  const id = roadId(r);
  return [
    { pc: r.from, color, road: id, focus: id },
    { pc: r.to, color, focus: id },
  ];
}

/** A directed road between two keys, pitch classes relative to the centre. */
export interface Road {
  from: number;
  to: number;
  type: CadenceType;
  /** Seconds before the road draws on. */
  delay?: number;
}

interface RoadsRingProps {
  /** Key at the top of the ring; names are spelled in it. */
  centre: NoteName;
  roads: Road[];
  /** Faint two-way roads between every pair of neighbours. */
  ghostNeighbours?: boolean;
  onRoadClick?: (road: Road) => void;
  /** Stop sounding right now (pitch class relative to the centre), lit in its road's colour. */
  playing?: RingLight | null;
  /** Double click a key: make it the centre. */
  onKeyDoubleClick?: (key: NoteName) => void;
  ariaLabel?: string;
}

const VIEW = 600;
const C = VIEW / 2;
const R = 236;
const NODE_R = 31;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Fifths steps from the centre for a relative pitch class (C→G is +1). */
const fifthsOf = (pc: number) => mod12(pc * 7);
const isNeighbour = (r: { from: number; to: number }) => {
  const d = fifthsOf(r.to - r.from);
  return d === 1 || d === 11;
};

function place(pc: number, rot: number) {
  const a = rad(-90 + fifthsOf(pc) * 30 + rot);
  return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
}

/** How far each lane bulges off the ring at the road's midpoint. */
const LANE = 14;
/** Roads leave a stop's edge and end with the arrow tip touching the next one. */
const TIP = 3;
const START_GAP = NODE_R + 1;
const END_GAP = NODE_R + 1 + TIP;

type Pt = { x: number; y: number };

function arrowTip(e: Pt, u: Pt) {
  const L = 10;
  const W = 5;
  const base = { x: e.x - u.x * L, y: e.y - u.y * L };
  return `${e.x + u.x * TIP},${e.y + u.y * TIP} ${base.x + u.y * W},${base.y - u.x * W} ${base.x - u.y * W},${base.y + u.x * W}`;
}

/**
 * Neighbour road: rides the ring itself, bulging off it by the same amount on
 * either side (outer lane for dominant, the main way; inner lane for plagal,
 * the subway). The two directions of one road are mirror images about the
 * ring line. Sampled as a polyline and trimmed at the stops' edges.
 */
function laneRoad(a: Pt, b: Pt, type: CadenceType) {
  const ta = Math.atan2(a.y - C, a.x - C);
  let dt = Math.atan2(b.y - C, b.x - C) - ta;
  while (dt > Math.PI) dt -= 2 * Math.PI;
  while (dt < -Math.PI) dt += 2 * Math.PI;
  const side = type === 'dominant' ? 1 : -1;
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const r = R + side * LANE * Math.sin(Math.PI * t);
    const th = ta + dt * t;
    pts.push({ x: C + r * Math.cos(th), y: C + r * Math.sin(th) });
  }
  const dist = (p: Pt, q: Pt) => Math.hypot(p.x - q.x, p.y - q.y);
  // Exact point between two samples where the path crosses distance d from a stop.
  const cross = (inside: Pt, outside: Pt, stop: Pt, d: number): Pt => {
    const di = dist(inside, stop);
    const k = (d - di) / (dist(outside, stop) - di);
    return { x: inside.x + (outside.x - inside.x) * k, y: inside.y + (outside.y - inside.y) * k };
  };
  const i0 = pts.findIndex((p) => dist(p, a) >= START_GAP);
  let i1 = pts.length - 1;
  while (dist(pts[i1], b) < END_GAP) i1--;
  const kept = [
    cross(pts[i0 - 1], pts[i0], a, START_GAP),
    ...pts.slice(i0, i1 + 1),
    cross(pts[i1 + 1], pts[i1], b, END_GAP),
  ];
  const e = kept[kept.length - 1];
  const prev = kept[kept.length - 3];
  const l = Math.hypot(e.x - prev.x, e.y - prev.y);
  return {
    d: kept.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '),
    tip: arrowTip(e, { x: (e.x - prev.x) / l, y: (e.y - prev.y) / l }),
  };
}

/** Longer road: a gentle bow toward the ring's centre, clear of the stops between. */
function chordRoad(a: Pt, b: Pt) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const h = Math.min(0.22 * len, 36);
  const side = (C - mx) * uy - (C - my) * ux > 0 ? 1 : -1;
  const q = { x: mx + uy * h * side, y: my - ux * h * side };
  const trim = (p: Pt, r: number) => {
    const vx = q.x - p.x;
    const vy = q.y - p.y;
    const l = Math.hypot(vx, vy);
    return { x: p.x + (vx / l) * r, y: p.y + (vy / l) * r };
  };
  const s0 = trim(a, START_GAP);
  const e = trim(b, END_GAP);
  const tl = Math.hypot(e.x - q.x, e.y - q.y);
  return { d: `M ${s0.x} ${s0.y} Q ${q.x} ${q.y} ${e.x} ${e.y}`, tip: arrowTip(e, { x: (e.x - q.x) / tl, y: (e.y - q.y) / tl }) };
}

function roadPath(a: Pt, b: Pt, type: CadenceType, neighbours: boolean) {
  return neighbours ? laneRoad(a, b, type) : chordRoad(a, b);
}

/**
 * The circle of fifths as a road map: each key a stop, each cadence a road.
 * Dominant and plagal roads join neighbours in opposite directions; the
 * backdoor skips two stops; the tritone sub crosses the circle. The ring
 * rotates (shortest way) to keep the centre key on top.
 */
export function RoadsRing({
  centre,
  roads,
  ghostNeighbours = false,
  onRoadClick,
  playing = null,
  onKeyDoubleClick,
  ariaLabel,
}: RoadsRingProps) {
  const glass = useSurfaces() === 'glass';
  // Last colour each stop glowed in, so it fades out in that colour.
  const litColors = useRef(new Map<number, string>());
  const uid = useId().replace(/[:]/g, '');
  const centreIdx = NOTE_NAMES.indexOf(centre);
  // Rotation in degrees; labels and roads are recomputed per frame while it turns.
  const rotRef = useRef({ centreIdx });
  const [rot, setRot] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const prev = rotRef.current.centreIdx;
    if (prev === centreIdx) return;
    // The old centre's position, seen from the new centre, spun back to the top.
    let delta = fifthsOf(prev - centreIdx) * 30;
    if (delta > 180) delta -= 360;
    rotRef.current.centreIdx = centreIdx;
    const o = { v: -delta };
    setRot(o.v);
    const tween = gsap.to(o, { v: 0, duration: 0.7, ease: 'power3.inOut', onUpdate: () => setRot(o.v) });
    return () => {
      tween.kill();
    };
  }, [centreIdx]);

  const ghosts: Road[] = ghostNeighbours
    ? Array.from({ length: 12 }, (_, i) => {
        const a = mod12(i * 7);
        const b = mod12(a + 7);
        return [
          { from: b, to: a, type: 'dominant' as const },
          { from: a, to: b, type: 'plagal' as const },
        ];
      }).flat()
    : [];

  const isLive = (r: Road) => roads.some((x) => x.from === r.from && x.to === r.to && x.type === r.type);

  return (
    <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" role="img" aria-label={ariaLabel ?? 'Roads on the circle of fifths'} className={styles.svg}>
      {glass && (
        <defs>
          <GlassGradient id={`glass${uid}`} color="var(--accent-warm)" quiet />
          <GlassGradient id={`glassc${uid}`} color="var(--accent)" quiet />
        </defs>
      )}
      <circle cx={C} cy={C} r={R} className={styles.ring} />

      {ghosts.filter((g) => !isLive(g)).map((g) => {
        const p = roadPath(place(g.from, rot), place(g.to, rot), g.type, true);
        return (
          <g key={`g${g.from}-${g.to}`} className={styles.ghost} style={{ color: CADENCES[g.type].colorVar }}>
            <path d={p.d} />
            <polygon points={p.tip} />
          </g>
        );
      })}

      {roads.map((r, i) => {
        const p = roadPath(place(r.from, rot), place(r.to, rot), r.type, isNeighbour(r));
        const dim = playing?.focus ? playing.focus !== roadId(r) : hover !== null && hover !== i;
        return (
          <g
            key={`${centre}-${r.from}-${r.to}-${r.type}`}
            className={styles.road}
            data-clickable={onRoadClick ? true : undefined}
            data-dim={dim || undefined}
            style={{ color: CADENCES[r.type].colorVar, ['--delay' as string]: `${r.delay ?? 0}s` }}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            onPointerDown={onRoadClick ? (e) => e.stopPropagation() : undefined}
            onClick={
              onRoadClick
                ? (e) => {
                    e.stopPropagation();
                    onRoadClick(r);
                  }
                : undefined
            }
          >
            <path d={p.d} className={styles.hit} />
            <path d={p.d} pathLength={1} className={styles.line} />
            <polygon points={p.tip} className={styles.tip} />
            {playing?.road === roadId(r) && (
              <path
                key={`t${playing.pc}`}
                d={p.d}
                pathLength={1}
                strokeWidth={5.5}
                className={styles.travel}
                style={{ ['--lit' as string]: playing.color }}
              />
            )}
          </g>
        );
      })}

      {Array.from({ length: 12 }, (_, i) => {
        const pc = mod12(i * 7);
        const { x, y } = place(pc, rot);
        const isCentre = pc === 0;
        const touched = roads.some((r) => r.from === pc || r.to === pc);
        const key = NOTE_NAMES[mod12(centreIdx + pc)];
        const isLit = playing?.pc === pc;
        if (isLit) litColors.current.set(pc, playing!.color);
        return (
          <g
            key={i}
            transform={`translate(${x} ${y})`}
            className={styles.key}
            data-centre={isCentre || undefined}
            data-quiet={(!touched && !isCentre) || undefined}
            data-clickable={onKeyDoubleClick && !isCentre ? true : undefined}
            onPointerDown={onKeyDoubleClick ? (e) => e.stopPropagation() : undefined}
            onDoubleClick={
              onKeyDoubleClick && !isCentre
                ? (e) => {
                    e.stopPropagation();
                    onKeyDoubleClick(key);
                  }
                : undefined
            }
          >
            <g
              className={styles.bloom}
              style={{ ['--lit' as string]: litColors.current.get(pc) ?? 'var(--accent)' }}
              data-lit={isLit || undefined}
            >
              <g className={styles.haloWrap}>
                <circle r={NODE_R} className={styles.halo} />
              </g>
              <circle r={NODE_R} className={styles.disc} />
              {glass && (
                <circle
                  r={NODE_R - 0.7}
                  fill={`url(#${isCentre ? 'glassc' : 'glass'}${uid})`}
                  opacity={!touched && !isCentre ? 0.45 : 1}
                  pointerEvents="none"
                />
              )}
              <circle r={NODE_R - 1.3} className={styles.litWash} />
              <text className={styles.name} data-serif={isCentre || undefined} y={-5} dominantBaseline="central" textAnchor="middle">
                <Glyphs text={rootName(pc, centre)} />
              </text>
              <text className={styles.numeral} y={13} dominantBaseline="central" textAnchor="middle">
                {numeral(pc)}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
