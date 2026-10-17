'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CADENCES, CADENCE_TYPES, type CadenceType, type Direction, type WalkStep } from '@/lib/theory/cadence';
import { useSurfaces } from '@/lib/use-surfaces';
import { buildScene, VIEW, type Frame } from './geometry';
import styles from './FractalScene.module.scss';

export interface NodeLabel {
  main: string;
  sub?: string;
}

interface FractalSceneProps {
  /** Absolute path from I to the centre. Changes animate as zooms. */
  walk: WalkStep[];
  dir: Direction;
  labelFor: (pc: number) => NodeLabel;
  interactive?: boolean;
  /** Single click: hear the move. */
  onNodeClick?: (rel: CadenceType[]) => void;
  /** Double click: travel there (re-centre). */
  onNodeDoubleClick?: (rel: CadenceType[]) => void;
  /** Deepest level visible at rest (2 = labelled levels, 3 adds faint dots). */
  maxLevel?: number;
  /** Level-1 corners shown; deeper nodes follow their corner. */
  corners?: CadenceType[] | null;
  /** Path (relative to the centre) to light up when nothing is hovered. */
  highlight?: CadenceType[] | null;
  ariaLabel?: string;
}

type Plan =
  | { kind: 'flip'; dir: Direction }
  | { kind: 'zoom'; mode: 'in' | 'out'; steps: WalkStep[] }
  | { kind: 'fade'; frame: Frame };

interface Zoom {
  mode: 'in' | 'out';
  root: Frame;
  rel: CadenceType[];
  e: number;
  end: Frame;
}

const walkKey = (w: WalkStep[]) => w.map((s) => `${s.dir[0]}${s.type[0]}`).join('');
const sameDir = (steps: WalkStep[]) => steps.every((s) => s.dir === steps[0].dir);

function commonPrefix(a: WalkStep[], b: WalkStep[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i].dir === b[i].dir && a[i].type === b[i].type) i++;
  return i;
}

/** Steps that animate the displayed frame into the requested one. */
function plan(from: Frame, to: Frame): Plan[] {
  const n = commonPrefix(from.walk, to.walk);
  const flipTo = (d: Direction, cur: Direction): Plan[] => (d === cur ? [] : [{ kind: 'flip', dir: d }]);
  if (n === from.walk.length && n === to.walk.length) return flipTo(to.dir, from.dir);
  if (n === from.walk.length) {
    const added = to.walk.slice(n);
    if (sameDir(added) && added.length <= 2) {
      const d = added[0].dir;
      return [...flipTo(d, from.dir), { kind: 'zoom', mode: 'in', steps: added }, ...flipTo(to.dir, d)];
    }
  } else if (n === to.walk.length) {
    const removed = from.walk.slice(n);
    if (sameDir(removed)) {
      const d = removed[0].dir;
      return [...flipTo(d, from.dir), { kind: 'zoom', mode: 'out', steps: removed }, ...flipTo(to.dir, d)];
    }
  }
  return [{ kind: 'fade', frame: to }];
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const DOUBLE_CLICK_MS = 240;

/**
 * Glass-mode node fill: a subtle radial wash of the node's own colour,
 * brighter toward the top-left and deepening into a tinted rim (the inner
 * shadow). Object-bounding-box units, so one gradient fits every radius.
 */
export function GlassGradient({
  id,
  color,
  up = color,
  quiet = false,
}: {
  id: string;
  color: string;
  /** Brighter tone the highlight starts from (deep colours go muddy otherwise). */
  up?: string;
  quiet?: boolean;
}) {
  const [hi, mid, rim] = quiet ? [20, 6, 14] : [42, 22, 34];
  return (
    <radialGradient id={id} cx="0.36" cy="0.32" r="0.7" fx="0.32" fy="0.28">
      <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${up} ${hi}%, var(--element-fill))` }} />
      <stop offset="0.72" style={{ stopColor: `color-mix(in srgb, ${color} ${mid}%, var(--element-fill))` }} />
      <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${color} ${rim}%, var(--canvas-bg))` }} />
    </radialGradient>
  );
}

/**
 * Numerals and names with their accidentals set tight: the display face has
 * no ♭/♯, so the fallback glyph is drawn smaller and kerned in.
 */
export function Glyphs({ text }: { text: string }) {
  const m = /^([♭♯]?)([^♭♯]+)([♭♯]?)(.*)$/.exec(text);
  if (!m || (!m[1] && !m[3])) return <>{text}</>;
  return (
    <>
      {m[1] && <tspan className={styles.acc}>{m[1]}</tspan>}
      <tspan dx={m[1] ? '-0.04em' : undefined}>{m[2]}</tspan>
      {m[3] && (
        <tspan className={styles.acc} dx="0.02em">
          {m[3]}
        </tspan>
      )}
      {m[4] && <tspan>{m[4]}</tspan>}
    </>
  );
}

/**
 * The Ways Home fractal. Controlled by `walk` + `dir`: appending steps zooms
 * into the chosen corner, truncating zooms back out, changing `dir` flips
 * every arrow. Each zoom tweens a camera, then re-roots at the target; the
 * layout is self-similar, so the handoff is invisible.
 */
