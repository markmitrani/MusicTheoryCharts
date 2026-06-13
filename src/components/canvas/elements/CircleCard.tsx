'use client';

import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CIRCLE_KEYS, circleIndexOf } from '@/lib/theory/circle';
import type { CircleElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import { ElementShell } from '../ElementShell';
import { PlusIcon } from '@/components/chrome/icons';
import chordStyles from './ChordCard.module.scss';
import styles from './CircleCard.module.scss';

interface CircleCardProps {
  el: CircleElement;
  selected: boolean;
  soloSelected: boolean;
}

const SIZE = 360;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 150;
const R_INNER = 96;
const R_MINOR = 62;
const SIG_R = 166;

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (r: number, deg: number) => ({
  x: CX + r * Math.cos(rad(deg)),
  y: CY + r * Math.sin(rad(deg)),
});

/** Ring-segment path for wedge i (30° each, index 0 centered at the top). */
function wedgePath(i: number): string {
  const a0 = i * 30 - 105;
  const a1 = i * 30 - 75;
  const p1 = polar(R_OUTER, a0);
  const p2 = polar(R_OUTER, a1);
  const p3 = polar(R_INNER, a1);
  const p4 = polar(R_INNER, a0);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 0 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${R_INNER} ${R_INNER} 0 0 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * Circle of fifths (direction A): click a key to rotate it to the top and
 * make it the center; the focused wedge grows a "+" that fans out a radial
 * Scale / Chord / Harmony menu spawning a pre-filled stub beside the circle.
 * Toggles (key signatures with treble clef, relative minor ring) live in a
 * popover behind the name tab.
 */
export function CircleCard({ el, selected, soloSelected }: CircleCardProps) {
  const wheelRef = useRef<SVGGElement>(null);
  const labelRefs = useRef<Array<SVGGElement | null>>([]);
  const rotationRef = useRef({ value: -circleIndexOf(el.centerKey) * 30 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [options, setOptions] = useState(false);

  // Rotate the clicked key to the top via the shortest path; labels
  // counter-rotate so they stay upright.
  useEffect(() => {
    const target = -circleIndexOf(el.centerKey) * 30;
    let diff = target - rotationRef.current.value;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const end = rotationRef.current.value + diff;
    gsap.to(rotationRef.current, {
      value: end,
      duration: 0.7,
      ease: 'power3.inOut',
      onUpdate: () => {
        const rot = rotationRef.current.value;
        wheelRef.current?.setAttribute('transform', `rotate(${rot} ${CX} ${CY})`);
        labelRefs.current.forEach((node, i) => {
          if (!node) return;
          const pos = polar((R_OUTER + R_INNER) / 2, i * 30 - 90);
          node.setAttribute('transform', `rotate(${-rot} ${pos.x} ${pos.y})`);
        });
      },
    });
  }, [el.centerKey]);

  const recenter = (note: (typeof CIRCLE_KEYS)[number]['note']) => {
    if (note === el.centerKey) return;
    uiTick(circleIndexOf(note));
    setMenuOpen(false);
    canvasStore.getState().updateElement(el.id, { centerKey: note }, { commit: true });
  };

  const spawn = (kind: 'scale' | 'chord' | 'harmony') => {
    setMenuOpen(false);
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    s.addElement({
      kind: 'stub',
      x: el.x + SIZE + 48,
      y: el.y + 40,
      root: el.centerKey,
      typeId: null,
      kindHint: kind,
    });
  };

  const toggle = (patch: Partial<CircleElement>) => {
    canvasStore.getState().updateElement(el.id, patch, { commit: true });
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div className={`${chordStyles.wrap} ${styles.square}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            title="Circle options"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setOptions((v) => !v);
            }}
          >
            <span className={chordStyles.nameTabInner}>Circle of Fifths — {CIRCLE_KEYS[circleIndexOf(el.centerKey)].label}</span>
          </button>
        </div>
        <div className={chordStyles.card}>
          <div className={styles.stage}>
            <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="Circle of fifths">
              <g ref={wheelRef} transform={`rotate(${rotationRef.current.value} ${CX} ${CY})`}>
                {CIRCLE_KEYS.map((key, i) => {
                  const mid = polar((R_OUTER + R_INNER) / 2, i * 30 - 90);
                  const minorPos = polar(R_MINOR + 16, i * 30 - 90);
                  const sigPos = polar(SIG_R, i * 30 - 90);
                  const active = key.note === el.centerKey;
                  return (
                    <g key={key.note}>
                      <path
                        className={styles.wedge}
                        data-active={active || undefined}
                        d={wedgePath(i)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          recenter(key.note);
                        }}
                      />
                      <g
                        ref={(node) => {
                          labelRefs.current[i] = node;
                        }}
                        transform={`rotate(${-rotationRef.current.value} ${mid.x} ${mid.y})`}
                        pointerEvents="none"
                      >
                        <text className={styles.keyLabel} data-active={active || undefined} x={mid.x} y={mid.y + 5}>
                          {key.label}
                        </text>
                        {el.showRelativeMinor && (
                          <text
                            className={styles.minorLabel}
                            x={mid.x}
                            y={mid.y + 4}
                            dx={minorPos.x - mid.x}
                            dy={minorPos.y - mid.y}
                          >
                            {key.relativeMinor}
                          </text>
                        )}
                        {el.showSignatures && key.signature && (
                          <text className={styles.sigLabel} dx={sigPos.x - mid.x} dy={sigPos.y - mid.y} x={mid.x} y={mid.y + 4}>
                            {'\u{1D11E}'} {key.signature}
                          </text>
                        )}
                      </g>
                    </g>
                  );
                })}
              </g>
              <circle cx={CX} cy={CY} r={40} className={styles.hub} />
              <text className={styles.hubLabel} x={CX} y={CY + 7}>
                {CIRCLE_KEYS[circleIndexOf(el.centerKey)].label}
              </text>
            </svg>

            {selected && (
              <div className={styles.spawnRoot} onPointerDown={(e) => e.stopPropagation()}>
                <button
                  className={styles.spawnPlus}
                  data-open={menuOpen || undefined}
                  aria-label="Create from this key"
                  title="Create from this key"
                  onClick={(e) => {
                    e.stopPropagation();
                    uiTick(0);
                    setMenuOpen((v) => !v);
                  }}
                >
                  <PlusIcon width={15} height={15} />
                </button>
                {menuOpen && <RadialMenu onPick={spawn} />}
              </div>
            )}
          </div>
        </div>

        {options && (
          <div className={styles.options} onPointerDown={(e) => e.stopPropagation()}>
            <label className={styles.optionRow}>
              <span>Key signatures {'\u{1D11E}'}</span>
              <button
                role="switch"
                aria-checked={el.showSignatures}
                className={styles.switch}
                data-on={el.showSignatures || undefined}
                onClick={() => toggle({ showSignatures: !el.showSignatures })}
              >
                <span className={styles.knob} />
              </button>
            </label>
            <label className={styles.optionRow}>
              <span>Relative minors</span>
              <button
                role="switch"
                aria-checked={el.showRelativeMinor}
                className={styles.switch}
                data-on={el.showRelativeMinor || undefined}
                onClick={() => toggle({ showRelativeMinor: !el.showRelativeMinor })}
              >
                <span className={styles.knob} />
              </button>
            </label>
          </div>
        )}
      </div>
    </ElementShell>
  );
}

function RadialMenu({ onPick }: { onPick: (kind: 'scale' | 'chord' | 'harmony') => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      ref.current!.children,
      { scale: 0.4, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)', stagger: 0.05 },
    );
  }, []);

  const ITEMS: Array<{ kind: 'scale' | 'chord' | 'harmony'; label: string; angle: number }> = [
    { kind: 'scale', label: 'Scale', angle: -135 },
    { kind: 'chord', label: 'Chord', angle: -90 },
    { kind: 'harmony', label: 'Harmony', angle: -45 },
  ];

  return (
    <div ref={ref} className={styles.radial}>
      {ITEMS.map(({ kind, label, angle }) => {
        const x = 64 * Math.cos(rad(angle));
        const y = 64 * Math.sin(rad(angle));
        return (
          <button
            key={kind}
            className={styles.radialItem}
            style={{ translate: `${x}px ${y}px` }}
            onClick={(e) => {
              e.stopPropagation();
              onPick(kind);
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
