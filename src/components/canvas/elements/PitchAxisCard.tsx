'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
import { AXES, AXIS_COLOR, CHROMATIC_LABELS, axisOf, type AxisFn } from '@/lib/theory/pitch-axis';
import type { PitchAxisElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { ElementShell } from '../ElementShell';
import { InfoIcon } from '@/components/chrome/icons';
import { GlassGradient } from '@/components/cadence/FractalScene';
import { useSurfaces } from '@/lib/use-surfaces';
import chordStyles from './ChordCard.module.scss';
import styles from './PitchAxisCard.module.scss';

interface PitchAxisCardProps {
  el: PitchAxisElement;
  selected: boolean;
  soloSelected: boolean;
}

const SIZE = 300;
const C = SIZE / 2;
const R_RING = 112;
const R_LABEL = 135;
const R_HUB = 34;

const rad = (deg: number) => (deg * Math.PI) / 180;
/** Chromatic index `i` with index `center` on top, clockwise by semitone, turned by `rot` degrees. */
const pos = (r: number, i: number, center: number, rot: number) => {
  const a = rad(-90 + (((i - center) % 12) + 12) % 12 * 30 + rot);
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

/**
 * Bartók pitch-axis element, key centre on top. The 12 chromatic notes are
 * coloured by functional axis (tonic / subdominant / dominant); each axis is a
 * diminished-seventh "cross" of two tritone diameters. The whole point: this
 * functional grouping is fixed by the key centre and is the same in every mode.
 * Double-clicking a note makes it the centre and spins it (shortest way) to the top.
 */
export function PitchAxisCard({ el, selected, soloSelected }: PitchAxisCardProps) {
  const [info, setInfo] = useState(false);
  const [focus, setFocus] = useState<AxisFn | null>(null);
  const glass = useSurfaces() === 'glass';
  const uid = useId().replace(/[:]/g, '');
  const centerIdx = NOTE_NAMES.indexOf(el.centerKey);
  // Rotation in degrees, tweened back to 0 after a re-centre; positions are recomputed per frame.
  const rotRef = useRef({ centerIdx, v: 0 });
  const [rot, setRot] = useState(0);

  useEffect(() => {
    const live = rotRef.current;
    if (live.centerIdx === centerIdx) return;
    // Start from the current view seen from the new centre, normalised so it turns the shortest way.
    const start = live.v - ((((live.centerIdx - centerIdx) % 12) + 12) % 12) * 30;
    live.centerIdx = centerIdx;
    live.v = ((start % 360) + 540) % 360 - 180;
    setRot(live.v);
    const tween = gsap.to(live, { v: 0, duration: 0.7, ease: 'power3.inOut', onUpdate: () => setRot(live.v) });
    return () => {
      tween.kill();
    };
  }, [centerIdx]);

  // The two tritone diameters of each axis (note index pairs).
  const diameters: Array<{ fn: AxisFn; a: number; b: number }> = [];
  for (let k = 0; k < 3; k++) {
    const base = (centerIdx + k) % 12;
    diameters.push({ fn: axisOf(base, el.centerKey), a: base, b: (base + 6) % 12 });
    diameters.push({ fn: axisOf(base, el.centerKey), a: (base + 3) % 12, b: (base + 9) % 12 });
  }

  const dim = (fn: AxisFn) => focus !== null && focus !== fn;

  const recenter = (i: number) => {
    const note = NOTE_NAMES[i];
    if (note === el.centerKey) return;
    canvasStore.getState().updateElement(el.id, { centerKey: note }, { commit: true });
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={info}>
      <div className={`${chordStyles.wrap} ${styles.square}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner}>Pitch Axis – {el.centerKey}</span>
          </span>
        </div>
        <div className={chordStyles.card}>
          <div className={styles.stage}>
            <button
              className={styles.infoBtn}
              aria-label="About the pitch axis"
              data-active={info || undefined}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setInfo((v) => !v);
              }}
            >
              <InfoIcon width={16} height={16} />
            </button>

            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="Bartók pitch axis">
              {glass && (
                <defs>
                  {AXES.map((a) => (
                    <GlassGradient
                      key={a.fn}
                      id={`glass-${a.fn}${uid}`}
                      color={a.colorVar}
                      up={`var(--axis-${a.fn}-up, ${a.colorVar})`}
                    />
                  ))}
                  <GlassGradient id={`glass-hub${uid}`} color="var(--axis-tonic)" quiet />
                </defs>
              )}
              <circle cx={C} cy={C} r={R_RING} className={styles.ring} />

              {diameters.map((d, i) => {
                const p1 = pos(R_RING, d.a, centerIdx, rot);
                const p2 = pos(R_RING, d.b, centerIdx, rot);
                return (
                  <line
                    key={i}
                    x1={p1.x}
                    y1={p1.y}
                    x2={p2.x}
                    y2={p2.y}
                    stroke={AXIS_COLOR[d.fn]}
                    className={styles.axisLine}
                    data-dim={dim(d.fn) || undefined}
                  />
                );
              })}

              <circle cx={C} cy={C} r={R_HUB} className={styles.hub} />
              {glass && <circle cx={C} cy={C} r={R_HUB - 0.7} fill={`url(#glass-hub${uid})`} />}
              <text x={C} y={C - 2} className={styles.hubKey}>
                {el.centerKey}
              </text>
              <text x={C} y={C + 13} className={styles.hubSub}>
                axis
              </text>

              {CHROMATIC_LABELS.map((label, i) => {
                const fn = axisOf(i, el.centerKey);
                const dot = pos(R_RING, i, centerIdx, rot);
                const lab = pos(R_LABEL, i, centerIdx, rot);
                const isCenter = NOTE_NAMES[i] === el.centerKey;
                return (
                  <g
                    key={i}
                    data-dim={dim(fn) || undefined}
                    data-center={isCenter || undefined}
                    className={styles.note}
                    onPointerDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      recenter(i);
                    }}
                  >
                    {isCenter && (
                      <circle cx={dot.x} cy={dot.y} r={12} stroke={AXIS_COLOR[fn]} className={styles.centerRing} />
                    )}
                    <circle
                      cx={dot.x}
                      cy={dot.y}
                      r={8}
                      fill={AXIS_COLOR[fn]}
                      className={styles.dot}
                      style={glass ? { stroke: AXIS_COLOR[fn] } : undefined}
                    />
                    {glass && (
                      <circle
                        cx={dot.x}
                        cy={dot.y}
                        r={8 - 0.7}
                        fill={`url(#glass-${fn}${uid})`}
                        className={styles.dotGlass}
                        pointerEvents="none"
                      />
                    )}
                    <text x={lab.x} y={lab.y + 4} className={styles.noteLabel} data-center={isCenter || undefined}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className={styles.legend}>
              {AXES.map((a) => (
                <button
                  key={a.fn}
                  className={styles.legendItem}
                  data-active={focus === a.fn || undefined}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFocus((f) => (f === a.fn ? null : a.fn));
                  }}
                >
                  <span className={styles.swatch} style={{ background: a.colorVar }} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {info && (
          <div className={styles.info} onPointerDown={(e) => e.stopPropagation()}>
            <h4>Pitch axis</h4>
            <p>
              The twelve notes fall into three functional axes – tonic, subdominant, dominant.
              Each axis is a diminished-seventh chord: four notes a minor third apart, drawn as a
              cross of two tritone diameters.
            </p>
            <p>
              <strong>Independent of mode.</strong> The axis of a note is set by the key centre
              alone, not the scale. In {el.centerKey}, the notes{' '}
              {[0, 3, 6, 9].map((o) => CHROMATIC_LABELS[(centerIdx + o) % 12]).join(', ')} all carry
              tonic function – in {el.centerKey} major, {el.centerKey} minor, or any mode. A chord a
              tritone away substitutes for its pole; that is why this map works the same everywhere.
            </p>
          </div>
        )}
      </div>
    </ElementShell>
  );
}
