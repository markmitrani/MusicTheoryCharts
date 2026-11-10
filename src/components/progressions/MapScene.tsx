'use client';

import { useId, useMemo, useState } from 'react';
import type { NoteName } from '@/lib/theory/note';
import {
  mapChords,
  mapMoves,
  resolveChord,
  type ProgressionMap,
  type ResolvedChord,
} from '@/lib/theory/progressions';
import { mapPortals, type PortalChord, type PortalKind } from '@/lib/theory/portals';
import { HaloFilter } from '@/components/cadence/FractalScene';
import { NAME_FONT, PORTAL_SCALE, STROKE, layoutMap, layoutPortals, numeralParts, type Edge, type LabelKind, type PlacedChord } from './layout';
import styles from './MapScene.module.scss';

interface MapSceneProps {
  map: ProgressionMap;
  root: NoteName;
  sevenths?: boolean;
  /** What nodes show, big face first: functions (numerals), notes (chord names) or both. */
  labels?: LabelKind[];
  borrowed?: boolean;
  /** Chord sounding right now. */
  playing?: string | null;
  /** Chord selected in the progression row: ringed like a hovered node. */
  picked?: string | null;
  /** The move being played: a pulse runs along its road. `n` restarts the pulse. */
  travel?: { from: string; to: string; n: number } | null;
  onChordClick?: (id: string) => void;
  /** Portals to draw off the map, and what a click on one does. */
  portals?: PortalKind[];
  onPortalClick?: (chord: PortalChord) => void;
  ariaLabel?: string;
}

const DEFAULT_LABELS: LabelKind[] = ['functions', 'notes'];

export const carriesMove = (e: Edge, from: string, to: string) =>
  e.carries.includes(`${from}>${to}`) || e.carries.includes(`${from}>*`);

/** Roads that carry a move; "anywhere" is one road, the fan's middle arrow. */
export const roadsFor = (edges: Edge[], from: string, to: string) =>
  edges.filter((e) => (e.kind !== 'fan' || e.key === 'fan-mid') && carriesMove(e, from, to));

/**
 * A progression map in the house language: Ways Home glass nodes in the
 * theme's surfaces, tinted by the mode, and roads in the mode's ink on its
 * gradient, laid out like the classic harmonic flow chart. Hovering a chord
 * lights where it can go next and dims the rest.
 */
