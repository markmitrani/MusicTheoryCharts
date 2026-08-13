'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CIRCLE_KEYS, circleIndexOf, SHARP_STEPS, FLAT_STEPS } from '@/lib/theory/circle';
import type { CircleElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import { ElementShell } from '../ElementShell';
import { PlusIcon, InfoIcon } from '@/components/chrome/icons';
import chordStyles from './ChordCard.module.scss';
import styles from './CircleCard.module.scss';

interface CircleCardProps {
  el: CircleElement;
  selected: boolean;
  soloSelected: boolean;
}

// Ring geometry (SVG units, centred at CX/CY which depend on whether the
// signature staves need outboard room).
const RING_OUTER = 150;
const RING_INNER = 96;
const MID_R = (RING_OUTER + RING_INNER) / 2; // key name radius
const MINOR_R = 76; // relative minor sits inside the ring
const MINOR_INNER = 52; // inner edge of the relative-minor band (clears the hub)
const SIG_R = 188; // staff centre, outboard of the ring (centred in the margin)
const HUB_R = 40;

// Treble-staff metrics for the rendered key signatures. Drawn 135% larger than
// the original engraving without enlarging the box: SIG_R was pulled inward so
// the bigger staves still sit between the ring and the (unchanged) viewbox edge.
const STAFF_SCALE = 1.35;
const STAFF_LS = 3 * STAFF_SCALE; // line spacing
const STAFF_HALF = STAFF_LS * 2; // top/bottom line offset from centre
const STAFF_CLEF_W = 13 * STAFF_SCALE; // horizontal room reserved for the (large) clef
const STAFF_ACC_STEP = 4.2 * STAFF_SCALE;
const STAFF_ACC_PAD = 4 * STAFF_SCALE; // trailing room after the last accidental
// Large treble clef: its body curls around the G line (2nd from the bottom,
// y = +STAFF_LS), per engraving convention. Sized ~2.2× the staff height.
const STAFF_CLEF_SIZE = 27 * STAFF_SCALE;
const STAFF_CLEF_Y = STAFF_LS; // central-baseline y → seats the curl on the G line
/** Diatonic step above the bottom staff line (E4) → y offset from centre. */
const stepToY = (step: number) => STAFF_HALF - step * (STAFF_LS / 2);

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(rad(deg)),
  y: cy + r * Math.sin(rad(deg)),
});

