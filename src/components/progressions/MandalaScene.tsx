'use client';

import { useId, useMemo, useState, type CSSProperties } from 'react';
import type { NoteName } from '@/lib/theory/note';
import { getScaleDef } from '@/lib/theory/scales';
import { homeId, mapMoves } from '@/lib/theory/progressions';
import { HaloFilter } from '@/components/cadence/FractalScene';
import { STROKE, type Edge, type LabelKind } from './layout';
import { ChordNode, Glass, carriesMove, roadsFor } from './MapScene';
import { ARMS, conicAt, conicStops, layoutMandala, type Arm } from './mandala';
import styles from './MapScene.module.scss';
import mandala from './MandalaScene.module.scss';

interface MandalaSceneProps {
  root: NoteName;
  sevenths?: boolean;
  labels?: LabelKind[];
  /** The card's mode: its arm is the one written in. */
  current: string;
  playing?: string | null;
  picked?: string | null;
  travel?: { from: string; to: string; n: number } | null;
  onChordClick?: (mode: string, id: string) => void;
  onPickMode?: (mode: string) => void;
  ariaLabel?: string;
}

/** A hovered chord in an arm, or a hub (which goes anywhere: its whole side lights). */
const DEFAULT_LABELS: LabelKind[] = ['functions', 'notes'];

type Hover = { mode: string; id: string; hub?: 'major' | 'minor' } | null;

const armVars = (mode: string) =>
  ({
    ['--ink' as string]: `var(--prog-${mode}-ink)`,
    ['--node' as string]: `var(--prog-${mode}-node)`,
    ['--node-up' as string]: `var(--prog-${mode}-node-up)`,
  }) as CSSProperties;

/**
 * Every mode's map as one arm of a mandala around a twin hub (I | i), over an
 * angular wash of each mode's own gradient: its far colour at the rim, its
 * home colour toward the centre, blending from arm to arm.
 */