export function MapScene({
  map,
  root,
  sevenths = false,
  labels = DEFAULT_LABELS,
  borrowed = false,
  playing = null,
  picked = null,
  travel = null,
  onChordClick,
  portals: portalKinds,
  onPortalClick,
  ariaLabel,
}: MapSceneProps) {
  const uid = useId().replace(/[:]/g, '');
  const [hovered, setHovered] = useState<string | null>(null);

  const resolved = useMemo(() => {
    const all = mapChords(map).map((ch) => resolveChord(map, ch, root, sevenths));
    return new Map(all.map((r) => [r.id, r]));
  }, [map, root, sevenths]);

  const layout = useMemo(() => layoutMap(map, resolved, { labels, borrowed }), [map, resolved, labels, borrowed]);
  const moves = useMemo(() => mapMoves(map, borrowed), [map, borrowed]);
  const portals = useMemo(
    () => (portalKinds?.length ? mapPortals(map, root, sevenths, borrowed, portalKinds) : null),
    [map, root, sevenths, borrowed, portalKinds],
  );
  const portalLayout = useMemo(() => (portals ? layoutPortals(layout, portals, labels) : null), [portals, layout, labels]);

  // Hover: the chord, everywhere it can go next, and the roads that take it there.
  const hoverTargets = useMemo(() => {
    if (!hovered) return null;
    const out = new Set<string>([hovered]);
    for (const m of portals?.moves ?? []) if (m.from === hovered) out.add(m.to);
    for (const m of moves) {
      const [from, to] = m.split('>');
      if (from === hovered) out.add(to);
    }
    if (layout.edges.some((e) => e.kind === 'fan' && e.carries.includes(`${hovered}>*`))) {
      for (const id of layout.chords.keys()) out.add(id);
    }
    return out;
  }, [hovered, moves, layout, portals]);

  const pulse = travel ? roadsFor(layout.edges, travel.from, travel.to)[0] : undefined;

  const mapNode = (p: PlacedChord, glassId: string, colourGlassId: string) => (
    <ChordNode
      key={p.id}
      chord={resolved.get(p.id)!}
      place={p}
      labels={labels}
      dim={!!hoverTargets && !hoverTargets.has(p.id)}
      hovered={hovered === p.id}
      picked={picked === p.id}
      playing={playing === p.id}
      glassId={glassId}
      colourGlassId={colourGlassId}
      haloId={`halo${uid}`}
      onEnter={() => setHovered(p.id)}
      onLeave={() => setHovered((h) => (h === p.id ? null : h))}
      onClick={onChordClick ? () => onChordClick(p.id) : undefined}
    />
  );

  const edgeLit = (e: Edge) => {
    if (!hovered) return true;
    return [...(hoverTargets ?? [])].some((to) => to !== hovered && carriesMove(e, hovered, to));
  };
  // Borrowed chords' roads (to the slot they stand in for, and between them) go with them.
  const outsideEdge = (e: Edge) => e.kind === 'twin' || e.kind === 'lane';
  const chordsIn = (lane: boolean) => [...layout.chords.values()].filter((p) => p.lane === lane);

  const bracketLit = (id: string) => {
    const slot = map.spine.find((s) => s.id === id);
    if (!hovered || !hoverTargets || !slot || !('top' in slot)) return true;
    return [slot.top.id, slot.bottom.id].some((c) => hoverTargets.has(c) || c === hovered);
  };

  return (
    <svg viewBox={portalLayout?.viewBox ?? layout.viewBox} width="100%" role="img" aria-label={ariaLabel} className={`${styles.svg} ${styles.tinted}`}>
      <defs>
        <HaloFilter id={`halo${uid}`} />
        {/* Ways Home glass: a light point top-left deepening into a tinted rim */}
        <Glass id={`glass${uid}`} />
        <Glass id={`colourGlass${uid}`} colour />
      </defs>

      {layout.brackets.map(({ id, box }) => {
        const tick = 16;
        return (
          <path
            key={id}
            className={styles.bracket}
            data-dim={bracketLit(id) ? undefined : ''}
            d={`M${box.left + tick} ${box.top}H${box.left}V${box.bottom}H${box.left + tick}M${box.right - tick} ${box.top}H${box.right}V${box.bottom}H${box.right - tick}`}
          />
        );
      })}

      {layout.edges
        .filter((e) => !outsideEdge(e))
        .map((e) => (
          <g key={e.key} className={styles.edge} data-kind={e.kind} data-dim={edgeLit(e) ? undefined : ''}>
            <path d={e.d} strokeWidth={STROKE[e.kind]} />
            {e.tip && <polygon points={e.tip} className={styles.tip} />}
          </g>
        ))}

      <g className={styles.outside}>
        {layout.edges.filter(outsideEdge).map((e) => (
          <g key={e.key} className={styles.edge} data-kind={e.kind} data-dim={edgeLit(e) ? undefined : ''}>
            <path d={e.d} strokeWidth={STROKE[e.kind]} />
            {e.tip && <polygon points={e.tip} className={styles.tip} />}
          </g>
        ))}
        {portalLayout?.edges.map((e) => (
          <g
            key={e.key}
            className={styles.edge}
            data-kind={e.kind}
            data-dim={hovered && !e.carries.some((c) => c.startsWith(`${hovered}>`)) ? '' : undefined}
          >
            <path d={e.d} strokeWidth={STROKE[e.kind]} />
            {e.tip && <polygon points={e.tip} className={styles.tip} />}
          </g>
        ))}
      </g>

      {pulse && travel && (
        <path
          key={`p${travel.n}`}
          d={pulse.d}
          pathLength={1}
          strokeWidth={STROKE[pulse.kind] + 2.6}
          className={styles.travel}
          style={{ ['--lit' as string]: 'var(--node)' }}
        />
      )}

      {chordsIn(false).map((p) => mapNode(p, `glass${uid}`, `colourGlass${uid}`))}

      <g className={`${styles.tinted} ${styles.outside}`}>
        <defs>
          <Glass id={`outsideGlass${uid}`} />
          <Glass id={`outsideColourGlass${uid}`} colour />
        </defs>
        {chordsIn(true).map((p) => mapNode(p, `outsideGlass${uid}`, `outsideColourGlass${uid}`))}
        {portalLayout?.nodes.map((p) => {
          const chord = portals!.chords.find((c) => c.id === p.id)!;
          return (
            <g key={p.id} data-portal="" transform={`translate(${p.x} ${p.y}) scale(${PORTAL_SCALE}) translate(${-p.x} ${-p.y})`}>
              <ChordNode
                chord={chord}
                place={p}
                labels={labels}
                dim={!!hovered && hovered !== p.id}
                hovered={hovered === p.id}
                picked={false}
                playing={playing === p.id}
                glassId={`outsideGlass${uid}`}
                colourGlassId={`outsideColourGlass${uid}`}
                haloId={`halo${uid}`}
                onEnter={() => setHovered(p.id)}
                onLeave={() => setHovered((h) => (h === p.id ? null : h))}
                onClick={onPortalClick ? () => onPortalClick(chord) : undefined}
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export interface ChordNodeProps {
  chord: ResolvedChord;
  place: PlacedChord;
  labels: LabelKind[];
  dim: boolean;
  hovered: boolean;
  picked: boolean;
  playing: boolean;
  glassId: string;
  /** Glass for chords holding the mode's colour note: the same recipe, twice as strong. */
  colourGlassId: string;
  /** An angular rim instead of the plain stroke: colour stops at angles (degrees, counterclockwise from →). */
  ring?: RingStop[];
  haloId: string;
  onEnter(): void;
  onLeave(): void;
  onClick?: () => void;
}

/**
 * One chord as a glass node (a circle, or a capsule when the label runs wide):
 * the numeral, its quality and 7th raised, the name beneath. Lights in its own
 * colour while it sounds, like a playing Ways Home node.
 */
export function ChordNode({ chord, place, labels, dim, hovered, picked, playing, glassId, colourGlassId, ring, haloId, onEnter, onLeave, onClick }: ChordNodeProps) {
  const { x, y, w, h, font, lane } = place;
  const [main, sub] = labels;
  const mainY = sub ? y - h * 0.11 : y;
  const subY = y + h * 0.25;
  const shape = { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: h / 2 };
  const inset = (d: number) => ({ x: shape.x + d, y: shape.y + d, width: w - 2 * d, height: h - 2 * d, rx: h / 2 - d });
  return (
    <g
      className={styles.node}
      data-dim={dim || undefined}
      data-lane={lane || undefined}
      data-hovered={hovered || undefined}
      data-picked={picked || undefined}
      data-colour={chord.colour || undefined}
      data-ring={ring ? '' : undefined}
      data-clickable={onClick ? '' : undefined}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${chord.numeral}, ${chord.name}` : undefined}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onPointerDown={onClick ? (e) => e.stopPropagation() : undefined}
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
    >
      <g className={styles.bloom} data-lit={playing || undefined} style={{ ['--lit' as string]: 'var(--node)' }}>
        <g className={styles.haloWrap}>
          <rect {...shape} className={styles.halo} filter={`url(#${haloId})`} />
        </g>
        <rect {...shape} className={styles.disc} />
        <rect {...inset(0.9)} fill={`url(#${chord.colour ? colourGlassId : glassId})`} pointerEvents="none" />
        <rect {...inset(1.4)} className={styles.litWash} />
        {ring && <AngularRim x={x} y={y} w={w} h={h} stops={ring} />}
        <text className={styles.numeral} x={x} y={mainY} style={{ fontSize: font }} textAnchor="middle" dominantBaseline="central">
          {main === 'notes' ? <BigName name={chord.name} /> : <BigNumeral numeral={chord.numeral} />}
        </text>
        {sub && (
          <text className={styles.name} x={x} y={subY} style={{ fontSize: NAME_FONT }} textAnchor="middle" dominantBaseline="central">
            <NameGlyphs text={sub === 'notes' ? chord.name : chord.numeral} />
          </text>
        )}
      </g>
    </g>
  );
}

export interface RingStop {
  angle: number;
  color: string;
}

const RIM_STEPS = 90;

/**
 * A rim whose colour turns with the angle: stops at their angles, blended
 * between neighbours all the way round (the last back to the first). Drawn as
 * short segments since SVG has no conic gradient; follows a circle or capsule.
 */
function AngularRim({ x, y, w, h, stops }: { x: number; y: number; w: number; h: number; stops: RingStop[] }) {
  const sorted = [...stops].map((s) => ({ ...s, angle: ((s.angle % 360) + 360) % 360 })).sort((a, b) => a.angle - b.angle);
  const r = h / 2;
  const flat = Math.max(0, w / 2 - r);
  // Where a ray from the centre leaves the capsule (a circle when flat = 0).
  const edge = (deg: number) => {
    const dx = Math.cos((deg * Math.PI) / 180);
    const dy = -Math.sin((deg * Math.PI) / 180);
    let t = Math.abs(dy) > 1e-6 ? r / Math.abs(dy) : Infinity;
    if (Math.abs(t * dx) > flat) {
      const c = Math.sign(dx) * flat;
      t = dx * c + Math.sqrt(Math.max(0, (dx * c) ** 2 - c * c + r * r));
    }
    return `${(x + t * dx).toFixed(2)} ${(y + t * dy).toFixed(2)}`;
  };
  const colourAt = (deg: number) => {
    const n = sorted.length;
    let k = n - 1;
    for (let i = 0; i < n; i++) if (sorted[i].angle <= deg) k = i;
    const a = sorted[k];
    const b = sorted[(k + 1) % n];
    const span = (b.angle - a.angle + 360) % 360 || 360;
    const f = ((deg - a.angle + 360) % 360) / span;
    return `color-mix(in srgb, ${a.color} ${((1 - f) * 100).toFixed(1)}%, ${b.color})`;
  };
  const step = 360 / RIM_STEPS;
  return (
    <g className={styles.rim} pointerEvents="none">
      {Array.from({ length: RIM_STEPS }, (_, i) => {
        const a0 = i * step;
        // a hair of overlap so neighbouring segments never show a seam
        return <path key={i} d={`M${edge(a0)}L${edge(a0 + step + 0.6)}`} style={{ stroke: colourAt(a0 + step / 2) }} />;
      })}
    </g>
  );
}

/** A numeral in the big face: accidental kerned in, quality and 7th raised. */
function BigNumeral({ numeral }: { numeral: string }) {
  const p = numeralParts(numeral);
  return (
    <>
      {p.acc && <tspan className={styles.acc}>{p.acc}</tspan>}
      <tspan dx={p.acc ? '-0.16em' : undefined}>{p.roman}</tspan>
      {p.sym && (
        <tspan className={styles.sym} dy="-0.42em">
          {p.sym}
        </tspan>
      )}
      {p.suffix && (
        <tspan className={styles.suffix} dy={p.sym ? '0.08em' : '-0.36em'}>
          {p.suffix}
        </tspan>
      )}
    </>
  );
}

/** A chord name in the big face: the root full size, its accidental and quality smaller. */
function BigName({ name }: { name: string }) {
  const m = /^([A-G])([♭♯]?)(.*)$/.exec(name);
  if (!m) return <>{name}</>;
  return (
    <>
      <tspan>{m[1]}</tspan>
      {m[2] && (
        <tspan className={styles.acc} dx="-0.12em">
          {m[2]}
        </tspan>
      )}
      {m[3] && (
        <tspan className={styles.quality} dx={m[2] ? '-0.18em' : '0.02em'}>
          <NameGlyphs text={m[3]} />
        </tspan>
      )}
    </>
  );
}

/**
 * Ways Home glass from the tones in scope: a light point top-left deepening
 * into a tinted rim. `colour` takes the doubled tones of colour chords.
 */
export function Glass({ id, colour = false }: { id: string; colour?: boolean }) {
  const t = colour ? '--colour' : '--node';
  return (
    <radialGradient id={id} cx="0.36" cy="0.32" r="0.7" fx="0.32" fy="0.28">
      <stop offset="0" style={{ stopColor: `var(${t}-hi)` }} />
      <stop offset="0.72" style={{ stopColor: `var(${t}-mid)` }} />
      <stop offset="1" style={{ stopColor: `var(${t}-rim)` }} />
    </radialGradient>
  );
}

/**
 * Empty space around each accidental's ink to kern away, in ems: `before` in
 * the accidental's own size, `after` in the name's (as FractalScene's Glyphs).
 */
const ACC_KERN: Record<string, { before: number; after: number }> = {
  '♭': { before: 0.28, after: 0.18 },
  '♯': { before: 0.1, after: 0.08 },
};

/** A chord name with every ♭/♯ set smaller and kerned in ("F♯m7♭5"): the UI face has none. */
function NameGlyphs({ text }: { text: string }) {
  const parts = text.split(/([♭♯])/).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        const kern = ACC_KERN[part];
        const prev = ACC_KERN[parts[i - 1]];
        const dx = kern ? -kern.before : prev ? -prev.after : 0;
        return (
          <tspan key={i} className={kern ? styles.nameAcc : undefined} dx={dx ? `${dx}em` : undefined}>
            {part}
          </tspan>
        );
      })}
    </>
  );
}
