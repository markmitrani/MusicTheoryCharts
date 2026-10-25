'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import {
  CIRCLE_KEYS,
  circleIndexOf,
  leadingToneChord,
  relativeMinorNote,
  secondaryDominantChord,
  SHARP_STEPS,
  FLAT_STEPS,
  type CircleKey,
} from '@/lib/theory/circle';
import type { NoteName } from '@/lib/theory/note';
import type { CircleComplexity, CircleElement, CircleFocus } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import { useSurfaces } from '@/lib/use-surfaces';
import { GlassGradient, Glyphs } from '@/components/cadence/FractalScene';
import { Acc } from '@/components/cadence/Acc';
import { ElementShell } from '../ElementShell';
import { isMobile, useIsMobile } from '@/lib/use-mobile';
import { PlusIcon, InfoIcon } from '@/components/chrome/icons';
import chordStyles from './ChordCard.module.scss';
import roadsStyles from './RoadsCard.module.scss';
import styles from './CircleCard.module.scss';

interface CircleCardProps {
  el: CircleElement;
  selected: boolean;
  soloSelected: boolean;
}

/**
 * The rings of chords, outermost first: the major keys, their relative minors,
 * each key's V7/vi (the dominant of its relative minor) and its viiø.
 */
type Ring = 'major' | 'minor' | 'dom' | 'dim';
const RINGS: Ring[] = ['major', 'minor', 'dom', 'dim'];

/** A ring of twelve stops: its radius, disc size, type sizes and angular offset. */
interface RingSpec {
  r: number;
  disc: number;
  name: number;
  numeral: number;
  /** Degrees clockwise from the key's own spoke (V7/vi sits between two keys). */
  offset?: number;
}

/**
 * Stop layout per complexity level, in SVG units (1 unit ≈ 1 px on the card).
 * Every gap between neighbouring discs, along a ring or across rings, keeps
 * at least ~8 units of air. Advanced is the merged diagram: V7/vi rides between
 * the minors and the viiø ring, half a step clockwise, so the minor ii–V–i
 * (viiø → V7/vi → vi) reads as one short road.
 */
interface Layout {
  rings: Partial<Record<Ring, RingSpec>>;
  /** Free radius in the middle, for the centre key's name. */
  centreName: number;
  /** Signature staff centre, outboard of the majors. */
  sigR: number;
}

const MAJOR: RingSpec = { r: 150, disc: 26, name: 20, numeral: 11 };

const LAYOUTS: Record<CircleComplexity, Layout> = {
  basic: { rings: { major: MAJOR }, centreName: 32, sigR: 212 },
  intermediate: {
    rings: { major: MAJOR, minor: { r: 92, disc: 19, name: 15, numeral: 9.5 } },
    centreName: 28,
    sigR: 212,
  },
  advanced: {
    rings: {
      major: { r: 200, disc: 24, name: 18, numeral: 10.5 },
      minor: { r: 144, disc: 19, name: 14, numeral: 9 },
      dom: { r: 116, disc: 15, name: 11, numeral: 7.5, offset: 15 },
      dim: { r: 86, disc: 16, name: 11.5, numeral: 8 },
    },
    centreName: 26,
    sigR: 260,
  },
};

/** Margin past the outermost disc (and room for staves when shown). */
const MARGIN = 14;
const SIG_MARGIN = 34;

const COMPLEXITY_LEVELS: Array<{ id: CircleComplexity; label: string; hint: string }> = [
  { id: 'basic', label: 'Basic', hint: 'The twelve major keys.' },
  { id: 'intermediate', label: 'Intermediate', hint: 'Adds the relative minors. Click one to make it the key.' },
  { id: 'advanced', label: 'Advanced', hint: 'The full merged diagram: adds each key’s V7/vi and viiø.' },
];

// Roman numerals of the focused key's chords by wedge slot (counter-clockwise,
// centre, clockwise), read from the major key or from its relative minor.
const NUMERALS: Record<'major' | 'minor', Record<Ring, string[]>> = {
  major: { major: ['IV', 'I', 'V'], minor: ['ii', 'vi', 'iii'], dom: ['', 'V7/vi', ''], dim: ['', 'viiø', ''] },
  minor: { major: ['♭VI', '♭III', '♭VII'], minor: ['iv', 'i', 'v'], dom: ['', 'V7', ''], dim: ['', 'iiø', ''] },
};