export function MandalaScene({
  root,
  sevenths = false,
  labels = DEFAULT_LABELS,
  current,
  playing = null,
  picked = null,
  travel = null,
  onChordClick,
  onPickMode,
  ariaLabel,
}: MandalaSceneProps) {
  const uid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<Hover>(null);
  const m = useMemo(() => layoutMandala(root, { labels, sevenths }), [root, labels, sevenths]);
  const moves = useMemo(() => new Map(m.arms.map((a) => [a.mode, mapMoves(a.map)])), [m]);
  const currentSide = ARMS.find((a) => a.mode === current)?.side ?? 'major';

  // Hover lights a chord's arm: the chord, where it can go next, and those roads.
  const lit = useMemo(() => {
    if (!hover || hover.hub) return null;
    const out = new Set<string>([`${hover.mode}:${hover.id}`]);
    for (const k of moves.get(hover.mode) ?? []) {
      const [from, to] = k.split('>');
      if (from === hover.id) out.add(`${hover.mode}:${to}`);
    }
    return out;
  }, [hover, moves]);

  const isHub = (arm: Arm, id: string) => id === homeId(arm.map);
  const nodeDim = (arm: Arm, id: string) =>
    !!hover && (hover.hub ? arm.side !== hover.hub : !lit!.has(`${arm.mode}:${id}`));
  const hubDim = (side: 'major' | 'minor') => {
    if (!hover) return false;
    if (hover.hub) return hover.hub !== side;
    const arm = m.arms.find((a) => a.mode === hover.mode);
    return !arm || arm.side !== side || !lit!.has(`${arm.mode}:${homeId(arm.map)}`);
  };
  const edgeLit = (arm: Arm, e: Edge) => {
    if (!hover) return true;
    if (hover.hub) return arm.side === hover.hub;
    if (hover.mode !== arm.mode) return false;
    return [...lit!].some((k) => {
      const to = k.slice(arm.mode.length + 1);
      return to !== hover.id && carriesMove(e, hover.id, to);
    });
  };
  const bracketLit = (arm: Arm, id: string) => {
    if (!hover) return true;
    if (hover.hub) return arm.side === hover.hub;
    const slot = arm.map.spine.find((s) => s.id === id);
    if (hover.mode !== arm.mode || !slot || !('top' in slot)) return false;
    return [slot.top.id, slot.bottom.id].some((c) => c === hover.id || lit!.has(`${arm.mode}:${c}`));
  };

  const vb = m.viewBox;
  const centre = { x: (-vb.x / vb.w) * 100, y: (-vb.y / vb.h) * 100 };
  const bg = {
    ['--cx' as string]: `${centre.x}%`,
    ['--cy' as string]: `${centre.y}%`,
    ['--outer' as string]: conicAt(`${centre.x}% ${centre.y}%`, conicStops(ARMS, (mode) => `var(--mandala-${mode}-from)`)),
    ['--inner' as string]: conicAt(`${centre.x}% ${centre.y}%`, conicStops(ARMS, (mode) => `var(--mandala-${mode}-to)`)),
  } as CSSProperties;

  const pulseArm = m.arms.find((a) => a.mode === current);
  const pulse = travel && pulseArm ? roadsFor(pulseArm.layout.edges, travel.from, travel.to)[0] : undefined;

  return (
    <div className={mandala.root} style={bg}>
      <div className={mandala.outer} />
      <div className={mandala.inner} />
      <div className={mandala.sheen} />
      <div className={mandala.grunge} />
      <svg
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
        className={`${styles.svg} ${mandala.svg}`}
      >
        <defs>
          <HaloFilter id={`halo${uid}`} />
        </defs>

        {m.arms.map((arm) => {
          const glass = `glass-${arm.mode}${uid}`;
          const colourGlass = `colourGlass-${arm.mode}${uid}`;
          return (
            <g key={arm.mode} className={styles.tinted} style={armVars(arm.mode)} data-current={arm.mode === current || undefined}>
              <defs>
                <Glass id={glass} />
                <Glass id={colourGlass} colour />
              </defs>
              <g transform={arm.transform}>
                {arm.layout.brackets.map(({ id, box }) => {
                  const tick = 16;
                  return (
                    <path
                      key={id}
                      className={styles.bracket}
                      data-dim={bracketLit(arm, id) ? undefined : ''}
                      d={`M${box.left + tick} ${box.top}H${box.left}V${box.bottom}H${box.left + tick}M${box.right - tick} ${box.top}H${box.right}V${box.bottom}H${box.right - tick}`}
                    />
                  );
                })}
                {arm.layout.edges.map((e) => (
                  <g key={e.key} className={styles.edge} data-kind={e.kind} data-dim={edgeLit(arm, e) ? undefined : ''}>
                    <path d={e.d} strokeWidth={STROKE[e.kind]} />
                    {e.tip && <polygon points={e.tip} className={styles.tip} />}
                  </g>
                ))}
                {pulse && travel && arm.mode === current && (
                  <path
                    key={`p${travel.n}`}
                    d={pulse.d}
                    pathLength={1}
                    strokeWidth={STROKE[pulse.kind] + 2.6}
                    className={styles.travel}
                    style={{ ['--lit' as string]: 'var(--node)' }}
                  />
                )}
              </g>
              {arm.nodes.map((p) => (
                <ChordNode
                  key={p.id}
                  chord={arm.resolved.get(p.id)!}
                  place={p}
                  labels={labels}
                  dim={nodeDim(arm, p.id)}
                  hovered={!hover?.hub && hover?.mode === arm.mode && hover.id === p.id}
                  picked={arm.mode === current && picked === p.id}
                  playing={arm.mode === current && playing === p.id}
                  glassId={glass}
                  colourGlassId={colourGlass}
                  haloId={`halo${uid}`}
                  onEnter={() => setHover({ mode: arm.mode, id: p.id })}
                  onLeave={() => setHover((h) => (h?.mode === arm.mode && h.id === p.id ? null : h))}
                  onClick={onChordClick && !isHub(arm, p.id) ? () => onChordClick(arm.mode, p.id) : undefined}
                />
              ))}
              <text
                className={mandala.label}
                data-current={arm.mode === current || undefined}
                x={arm.label.x}
                y={arm.label.y}
                textAnchor={arm.label.anchor}
                dominantBaseline="central"
                role={onPickMode ? 'button' : undefined}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onPickMode?.(arm.mode);
                }}
              >
                {getScaleDef(arm.mode).label}
              </text>
            </g>
          );
        })}

        {(['major', 'minor'] as const).map((side) => {
          const hub = m.hubs[side];
          const glass = `glass-hub-${side}${uid}`;
          // The hub stands for the home of whichever arm is being written in on its side.
          const mode = currentSide === side ? current : hub.mode;
          return (
            <g key={side} className={styles.tinted} style={armVars(hub.mode)}>
              <defs>
                <Glass id={glass} />
              </defs>
              <ChordNode
                chord={m.hubResolved[side]}
                place={hub}
                labels={labels}
                dim={hubDim(side)}
                hovered={hover?.hub === side}
                picked={currentSide === side && picked === hub.id}
                playing={currentSide === side && playing === hub.id}
                glassId={glass}
                colourGlassId={glass}
                ring={ARMS.filter((a) => a.side === side).map((a) => ({ angle: a.angle, color: `var(--prog-${a.mode}-node)` }))}
                haloId={`halo${uid}`}
                onEnter={() => setHover({ mode, id: hub.id, hub: side })}
                onLeave={() => setHover((h) => (h?.hub === side ? null : h))}
                onClick={onChordClick ? () => onChordClick(mode, hub.id) : undefined}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
