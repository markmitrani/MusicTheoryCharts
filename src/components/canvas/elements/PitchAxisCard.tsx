'use client';

import { useState } from 'react';
import { NOTE_NAMES } from '@/lib/theory/note';
import { AXES, AXIS_COLOR, CHROMATIC_LABELS, axisOf, type AxisFn } from '@/lib/theory/pitch-axis';
import type { PitchAxisElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { ElementShell } from '../ElementShell';
import { InfoIcon } from '@/components/chrome/icons';
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
const pos = (r: number, i: number) => {
  const a = rad(-90 + i * 30); // C at top, clockwise by semitone
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

/**
 * Bartók pitch-axis element (v1, static C on top). The 12 chromatic notes are
 * coloured by functional axis (tonic / subdominant / dominant); each axis is a
 * diminished-seventh "cross" of two tritone diameters. The whole point: this
 * functional grouping is fixed by the key centre and is the same in every mode.
 */
export function PitchAxisCard({ el, selected, soloSelected }: PitchAxisCardProps) {
  const [info, setInfo] = useState(false);
  const [focus, setFocus] = useState<AxisFn | null>(null);
  const centerIdx = NOTE_NAMES.indexOf(el.centerKey);

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
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div className={`${chordStyles.wrap} ${styles.square}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner}>Pitch Axis — {el.centerKey}</span>
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
              <circle cx={C} cy={C} r={R_RING} className={styles.ring} />

              {diameters.map((d, i) => {
                const p1 = pos(R_RING, d.a);
                const p2 = pos(R_RING, d.b);
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
              <text x={C} y={C - 2} className={styles.hubKey}>
                {el.centerKey}
              </text>
              <text x={C} y={C + 13} className={styles.hubSub}>
                axis
              </text>

              {CHROMATIC_LABELS.map((label, i) => {
                const fn = axisOf(i, el.centerKey);
                const dot = pos(R_RING, i);
                const lab = pos(R_LABEL, i);
                const isCenter = NOTE_NAMES[i] === el.centerKey;
                return (
                  <g
                    key={i}
                    data-dim={dim(fn) || undefined}
                    className={styles.note}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      recenter(i);
                    }}
                  >
                    {isCenter && (
                      <circle cx={dot.x} cy={dot.y} r={12} className={styles.centerRing} />
                    )}
                    <circle cx={dot.x} cy={dot.y} r={8} fill={AXIS_COLOR[fn]} className={styles.dot} />
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
              The twelve notes fall into three functional axes — tonic, subdominant, dominant.
              Each axis is a diminished-seventh chord: four notes a minor third apart, drawn as a
              cross of two tritone diameters.
            </p>
            <p>
              <strong>Independent of mode.</strong> The axis of a note is set by the key centre
              alone, not the scale. In {el.centerKey}, the notes{' '}
              {[0, 3, 6, 9].map((o) => CHROMATIC_LABELS[(centerIdx + o) % 12]).join(', ')} all carry
              tonic function — in {el.centerKey} major, {el.centerKey} minor, or any mode. A chord a
              tritone away substitutes for its pole; that is why this map works the same everywhere.
            </p>
          </div>
        )}
      </div>
    </ElementShell>
  );
}