/** Function colours (Ways Home hues), by the role each chord plays in the major key. */
type Fn = 'I' | 'ii' | 'iii' | 'IV' | 'V' | 'vi' | 'vii';
const FN_BY_SLOT: Record<Ring, Array<Fn | null>> = {
  major: ['IV', 'I', 'V'],
  minor: ['ii', 'vi', 'iii'],
  dom: [null, null, null], // a secondary dominant keeps its amber
  dim: [null, 'vii', null],
};
const FN_STOPS: Array<{ fn: Fn; ring: Ring; slot: number }> = [
  { fn: 'I', ring: 'major', slot: 1 },
  { fn: 'IV', ring: 'major', slot: 0 },
  { fn: 'V', ring: 'major', slot: 2 },
  { fn: 'vi', ring: 'minor', slot: 1 },
  { fn: 'ii', ring: 'minor', slot: 0 },
  { fn: 'iii', ring: 'minor', slot: 2 },
  { fn: 'vii', ring: 'dim', slot: 1 },
];
// Legend order: the key's own ring first (I IV V, or i iv v when read as minor).
const FN_ORDER: Record<'major' | 'minor', typeof FN_STOPS> = {
  major: FN_STOPS,
  minor: [...FN_STOPS.slice(3, 6), ...FN_STOPS.slice(0, 3), FN_STOPS[6]],
};

/** Resting chord-type colours. */
const TYPE_COLOR: Record<Exclude<Ring, 'dim'>, string> = {
  major: 'var(--circle-major)',
  minor: 'var(--circle-minor)',
  dom: 'var(--circle-dom7)',
};
const dimColor = (family: number) => `var(--circle-dim-${family})`;
const fnColor = (fn: Fn) => `var(--fn-${fn})`;

// Every colour a disc can take, for the glass-mode gradients.
const PALETTE: Array<{ id: string; color: string }> = [
  ...Object.entries(TYPE_COLOR).map(([id, color]) => ({ id, color })),
  ...[0, 1, 2].map((f) => ({ id: `dim${f}`, color: dimColor(f) })),
  ...FN_STOPS.map(({ fn }) => ({ id: `fn${fn}`, color: fnColor(fn) })),
];

function chordName(ring: Ring, key: CircleKey): string {
  if (ring === 'major') return key.label;
  if (ring === 'minor') return key.relativeMinor;
  if (ring === 'dom') return secondaryDominantChord(key);
  return leadingToneChord(key);
}

// Treble-staff metrics for the rendered key signatures (135% of the original
// engraving).
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

type Pt = { x: number; y: number };

/** Arrow from one disc's edge to another's, tip just touching (as on Roads). */
function road(a: Pt, ra: number, b: Pt, rb: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const u = { x: dx / len, y: dy / len };
  const TIP = 2;
  const L = 7;
  const W = 3.6;
  const s = { x: a.x + u.x * (ra + 2), y: a.y + u.y * (ra + 2) };
  const e = { x: b.x - u.x * (rb + 1 + TIP), y: b.y - u.y * (rb + 1 + TIP) };
  const base = { x: e.x - u.x * L, y: e.y - u.y * L };
  return {
    d: `M ${s.x} ${s.y} L ${base.x} ${base.y}`,
    tip: `${e.x + u.x * TIP},${e.y + u.y * TIP} ${base.x + u.y * W},${base.y - u.x * W} ${base.x - u.y * W},${base.y + u.x * W}`,
  };
}

/** Outline of a ring sector between two radii and two angles (degrees), for the focus perimeter. */
function sectorPath(c: number, outer: number, inner: number, a0: number, a1: number) {
  const pt = (r: number, a: number) => `${c + r * Math.cos(rad(a))} ${c + r * Math.sin(rad(a))}`;
  return [
    `M ${pt(outer, a0)}`,
    `A ${outer} ${outer} 0 0 1 ${pt(outer, a1)}`,
    `L ${pt(inner, a1)}`,
    `A ${inner} ${inner} 0 0 0 ${pt(inner, a0)}`,
    'Z',
  ].join(' ');
}

