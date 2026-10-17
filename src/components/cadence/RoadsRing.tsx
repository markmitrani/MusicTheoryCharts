'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CADENCES, mod12, numeral, rootName, type CadenceType } from '@/lib/theory/cadence';
import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import { useSurfaces } from '@/lib/use-surfaces';
import { Glyphs, GlassGradient } from './FractalScene';
import styles from './RoadsRing.module.scss';

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

/** Offset of each lane from the ring, at the road's midpoint. */
const LANE = 11;

/**
 * Bowed road from a to b. A neighbour road follows the ring's own curve, with
 * the dominant direction in the outer lane (the main way) and the plagal one in
 * the inner lane (the subway), symmetric about the ring. Longer roads curve
 * toward the ring's centre so they never run through the stops in between.
 */
function roadPath(a: { x: number; y: number }, b: { x: number; y: number }, type: CadenceType, neighbours: boolean) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  let q: { x: number; y: number };
  if (neighbours) {
    const dist = Math.hypot(mx - C, my - C);
    const nx = (mx - C) / dist;
    const ny = (my - C) / dist;
    // A quadratic's midpoint sits halfway to its control point.
    const lift = 2 * (R - dist + (type === 'dominant' ? LANE : -LANE));
    q = { x: mx + nx * lift, y: my + ny * lift };
  } else {
    const h = Math.min(0.22 * len, 36);
    const towardCentre = (C - mx) * uy - (C - my) * ux > 0 ? 1 : -1;
    q = { x: mx + uy * h * towardCentre, y: my - ux * h * towardCentre };
  }
  const trim = (p: { x: number; y: number }, r: number) => {
    const vx = q.x - p.x;
    const vy = q.y - p.y;
    const l = Math.hypot(vx, vy);
    return { x: p.x + (vx / l) * r, y: p.y + (vy / l) * r };
  };
  const s = trim(a, NODE_R + 2);
  const e = trim(b, NODE_R + 6);
  const tx = e.x - q.x;
  const ty = e.y - q.y;
  const tl = Math.hypot(tx, ty);
  const u = { x: tx / tl, y: ty / tl };
  const L = 10;
  const W = 5;
  const base = { x: e.x - u.x * L, y: e.y - u.y * L };
  const tip = `${e.x + u.x * 3},${e.y + u.y * 3} ${base.x + u.y * W},${base.y - u.x * W} ${base.x - u.y * W},${base.y + u.x * W}`;
  return { d: `M ${s.x} ${s.y} Q ${q.x} ${q.y} ${e.x} ${e.y}`, tip };
}

/**
 * The circle of fifths as a road map: each key a stop, each cadence a road.
 * Dominant and plagal roads join neighbours in opposite directions; the
 * backdoor skips two stops; the tritone sub crosses the circle. The ring
 * rotates (shortest way) to keep the centre key on top.
 */
export function RoadsRing({ centre, roads, ghostNeighbours = false, onRoadClick, onKeyDoubleClick, ariaLabel }: RoadsRingProps) {
  const glass = useSurfaces() === 'glass';
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
        const dim = hover !== null && hover !== i;
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
          </g>
        );
      })}

      {Array.from({ length: 12 }, (_, i) => {
        const pc = mod12(i * 7);
        const { x, y } = place(pc, rot);
        const isCentre = pc === 0;
        const touched = roads.some((r) => r.from === pc || r.to === pc);
        const key = NOTE_NAMES[mod12(centreIdx + pc)];
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
            <circle r={NODE_R} className={styles.disc} />
            {glass && <circle r={NODE_R - 0.7} fill={`url(#${isCentre ? 'glassc' : 'glass'}${uid})`} pointerEvents="none" />}
            <text className={styles.name} data-serif={isCentre || undefined} y={-5} dominantBaseline="central" textAnchor="middle">
              <Glyphs text={rootName(pc, centre)} />
            </text>
            <text className={styles.numeral} y={13} dominantBaseline="central" textAnchor="middle">
              {numeral(pc)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