/** Ring-segment path for wedge i (30° each, index 0 centred at the top). */
function wedgePath(cx: number, cy: number, i: number, outer = RING_OUTER, inner = RING_INNER): string {
  const a0 = i * 30 - 105;
  const a1 = i * 30 - 75;
  const p1 = polar(cx, cy, outer, a0);
  const p2 = polar(cx, cy, outer, a1);
  const p3 = polar(cx, cy, inner, a1);
  const p4 = polar(cx, cy, inner, a0);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outer} ${outer} 0 0 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${inner} ${inner} 0 0 0 ${p4.x} ${p4.y}`,
    'Z',
  ].join(' ');
}

/**
 * Circle of fifths (direction A): click a key to rotate it to the top and
 * make it the centre; the focused wedge grows a "+" that fans out a radial
 * Scale / Chord / Harmony menu spawning a pre-filled stub beside the circle.
 *
 * Labels (key names, relative minors, signature staves) live OUTSIDE the
 * rotating wheel group and are positioned per-frame at their correct
 * radius/angle and kept upright — so they never drift out of alignment as the
 * wheel turns. The box grows outward when the signatures are shown.
 */
export function CircleCard({ el, selected, soloSelected }: CircleCardProps) {
  const showSig = el.showSignatures;
  const showMinor = el.showRelativeMinor;

  // Viewbox extent: leave outboard room for the staves only when shown.
  const EXTENT = showSig ? 226 : 168;
  const VIEW = EXTENT * 2;
  const CX = EXTENT;
  const CY = EXTENT;

  const wheelRef = useRef<SVGGElement>(null);
  const keyRefs = useRef<Array<SVGGElement | null>>([]);
  const sigRefs = useRef<Array<SVGGElement | null>>([]);
  const minorRefs = useRef<Array<SVGGElement | null>>([]);
  const rotationRef = useRef({ value: -circleIndexOf(el.centerKey) * 30 });
  const [menuOpen, setMenuOpen] = useState(false);
  // One panel behind the header at a time: 'options' (toggles) or 'info'.
  const [panel, setPanel] = useState<'none' | 'options' | 'info'>('none');

  // Place the wheel + every upright label for a given rotation (degrees).
  const applyRotation = (rot: number) => {
    wheelRef.current?.setAttribute('transform', `rotate(${rot} ${CX} ${CY})`);
    for (let i = 0; i < CIRCLE_KEYS.length; i++) {
      const a = i * 30 - 90 + rot;
      const place = (node: SVGGElement | null, r: number) => {
        if (!node) return;
        const p = polar(CX, CY, r, a);
        node.setAttribute('transform', `translate(${p.x} ${p.y})`);
      };
      place(keyRefs.current[i], MID_R);
      if (showSig) place(sigRefs.current[i], SIG_R);
      if (showMinor) place(minorRefs.current[i], MINOR_R);
    }
  };

  // Reposition immediately (before paint) on mount and whenever the toggles
  // resize the box / reveal new label groups.
  useLayoutEffect(() => {
    applyRotation(rotationRef.current.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSig, showMinor, VIEW]);

  // Animate to a new centre key via the shortest path.
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
      onUpdate: () => applyRotation(rotationRef.current.value),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      x: el.x + 440,
      y: el.y + 40,
      root: el.centerKey,
      typeId: null,
      kindHint: kind,
    });
  };

  const toggle = (patch: Partial<CircleElement>) => {
    canvasStore.getState().updateElement(el.id, patch, { commit: true });
  };

  const rot0 = rotationRef.current.value;
  const initialTransform = (i: number, r: number) => {
    const p = polar(CX, CY, r, i * 30 - 90 + rot0);
    return `translate(${p.x} ${p.y})`;
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={panel !== 'none' || menuOpen}>
      <div className={`${chordStyles.wrap} ${showSig ? styles.squareWide : styles.square}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            title="Circle options"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPanel((p) => (p === 'options' ? 'none' : 'options'));
            }}
          >
            <span className={chordStyles.nameTabInner}>
              Circle of Fifths — {CIRCLE_KEYS[circleIndexOf(el.centerKey)].label}
            </span>
          </button>
        </div>
        <div className={chordStyles.card}>
          <div className={styles.stage}>
            <button
              className={styles.infoBtn}
              aria-label="About the circle of fifths"
              aria-expanded={panel === 'info'}
              title="About the circle of fifths"
              data-active={panel === 'info' || undefined}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setPanel((p) => (p === 'info' ? 'none' : 'info'));
              }}
            >
              <InfoIcon width={16} height={16} />
            </button>
            <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" role="img" aria-label="Circle of fifths">
              {/* rotating wheel: wedge fills only */}
              <g ref={wheelRef} transform={`rotate(${rot0} ${CX} ${CY})`}>
                {/* relative-minor band: the same wedge background + stroke
                    extended inward behind the minor labels, but fainter. */}
                {showMinor &&
                  CIRCLE_KEYS.map((key, i) => (
                    <path
                      key={`m-${key.note}`}
                      className={styles.minorWedge}
                      data-active={key.note === el.centerKey || undefined}
                      d={wedgePath(CX, CY, i, RING_INNER, MINOR_INNER)}
                    />
                  ))}
                {CIRCLE_KEYS.map((key, i) => (
                  <path
                    key={key.note}
                    className={styles.wedge}
                    data-active={key.note === el.centerKey || undefined}
                    d={wedgePath(CX, CY, i)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      recenter(key.note);
                    }}
                  />
                ))}
              </g>

              {/* upright labels, positioned per-frame (never rotate) */}
              <g pointerEvents="none">
                {CIRCLE_KEYS.map((key, i) => (
                  <g
                    key={key.note}
                    ref={(n) => {
                      keyRefs.current[i] = n;
                    }}
                    transform={initialTransform(i, MID_R)}
                  >
                    <text
                      className={styles.keyLabel}
                      data-active={key.note === el.centerKey || undefined}
                      dominantBaseline="central"
                    >
                      {key.label}
                    </text>
                  </g>
                ))}

                {showMinor &&
                  CIRCLE_KEYS.map((key, i) => (
                    <g
                      key={key.note}
                      ref={(n) => {
                        minorRefs.current[i] = n;
                      }}
                      transform={initialTransform(i, MINOR_R)}
                    >
                      <text className={styles.minorLabel} dominantBaseline="central">
                        {key.relativeMinor}
                      </text>
                    </g>
                  ))}

                {showSig &&
                  CIRCLE_KEYS.map((key, i) => (
                    <g
                      key={key.note}
                      ref={(n) => {
                        sigRefs.current[i] = n;
                      }}
                      transform={initialTransform(i, SIG_R)}
                    >
                      <KeySignatureStaff count={key.accidentals} type={key.accidentalType} />
                    </g>
                  ))}
              </g>

              <circle cx={CX} cy={CY} r={HUB_R} className={styles.hub} />
              <text className={styles.hubLabel} x={CX} y={CY} dominantBaseline="central">
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

        {panel === 'info' && (
          <div className={styles.info} onPointerDown={(e) => e.stopPropagation()}>
            <h4>Circle of Fifths</h4>
            <p>
              The twelve keys ordered by perfect fifths. Each step clockwise adds one sharp; each
              step counter-clockwise adds one flat. Neighbouring keys share every note but one.
            </p>
            <p>
              <strong>Composing.</strong> Adjacent keys modulate smoothly — only a single note
              changes. The ii–V–I that drives jazz is three neighbours in a row.
            </p>
            <p>
              <strong>Tension &amp; resolution.</strong> Moving clockwise, toward the dominant,
              tightens; moving counter-clockwise, toward the subdominant, relaxes. A falling fifth,
              V→I, is the strongest resolution in tonal music — the circle makes that pull visible.
            </p>
          </div>
        )}

        {panel === 'options' && (
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

/** A small treble staff drawn around the origin, with the key's accidentals. */
function KeySignatureStaff({ count, type }: { count: number; type: 'sharp' | 'flat' | 'none' }) {
  const steps = type === 'flat' ? FLAT_STEPS : SHARP_STEPS;
  const glyph = type === 'flat' ? '♭' : '♯';
  const width = STAFF_CLEF_W + count * STAFF_ACC_STEP + STAFF_ACC_PAD;
  const left = -width / 2;

  return (
    <g className={styles.staff}>
      {[0, 1, 2, 3, 4].map((k) => {
        const y = -STAFF_HALF + k * STAFF_LS;
        return <line key={k} className={styles.staffLine} x1={left} x2={left + width} y1={y} y2={y} />;
      })}
      <text
        className={styles.clef}
        x={left}
        y={STAFF_CLEF_Y}
        style={{ fontSize: STAFF_CLEF_SIZE }}
        dominantBaseline="central"
      >
        {'\u{1D11E}'}
      </text>
      {type !== 'none' &&
        Array.from({ length: count }).map((_, j) => (
          <text
            key={j}
            className={styles.accidental}
            x={left + STAFF_CLEF_W + j * STAFF_ACC_STEP}
            y={stepToY(steps[j])}
            dominantBaseline="central"
            textAnchor="middle"
          >
            {glyph}
          </text>
        ))}
    </g>
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

  // Larger radius + a fairly upright fan: enough separation between the
  // variable-width labels while keeping the side items high enough to clear
  // the name tab below.
  const RADIUS = 116;
  const ITEMS: Array<{ kind: 'scale' | 'chord' | 'harmony'; label: string; angle: number }> = [
    { kind: 'scale', label: 'Scale', angle: -126 },
    { kind: 'chord', label: 'Chord', angle: -90 },
    { kind: 'harmony', label: 'Harmony', angle: -54 },
  ];

  return (
    <div ref={ref} className={styles.radial}>
      {ITEMS.map(({ kind, label, angle }) => {
        const x = RADIUS * Math.cos(rad(angle));
        const y = RADIUS * Math.sin(rad(angle));
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