type SpawnKind = 'scale' | 'chord' | 'harmony';
const SPAWN_ITEMS: Array<{ kind: SpawnKind; label: string }> = [
  { kind: 'scale', label: 'Scale' },
  { kind: 'chord', label: 'Chord' },
  { kind: 'harmony', label: 'Harmony' },
];
/** Gap between the "+" and its key's disc, and between the outer ring and the menu arc. */
const PLUS_GAP = 13;
const MENU_GAP = 40;
/** Arc length between neighbouring menu items (fits "Harmony"). */
const MENU_STEP = 88;

/** Air between the focus perimeter and the discs it encloses. */
const PERIMETER_PAD = 7;
/** A second click on the focused key waits this long to see if it is a double click. */
const DOUBLE_CLICK_MS = 240;

/**
 * Circle of fifths, drawn as the Roads ring: every key a stop on the ring,
 * coloured by chord type as in Ways Home. It sits in a key (at the top, named
 * in the middle) without singling it out. Click a key to focus it where it
 * is: its chords (its own spoke and the two beside it) show their Roman
 * numerals and the rest go quiet – or, with function colours on, fade to
 * neutral around a traced perimeter. Click it again, or anywhere else on
 * the card, to let go; double-click a key to turn it to the top, as on Roads.
 * A "+" above the top fans out a Scale / Chord / Harmony menu spawning a
 * pre-filled stub for the centre key.
 *
 * Complexity adds rings inward: the relative minors (clickable – a minor
 * becomes the key centre, read from i), then each key's V7/vi and viiø, with
 * the three diminished-seventh families drawn as squares through the viiø.
 */