export function FractalScene({
  walk,
  dir,
  labelFor,
  interactive = false,
  onNodeClick,
  onNodeDoubleClick,
  maxLevel = 2,
  corners = null,
  highlight = null,
  ariaLabel = 'Ways home fractal',
}: FractalSceneProps) {
  const glass = useSurfaces() === 'glass';
  const uid = useId().replace(/[:]/g, '');
  const [shown, setShown] = useState<Frame>({ walk, dir });
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const zoomRef = useRef<Zoom | null>(null);
  const [, setTick] = useState(0);
  const [fade, setFade] = useState(1);
  const [hovered, setHovered] = useState<string | null>(null);
  const tweenRef = useRef<gsap.core.Tween | gsap.core.Timeline | null>(null);
  const runRef = useRef(0);
  // A single click waits out the double-click window so the two never both fire.
  const clickTimer = useRef<number | undefined>(undefined);

  // Mount animations only for elements that appear while idle (reveals,
  // flips) — never for nodes born mid-zoom, whose opacity the camera drives.
  const bornRef = useRef(new Map<string, boolean>());
  const seenRef = useRef(new Set<string>());

  const requestedKey = `${walkKey(walk)}|${dir}`;
  useEffect(() => {
    const token = ++runRef.current;
    tweenRef.current?.kill();
    if (zoomRef.current) {
      const end = zoomRef.current.end;
      zoomRef.current = null;
      shownRef.current = end;
      setShown(end);
    }
    setFade(1);
    const target: Frame = { walk, dir };
    const steps = plan(shownRef.current, target);
    if (steps.length === 0) return;

    const alive = () => runRef.current === token;
    const wait = (s: number) => new Promise<void>((r) => (tweenRef.current = gsap.delayedCall(s, r) as unknown as gsap.core.Tween));
    const commit = (f: Frame) => {
      shownRef.current = f;
      setShown(f);
    };

    (async () => {
      for (const step of steps) {
        if (!alive()) return;
        const cur = shownRef.current;
        setHovered(null);
        if (step.kind === 'flip') {
          commit({ walk: cur.walk, dir: step.dir });
          await wait(0.55);
        } else if (step.kind === 'zoom') {
          const end: Frame =
            step.mode === 'in'
              ? { walk: [...cur.walk, ...step.steps], dir: cur.dir }
              : { walk: cur.walk.slice(0, cur.walk.length - step.steps.length), dir: cur.dir };
          const z: Zoom = {
            mode: step.mode,
            root: step.mode === 'in' ? cur : end,
            rel: step.steps.map((s) => s.type),
            e: 0,
            end,
          };
          zoomRef.current = z;
          await new Promise<void>((resolve) => {
            tweenRef.current = gsap.to(z, {
              e: 1,
              duration: 0.55 + 0.25 * Math.min(z.rel.length, 3),
              ease: 'power3.inOut',
              onUpdate: () => setTick((t) => t + 1),
              onComplete: resolve,
            });
          });
          if (!alive()) return;
          zoomRef.current = null;
          commit(end);
        } else {
          const o = { v: 1 };
          await new Promise<void>((resolve) => {
            tweenRef.current = gsap.to(o, { v: 0, duration: 0.18, ease: 'power2.in', onUpdate: () => setFade(o.v), onComplete: resolve });
          });
          if (!alive()) return;
          commit(step.frame);
          await new Promise<void>((resolve) => {
            tweenRef.current = gsap.to(o, { v: 1, duration: 0.32, ease: 'power2.out', onUpdate: () => setFade(o.v), onComplete: resolve });
          });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedKey]);

  useEffect(
    () => () => {
      tweenRef.current?.kill();
      window.clearTimeout(clickTimer.current);
    },
    [],
  );

  const zoom = zoomRef.current;
  const idle = !zoom && fade === 1;
  const root = zoom?.root ?? shown;
  const { nodes, edges } = buildScene({
    root,
    target: zoom ? { rel: zoom.rel, mode: zoom.mode, e: zoom.e } : null,
    maxLevel,
    corners,
  });

  const born = (key: string) => {
    seenRef.current.add(key);
    let v = bornRef.current.get(key);
    if (v === undefined) {
      v = idle;
      bornRef.current.set(key, v);
    }
    return v;
  };
  useEffect(() => {
    for (const key of bornRef.current.keys()) if (!seenRef.current.has(key)) bornRef.current.delete(key);
    seenRef.current = new Set();
  });

  const lit = hovered ?? (highlight ? highlight.join() : null);
  const litSet = new Set<string>();
  if (lit !== null) {
    const parts = lit === '' ? [] : lit.split(',');
    for (let i = 0; i <= parts.length; i++) litSet.add(parts.slice(0, i).join());
  }
  const dimFor = (rel: CadenceType[]) => (lit === null || litSet.has(rel.join()) ? 1 : 0.22);

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width="100%"
      role="img"
      aria-label={ariaLabel}
      className={styles.svg}
      data-idle={idle || undefined}
      style={{ opacity: fade }}
    >
      {glass && (
        <defs>
          {CADENCE_TYPES.map((t) => (
            <GlassGradient
              key={t}
              id={`glass-${t}${uid}`}
              color={CADENCES[t].colorVar}
              up={`var(--cadence-${t}-up, ${CADENCES[t].colorVar})`}
            />
          ))}
          <GlassGradient id={`glass-centre${uid}`} color="var(--accent-warm)" quiet />
        </defs>
      )}
      <g>
        {edges.map((e) => {
          const color = CADENCES[e.type].colorVar;
          const isBorn = born(`e${e.posKey}${root.dir}`);
          const litEdge = lit !== null && litSet.has(e.rel.join());
          return (
            <g key={`e${e.posKey}${root.dir}`} className={styles.edge} opacity={e.opacity * dimFor(e.rel)}>
              <path
                d={e.shape.d}
                stroke={color}
                strokeWidth={e.width + (litEdge ? 0.9 : 0)}
                fill="none"
                strokeLinecap="round"
                pathLength={1}
                className={isBorn ? styles.draw : undefined}
              />
              <polygon points={e.shape.tip} fill={color} className={isBorn ? styles.tipIn : undefined} />
            </g>
          );
        })}
      </g>
      <g>
        {nodes.map((n) => {
          const color = n.type ? CADENCES[n.type].colorVar : null;
          const centreness = clamp01(1 - n.a);
          const solid = clamp01(n.a - 2);
          const tint = (24 + 76 * solid) * (1 - centreness);
          const fill = color
            ? `color-mix(in srgb, ${color} ${tint}%, var(--element-fill))`
            : 'var(--element-fill)';
          const stroke = color
            ? `color-mix(in srgb, ${color} ${(1 - centreness) * 100}%, var(--element-stroke-hover))`
            : 'var(--element-stroke-hover)';
          const label = labelFor(n.pc);
          const showSub = !!label.sub && n.a < 1.6;
          const clickable =
            interactive && idle && n.rel.length >= 1 && n.rel.length <= 2 && n.labelOpacity > 0.5;
          const relKey = n.rel.join();
          return (
            <g
              key={`n${n.posKey}`}
              transform={`translate(${n.x} ${n.y})`}
              opacity={n.opacity * dimFor(n.rel)}
              className={styles.node}
              data-clickable={clickable || undefined}
              onPointerEnter={interactive && idle ? () => setHovered(relKey) : undefined}
              onPointerLeave={interactive ? () => setHovered((h) => (h === relKey ? null : h)) : undefined}
              onPointerDown={clickable ? (ev) => ev.stopPropagation() : undefined}
              onClick={
                clickable
                  ? (ev) => {
                      ev.stopPropagation();
                      window.clearTimeout(clickTimer.current);
                      if (!onNodeDoubleClick) onNodeClick?.(n.rel);
                      else if (ev.detail < 2) clickTimer.current = window.setTimeout(() => onNodeClick?.(n.rel), DOUBLE_CLICK_MS);
                    }
                  : undefined
              }
              onDoubleClick={
                clickable && onNodeDoubleClick
                  ? (ev) => {
                      ev.stopPropagation();
                      window.clearTimeout(clickTimer.current);
                      onNodeDoubleClick(n.rel);
                    }
                  : undefined
              }
            >
              <g className={born(`n${n.posKey}`) ? styles.pop : undefined}>
                <circle
                  r={n.r}
                  style={{ fill, stroke }}
                  strokeWidth={n.a < 2.5 ? 1.4 : 0}
                  opacity={1 - 0.45 * clamp01(n.a - 2)}
                />
                {glass && n.a < 2.5 && (
                  <>
                    {n.type && (
                      <circle
                        r={Math.max(0, n.r - 0.7)}
                        fill={`url(#glass-${n.type}${uid})`}
                        opacity={1 - centreness}
                        pointerEvents="none"
                      />
                    )}
                    <circle
                      r={Math.max(0, n.r - 0.7)}
                      fill={`url(#glass-centre${uid})`}
                      opacity={n.type ? centreness : 1}
                      pointerEvents="none"
                    />
                  </>
                )}
                {n.labelOpacity > 0.01 && (
                  <g
                    key={`${n.pc}${label.main}`}
                    opacity={n.labelOpacity / Math.max(n.opacity, 0.001)}
                    className={born(`l${n.posKey}${n.pc}${label.main}`) ? styles.labelIn : undefined}
                  >
                    <text
                      className={styles.label}
                      data-serif={n.a < 0.5 || undefined}
                      y={showSub ? -n.font * 0.18 : 0}
                      style={{ fontSize: n.font }}
                      dominantBaseline="central"
                      textAnchor="middle"
                    >
                      <Glyphs text={label.main} />
                    </text>
                    {showSub && (
                      <text
                        className={styles.sub}
                        y={n.font * 0.5}
                        style={{ fontSize: n.font * 0.5 }}
                        dominantBaseline="central"
                        textAnchor="middle"
                      >
                        {label.sub}
                      </text>
                    )}
                  </g>
                )}
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