export function CircleCard({ el, selected, soloSelected }: CircleCardProps) {
  const glass = useSurfaces() === 'glass';
  const uid = useId().replace(/[:]/g, '');
  const showSig = el.showSignatures;
  const layout = LAYOUTS[el.complexity];
  const rings = RINGS.filter((ring) => layout.rings[ring]);
  const advanced = el.complexity === 'advanced';
  const minorCenter = el.complexity !== 'basic' && el.minorCenter;
  const centerIdx = circleIndexOf(el.centerKey);
  const centerKey = CIRCLE_KEYS[centerIdx];
  const centerName = minorCenter ? centerKey.relativeMinor : centerKey.label;
  // The clicked key (a minor focus needs the minor ring to exist).
  const focus = el.focus && !(el.focus.minor && el.complexity === 'basic') ? el.focus : null;
  const focusIdx = focus ? circleIndexOf(focus.key) : -1;
  const read = focus?.minor ? 'minor' : 'major';
  // The ring whose focused stop is the key itself.
  const homeRing: Ring = focus?.minor ? 'minor' : 'major';
  // Function colours: only the focused key keeps colour, inside a perimeter.
  const isolate = !!focus && el.functionColors;
  // The middle names the key in view: the focused one, else the centre key.
  const shown = focus ?? { key: el.centerKey, minor: minorCenter };
  const shownKey = CIRCLE_KEYS[circleIndexOf(shown.key)];

  // Viewbox: the outermost disc plus a margin, or the staves when shown.
  const major = layout.rings.major!;
  const EXTENT = showSig ? layout.sigR + SIG_MARGIN : major.r + major.disc + MARGIN;
  const VIEW = EXTENT * 2;
  const C = EXTENT;

  // Rotation in degrees (the centre key at the top); stops are placed per frame.
  const [rot, setRot] = useState(-centerIdx * 30);
  const rotRef = useRef({ v: -centerIdx * 30 });
  const [menuOpen, setMenuOpen] = useState(false);
  // One panel behind the header at a time: 'options' (toggles) or 'info'.
  const [panel, setPanel] = useState<'none' | 'options' | 'info'>('none');
  const clickTimer = useRef<number | undefined>(undefined);
  const downAt = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => window.clearTimeout(clickTimer.current), []);

  // Turn to a new centre key via the shortest path.
  useEffect(() => {
    let diff = -centerIdx * 30 - rotRef.current.v;
    while (diff > 180) diff -= 360;
    while (diff < -180) diff += 360;
    const tween = gsap.to(rotRef.current, {
      v: rotRef.current.v + diff,
      duration: 0.7,
      ease: 'power3.inOut',
      onUpdate: () => setRot(rotRef.current.v),
    });
    return () => {
      tween.kill();
    };
  }, [centerIdx]);

  const place = (i: number, r: number, offset = 0): Pt => {
    const a = rad(i * 30 - 90 + offset + rot);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  };
  const stop = (ring: Ring, i: number) => {
    const spec = layout.rings[ring]!;
    return place(i, spec.r, spec.offset);
  };

  /** Wedge slot relative to the focused key: 0 counter-clockwise, 1 its own, 2 clockwise, -1 elsewhere. */
  const slotOf = (i: number) => (focus ? [11, 0, 1].indexOf((i - focusIdx + 12) % 12) : -1);
  /** The focused key's numeral for stop i of a ring, or null if it is outside the key (or none is focused). */
  const numeralOf = (ring: Ring, i: number) => {
    const slot = slotOf(i);
    return slot >= 0 ? NUMERALS[read][ring][slot] || null : null;
  };

  const colorOf = (ring: Ring, i: number): { id: string; color: string } => {
    const slot = slotOf(i);
    const fn = isolate && slot >= 0 ? FN_BY_SLOT[ring][slot] : null;
    if (fn) return { id: `fn${fn}`, color: fnColor(fn) };
    if (ring === 'dim') return { id: `dim${i % 3}`, color: dimColor(i % 3) };
    return { id: ring, color: TYPE_COLOR[ring] };
  };

  const setFocus = (next: CircleFocus | null) => {
    setMenuOpen(false);
    uiTick(next ? circleIndexOf(next.key) : centerIdx);
    canvasStore.getState().updateElement(el.id, { focus: next }, { commit: true });
  };

  // Click: focus the key where it sits (a minor stop focuses the minor, read
  // from i). Clicking the focused key again lets go – after the double-click
  // window, so a double click on it still just re-centres.
  const onStopClick = (note: NoteName, minor: boolean, detail: number) => {
    if (detail > 1) return;
    window.clearTimeout(clickTimer.current);
    if (focus?.key === note && focus.minor === minor) {
      clickTimer.current = window.setTimeout(() => setFocus(null), DOUBLE_CLICK_MS);
    } else {
      setFocus({ key: note, minor });
    }
  };

  // Double click: turn the key to the top and centre it (as on Roads).
  const recenter = (note: NoteName, minor: boolean) => {
    window.clearTimeout(clickTimer.current);
    if (note === el.centerKey && minor === minorCenter) return;
    uiTick(circleIndexOf(note));
    setMenuOpen(false);
    canvasStore.getState().updateElement(el.id, { centerKey: note, minorCenter: minor }, { commit: true });
  };

  // The "+" grows out of the focused key (else the centre key), just past its
  // major disc on the key's spoke; its menu fans out along an arc concentric
  // with the circle, centred on that spoke.
  const anchor = shown;
  const anchorIdx = circleIndexOf(anchor.key);
  const anchorAngle = anchorIdx * 30 - 90 + rot;
  const plus = place(anchorIdx, major.r + major.disc + PLUS_GAP);
  const menuR = (showSig ? layout.sigR + SIG_MARGIN : major.r + major.disc) + MENU_GAP;
  const menuStep = (MENU_STEP / menuR) * (180 / Math.PI);
  // Lay Scale → Harmony in reading order wherever the key sits: left to right
  // along the top and bottom, top to bottom down the sides. The arc runs
  // clockwise along (−sin, cos); flip it when that heads left or up.
  const tx = -Math.sin(rad(anchorAngle));
  const ty = Math.cos(rad(anchorAngle));
  const flip = Math.abs(tx) >= Math.abs(ty) ? tx < 0 : ty < 0;
  const menuItems = SPAWN_ITEMS.map((item, j) => {
    const p = place(anchorIdx, menuR, ((flip ? 2 - j : j) - 1) * menuStep);
    return { ...item, dx: p.x - plus.x, dy: p.y - plus.y };
  });

  const spawn = (kind: SpawnKind) => {
    setMenuOpen(false);
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    // Phone: no room beside the circle, so the stub drops in below it.
    const shell = document.querySelector<HTMLElement>(`[data-element-id="${el.id}"]`);
    const below = isMobile() && shell;
    s.addElement({
      kind: 'stub',
      x: below ? el.x + (shell.offsetWidth - 300) / 2 : el.x + (shell?.offsetWidth ?? 400) + 40,
      y: below ? el.y + shell.offsetHeight + 24 : el.y + 40,
      root: anchor.minor ? relativeMinorNote(shownKey) : anchor.key,
      typeId: null,
      kindHint: kind,
    });
  };

  const toggle = (patch: Partial<CircleElement>) => {
    canvasStore.getState().updateElement(el.id, patch, { commit: true });
  };

  // The minor ii–V–i into the focused key's vi (its i when read as minor).
  const cadence =
    advanced && focus
      ? [
          road(stop('dim', focusIdx), layout.rings.dim!.disc, stop('dom', focusIdx), layout.rings.dom!.disc),
          road(stop('dom', focusIdx), layout.rings.dom!.disc, stop('minor', focusIdx), layout.rings.minor!.disc),
        ]
      : [];

  // The focused key's three spokes, from outside the majors to inside the innermost ring.
  const innermost = layout.rings[rings[rings.length - 1]]!;
  const spoke = focusIdx * 30 - 90 + rot;
  const perimeter = isolate
    ? sectorPath(
        C,
        major.r + major.disc + PERIMETER_PAD,
        innermost.r - innermost.disc - PERIMETER_PAD,
        spoke - 45,
        spoke + 45,
      )
    : null;

  // Legend: chord types; with a key isolated, its roles.
  const legend: Array<{ color: string; label: string; colors?: string[] }> = isolate
    ? [
        ...FN_ORDER[read]
          .filter(({ ring }) => layout.rings[ring])
          .map(({ fn, ring, slot }) => ({ color: fnColor(fn), label: NUMERALS[read][ring][slot] })),
        ...(advanced ? [{ color: TYPE_COLOR.dom, label: NUMERALS[read].dom[1] }] : []),
      ]
    : el.complexity === 'basic'
      ? []
      : [
          { color: TYPE_COLOR.major, label: 'Major' },
          { color: TYPE_COLOR.minor, label: 'Minor' },
          ...(advanced
            ? [
                { color: TYPE_COLOR.dom, label: 'V7/vi' },
                { color: dimColor(0), colors: [0, 1, 2].map(dimColor), label: 'viiø · dim7 families' },
              ]
            : []),
        ];

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={panel !== 'none' || menuOpen}>
      <div
        className={`${chordStyles.wrap} ${styles.wrap}`}
        style={{ width: VIEW + 28 }}
        data-selected={selected || undefined}
      >
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            title="Circle options"
            aria-expanded={panel === 'options'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPanel((p) => (p === 'options' ? 'none' : 'options'));
            }}
          >
            <span className={chordStyles.nameTabInner}>
              Circle of Fifths – <Acc text={centerName} />
            </span>
          </button>
        </div>
        <div
          className={chordStyles.card}
          // A click anywhere else on the card (not a drag) lets go of the focus;
          // stops and buttons stop their own clicks.
          onPointerDown={(e) => {
            downAt.current = { x: e.clientX, y: e.clientY };
          }}
          onClick={(e) => {
            const d = downAt.current;
            if (!focus || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
            setFocus(null);
          }}
        >
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
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              width="100%"
              role="img"
              aria-label={`Circle of fifths, centred on ${centerName} ${minorCenter ? 'minor' : 'major'}`}
              className={styles.svg}
            >
              {glass && (
                <defs>
                  {PALETTE.map(({ id, color }) => (
                    <GlassGradient key={id} id={`glass-${id}${uid}`} color={color} />
                  ))}
                </defs>
              )}

              {/* the rings themselves: hairlines the stops sit on */}
              {rings.map((ring) => (
                <circle key={ring} cx={C} cy={C} r={layout.rings[ring]!.r} className={styles.ring} />
              ))}

              {/* diminished-seventh families: each a square through four viiø */}
              {advanced &&
                [0, 1, 2].map((f) => (
                  <polygon
                    key={f}
                    className={styles.family}
                    data-focus={(focus && focusIdx % 3 === f) || undefined}
                    data-neutral={(isolate && focusIdx % 3 !== f) || undefined}
                    style={{ stroke: dimColor(f) }}
                    points={[0, 3, 6, 9]
                      .map((j) => stop('dim', f + j))
                      .map((p) => `${p.x},${p.y}`)
                      .join(' ')}
                  />
                ))}

              {perimeter && <path d={perimeter} className={styles.perimeter} />}

              {cadence.map((p, j) => (
                <g key={j} className={styles.road}>
                  <path d={p.d} />
                  <polygon points={p.tip} />
                </g>
              ))}

              {rings.map((ring) => {
                const spec = layout.rings[ring]!;
                const clickable = ring === 'major' || ring === 'minor';
                return CIRCLE_KEYS.map((key, i) => {
                  const { x, y } = stop(ring, i);
                  const numeral = numeralOf(ring, i);
                  const home = ring === homeRing && slotOf(i) === 1;
                  const { id, color } = colorOf(ring, i);
                  const quiet = !!focus && !numeral;
                  const neutral = isolate && !numeral;
                  const name = chordName(ring, key);
                  return (
                    <g
                      key={`${ring}-${key.note}`}
                      transform={`translate(${x} ${y})`}
                      className={styles.stop}
                      data-ring={ring}
                      data-home={home || undefined}
                      data-quiet={quiet || undefined}
                      data-neutral={neutral || undefined}
                      data-clickable={clickable || undefined}
                      style={{ ['--stop' as string]: color }}
                      onPointerDown={clickable ? (e) => e.stopPropagation() : undefined}
                      onClick={
                        clickable
                          ? (e) => {
                              e.stopPropagation();
                              onStopClick(key.note, ring === 'minor', e.detail);
                            }
                          : undefined
                      }
                      onDoubleClick={
                        clickable
                          ? (e) => {
                              e.stopPropagation();
                              recenter(key.note, ring === 'minor');
                            }
                          : undefined
                      }
                    >
                      <title>{numeral ? `${name} (${numeral})` : name}</title>
                      <circle r={spec.disc} className={styles.disc} />
                      {glass && (
                        <circle
                          r={spec.disc - 0.7}
                          fill={`url(#glass-${id}${uid})`}
                          opacity={neutral ? 0 : quiet ? 0.4 : 1}
                          pointerEvents="none"
                        />
                      )}
                      <text
                        className={styles.name}
                        data-serif={home || undefined}
                        y={numeral ? -spec.name * 0.28 : 0}
                        style={{ fontSize: home ? spec.name * 1.08 : spec.name }}
                        dominantBaseline="central"
                        textAnchor="middle"
                      >
                        <Glyphs text={name} />
                      </text>
                      {numeral && (
                        <text
                          className={styles.numeral}
                          y={spec.name * 0.28 + spec.numeral * 0.78}
                          style={{ fontSize: spec.numeral }}
                          dominantBaseline="central"
                          textAnchor="middle"
                        >
                          <Glyphs text={numeral} />
                        </text>
                      )}
                    </g>
                  );
                });
              })}

              {showSig &&
                CIRCLE_KEYS.map((key, i) => {
                  const { x, y } = place(i, layout.sigR);
                  return (
                    <g key={key.note} transform={`translate(${x} ${y})`} data-quiet={(focus && slotOf(i) < 0) || undefined} className={styles.sig}>
                      <KeySignatureStaff count={key.accidentals} type={key.accidentalType} />
                    </g>
                  );
                })}

              {/* the centre key, named in the middle of the rings */}
              <g>
                <text
                className={styles.centreName}
                x={C}
                y={C - layout.centreName * 0.22}
                style={{ fontSize: layout.centreName }}
                dominantBaseline="central"
                textAnchor="middle"
              >
                <Glyphs text={shown.minor ? shownKey.relativeMinor.replace(/m$/, '') : shownKey.label} />
              </text>
              <text
                className={styles.centreMode}
                x={C}
                y={C + layout.centreName * 0.62}
                dominantBaseline="central"
                textAnchor="middle"
              >
                {shown.minor ? 'minor' : 'major'}
              </text>
              </g>
            </svg>

            {selected && (
              <div
                className={styles.spawnRoot}
                style={{ left: `${(plus.x / VIEW) * 100}%`, top: `${(plus.y / VIEW) * 100}%` }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={styles.spawnPlus}
                  data-open={menuOpen || undefined}
                  aria-label={`Create from ${anchor.minor ? shownKey.relativeMinor : shownKey.label}`}
                  title={`Create from ${anchor.minor ? shownKey.relativeMinor : shownKey.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    uiTick(0);
                    setMenuOpen((v) => !v);
                  }}
                >
                  <PlusIcon width={13} height={13} />
                </button>
                {menuOpen && <RadialMenu items={menuItems} onPick={spawn} />}
              </div>
            )}
          </div>

          {legend.length > 0 && (
            <div className={styles.legend}>
              {legend.map((item) => (
                <span key={item.label} className={styles.legendItem}>
                  <span className={styles.swatches}>
                    {(item.colors ?? [item.color]).map((c) => (
                      <span key={c} className={styles.swatch} style={{ background: c }} />
                    ))}
                  </span>
                  <Acc text={item.label} />
                </span>
              ))}
            </div>
          )}
        </div>

        {panel === 'info' && (
          <div className={styles.info} onPointerDown={(e) => e.stopPropagation()}>
            <h4>Circle of Fifths</h4>
            <p>
              The twelve keys ordered by perfect fifths. Each step clockwise adds one sharp; each
              step counter-clockwise adds one flat. Neighbouring keys share every note but one.
            </p>
            <p>
              <strong>Composing.</strong> Adjacent keys modulate smoothly – only a single note
              changes. The ii–V–I that drives jazz is three neighbours in a row.
            </p>
            <p>
              <strong>Tension &amp; resolution.</strong> Moving clockwise, toward the dominant,
              tightens; moving counter-clockwise, toward the subdominant, relaxes. A falling fifth,
              V→I, is the strongest resolution in tonal music – the circle makes that pull visible.
            </p>
            <p>
              <strong>A key is three neighbours.</strong> Its chords sit on its own spoke and the two
              beside it: IV–I–V on the majors, ii–vi–iii on the minors. Click a key to see them,
              a minor to read them from i; double-click to turn a key to the top.
            </p>
          </div>
        )}

        {panel === 'options' && (
          <div className={styles.options} onPointerDown={(e) => e.stopPropagation()}>
            <div className={styles.optionGroup}>
              <span id={`complexity-${el.id}`} className={styles.optionLabel}>
                Complexity
              </span>
              <div className={roadsStyles.chips} role="radiogroup" aria-labelledby={`complexity-${el.id}`}>
                {COMPLEXITY_LEVELS.map((lvl) => (
                  <button
                    key={lvl.id}
                    role="radio"
                    aria-checked={el.complexity === lvl.id}
                    className={`${roadsStyles.chip} ${styles.chip}`}
                    data-active={el.complexity === lvl.id || undefined}
                    onClick={() => {
                      if (el.complexity === lvl.id) return;
                      // Basic has no minors: drop a minor centre or focus.
                      const drop =
                        lvl.id === 'basic'
                          ? { minorCenter: false, ...(el.focus?.minor ? { focus: null } : null) }
                          : null;
                      toggle({ complexity: lvl.id, ...drop });
                    }}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
              <p className={styles.optionHint}>{COMPLEXITY_LEVELS.find((lvl) => lvl.id === el.complexity)!.hint}</p>
            </div>

            <div className={styles.divider} />

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
              <span className={styles.checkText}>
                Function colours
                <small>Colour the focused key&rsquo;s chords by their role</small>
              </span>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={el.functionColors}
                onChange={(e) => toggle({ functionColors: e.target.checked })}
              />
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

/**
 * The "+" menu: each item flies out of the "+" to its spot on the arc
 * (offsets from the "+", in px). Phone: a straight row under the "+" instead.
 */
function RadialMenu({
  items,
  onPick,
}: {
  items: Array<{ kind: SpawnKind; label: string; dx: number; dy: number }>;
  onPick: (kind: SpawnKind) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const row = useIsMobile();

  // GSAP owns the transform (it clears CSS `translate`), so it also does the
  // centring on each item's spot: xPercent/yPercent -50.
  useLayoutEffect(() => {
    const els = Array.from(ref.current!.children) as HTMLElement[];
    const centre = row ? 0 : -50;
    gsap.fromTo(
      els,
      {
        xPercent: centre,
        yPercent: centre,
        scale: 0.4,
        opacity: 0,
        x: (j: number) => (row ? 0 : -items[j].dx),
        y: (j: number) => (row ? 0 : -items[j].dy),
      },
      { scale: 1, opacity: 1, x: 0, y: 0, duration: 0.42, ease: 'back.out(1.6)', stagger: 0.04 },
    );
    // Only on open; positions follow the key afterwards without replaying.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className={row ? styles.radialRow : styles.radial}>
      {items.map(({ kind, label, dx, dy }) => (
        <button
          key={kind}
          className={styles.radialItem}
          style={row ? undefined : { left: dx, top: dy }}
          onClick={(e) => {
            e.stopPropagation();
            onPick(kind);
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
