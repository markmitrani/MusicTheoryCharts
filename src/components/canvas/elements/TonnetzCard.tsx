'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
import {
  MOVES,
  applyMove,
  latticeToXY,
  xyToLattice,
  moveLabel,
  pcAt,
  sameTriad,
  triadName,
  triadPitches,
  triangleAt,
  triangleCentroid,
  triangleCorners,
  voiceProgression,
  type Move,
  type Triad,
  type TriPos,
} from '@/lib/theory/tonnetz';
import type { TonnetzElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { playChord, playProgression, uiTick } from '@/lib/playback/playback';
import { getAudioEngine } from '@/lib/audio/engine';
import { prefetchWorld, worldStore } from '@/lib/tonnetz/world-store';
import { ElementShell } from '../ElementShell';
import { GlassGradient } from '@/components/cadence/FractalScene';
import { useSurfaces } from '@/lib/use-surfaces';
import { LegendKey, LegendMoves } from '@/components/tonnetz/TonnetzLegend';
import { PlayButton } from './PlayButton';
import { TransposeControl } from './TransposeControl';
import chordStyles from './ChordCard.module.scss';
import styles from './TonnetzCard.module.scss';

interface TonnetzCardProps {
  el: TonnetzElement;
  selected: boolean;
  soloSelected: boolean;
}

/**
 * Window: one exact repetition of the lattice, framed like Wikipedia's figure
 * (horizontal top and bottom, sides along the major thirds). Cells i ∈ [−2, 2),
 * j ∈ [−1, 2): 4 fifths by 3 major thirds. These bricks tile the plane by the
 * periods (0, 3) and (4, −1), so each of the 24 triads appears inside exactly
 * once, and C major's triangle is the one touching the centre note.
 */
const I0 = -2;
const I1 = 2;
const J0 = -1;
const J1 = 2;
const E = 52; // edge length in px
// Stage keeps its earlier size; the lattice carries on, faded, around the window.
const W = 584;
const H = 374;
/** Window centre (lattice (0, ½)) sits at the stage centre. */
const CENTRE = latticeToXY((I0 + I1) / 2, (J0 + J1) / 2);
const CX = W / 2 - E * CENTRE.x;
const CY = H / 2 + E * CENTRE.y;
const R_NODE = 13;
/** How far (legend px) a legend's backdrop reaches past its edges, so the blur doesn't thin out there. */
const BACKDROP_BLEED = 28; // twice the backdrop blur
/** Repeats opacity when the card hasn't set its own. */
const REPEATS_DEFAULT = 0.15;

/** Lattice coordinate → stage px (world y is up, SVG y is down), shifted by `off`. */
const toPx = (i: number, j: number, off: { x: number; y: number }) => {
  const p = latticeToXY(i, j);
  return { x: CX + E * p.x + off.x, y: CY - E * p.y + off.y };
};
/** Stage px → continuous lattice coordinate (no slide). */
const fromPx = (x: number, y: number) => xyToLattice((x - CX) / E, -(y - CY) / E);

/** The window outline in lattice coordinates, grown by `d` steps on every side. */
const windowCorners = (d: number): [number, number][] => [
  [I0 - d, J0 - d],
  [I1 + d, J0 - d],
  [I1 + d, J1 + d],
  [I0 - d, J1 + d],
];
const inWindow = (i: number, j: number, d = 0) => i >= I0 - d && i <= I1 + d && j >= J0 - d && j <= J1 + d;
/** Is a stage point inside the window? */
const pxInWindow = (p: { x: number; y: number }, d = 0) => {
  const l = fromPx(p.x, p.y);
  return inWindow(l.i, l.j, d);
};
const inStage = (p: { x: number; y: number }, m: number) => p.x > -m && p.x < W + m && p.y > -m && p.y < H + m;

interface Tri {
  key: string;
  pos: TriPos;
  triad: Triad;
  /** Centroid in lattice coordinates. */
  c: { i: number; j: number };
}

interface Node {
  key: string;
  i: number;
  j: number;
  pc: number;
}

const MOVE_KEYS: Record<string, Move> = { p: 'P', l: 'L', r: 'R', n: 'N', s: 'S', h: 'H' };

/**
 * Transpose slides: the lattice step the notes travel for a centre change
 * (mod 12), so each note lands on the node that now carries its name. +1 is
 * two rows straight up (the node directly above), −1 straight down, a fifth
 * down one step right, a fifth up one step left.
 */
const TRANSPOSE_STEP: Record<number, [number, number]> = {
  1: [1, -2],
  11: [-1, 2],
  5: [1, 0],
  7: [-1, 0],
};
const ZERO = { x: 0, y: 0 };

/**
 * Tonnetz card: the flat lattice in the familiar Wikipedia orientation, fifths
 * (→), major thirds (↘) and minor thirds (↗), every triangle a triad (▽ major,
 * △ minor). A dashed border frames one exact repetition (every chord once);
 * the repeats carry on around it, faded, with a soft vignette at the card's edges.
 * Double-click a note to recentre on it; click a triangle to select and play
 * it; the move bar (or typing P L R N S H) walks to a neighbouring triad.
 */
export function TonnetzCard({ el, selected, soloSelected }: TonnetzCardProps) {
  const glass = useSurfaces() === 'glass';
  const uid = useId().replace(/[:]/g, '');
  const [lit, setLit] = useState<Triad | null>(null);
  const [litNote, setLitNote] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tuneOpen, setTuneOpen] = useState(false);
  const tuneRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef<{ x: number; y: number } | null>(null);
  const cardPressRef = useRef<{ x: number; y: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const keyLegendRef = useRef<HTMLDivElement>(null);
  const movesLegendRef = useRef<HTMLDivElement>(null);
  const [backdrops, setBackdrops] = useState<{ key?: string; moves?: string }>({});

  // Each legend's backdrop shows the lattice region under it: measured from
  // on-screen boxes, so canvas zoom and the moves legend's scale cancel out.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!el.showLegend || !stage) return;
    const measure = () => {
      const svg = svgRef.current;
      if (!svg) return;
      const sr = svg.getBoundingClientRect();
      const u = W / sr.width; // lattice units per screen px
      const box = (lg: HTMLDivElement | null) => {
        if (!lg) return undefined;
        const r = lg.getBoundingClientRect();
        const m = BACKDROP_BLEED * (r.width / lg.offsetWidth) * u;
        return `${(r.left - sr.left) * u - m} ${(r.top - sr.top) * u - m} ${r.width * u + 2 * m} ${r.height * u + 2 * m}`;
      };
      setBackdrops({ key: box(keyLegendRef.current), moves: box(movesLegendRef.current) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [el.showLegend]);
  const repeats = el.repeats ?? REPEATS_DEFAULT;

  useEffect(() => {
    if (!tuneOpen) return;
    const close = (e: PointerEvent) => {
      if (!tuneRef.current?.contains(e.target as HTMLElement)) setTuneOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setTuneOpen(false);
    window.addEventListener('pointerdown', close, { capture: true });
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', close, { capture: true });
      window.removeEventListener('keydown', esc);
    };
  }, [tuneOpen]);

  // Slides (recentre, transpose): the new view is drawn at rest and starts
  // offset to where its notes were, then eases home. The offset is a transform
  // on the lattice groups set straight on the DOM, so a slide never re-renders.
  const slideRef = useRef({ x: 0, y: 0 });
  const nameSlideRef = useRef({ x: 0, y: 0 });
  // While names slide, each keeps the look of the node it set out from (centre,
  // window, chord tone) and only takes on its new node's look once it lands.
  const [nameFrom, setNameFrom] = useState<[number, number] | null>(null);
  const triGroupRef = useRef<SVGGElement>(null);
  const nodeGroupRef = useRef<SVGGElement>(null);
  const labelGroupRef = useRef<SVGGElement>(null);
  const chordGroupRef = useRef<SVGGElement>(null);
  const [margin, setMargin] = useState(E);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const nameTweenRef = useRef<gsap.core.Tween | null>(null);
  const recentringRef = useRef(false);
  const prevCentreRef = useRef(el.centre);
  useEffect(
    () => () => {
      tweenRef.current?.kill();
      nameTweenRef.current?.kill();
    },
    [],
  );

  const placeGroups = () => {
    const g = slideRef.current;
    const n = nameSlideRef.current;
    const set = (el: SVGGElement | null, x: number, y: number) => {
      if (x === 0 && y === 0) el?.removeAttribute('transform');
      else el?.setAttribute('transform', `translate(${x} ${y})`);
    };
    set(triGroupRef.current, g.x, g.y);
    set(nodeGroupRef.current, g.x, g.y);
    set(labelGroupRef.current, g.x + n.x, g.y + n.y);
    set(chordGroupRef.current, g.x + n.x, g.y + n.y);
  };

  /**
   * Start an offset at lattice step (di, dj) and ease it home: the whole graph
   * for a recentre, only the names for a transpose (the nodes stay put).
   */
  const slideFrom = (di: number, dj: number, namesOnly = false) => {
    const p = latticeToXY(di, dj);
    const live = namesOnly ? nameSlideRef.current : slideRef.current;
    live.x += E * p.x;
    live.y -= E * p.y; // world y up → SVG y down
    // draw enough lattice that nothing pops in at the edges on the way
    const g = slideRef.current;
    const n = nameSlideRef.current;
    setMargin(E + Math.max(Math.hypot(g.x, g.y), Math.hypot(g.x + n.x, g.y + n.y)));
    placeGroups();
    const ref = namesOnly ? nameTweenRef : tweenRef;
    ref.current?.kill();
    ref.current = gsap.to(live, {
      x: 0,
      y: 0,
      duration: namesOnly ? 0.45 : 0.6,
      ease: 'power3.inOut',
      onUpdate: placeGroups,
      onComplete: () => {
        if (namesOnly) setNameFrom(null);
        const other = namesOnly ? tweenRef.current : nameTweenRef.current;
        if (!other?.isActive()) setMargin(E);
      },
    });
  };

  // A transposed centre (arrow keys, transpose control) slides the notes onto their new nodes.
  useLayoutEffect(() => {
    const prev = prevCentreRef.current;
    prevCentreRef.current = el.centre;
    if (prev === el.centre) return;
    if (recentringRef.current) {
      recentringRef.current = false;
      return;
    }
    const step = TRANSPOSE_STEP[(el.centre - prev + 12) % 12];
    if (step) {
      setNameFrom([-step[0], -step[1]]);
      slideFrom(-step[0], -step[1], true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el.centre]);

  // Re-applied after every render, so React never drops a running slide's transform.
  useLayoutEffect(placeGroups);

  // Everything that can show on the stage, plus a margin while sliding.
  const { tris, nodes } = useMemo(() => {
    const tris: Tri[] = [];
    const nodes: Node[] = [];
    for (let i = -24; i <= 24; i++) {
      for (let j = -16; j <= 16; j++) {
        if (inStage(toPx(i, j, ZERO), margin)) nodes.push({ key: `${i},${j}`, i, j, pc: pcAt(el.centre, i, j) });
        for (const major of [true, false]) {
          const pos = { i, j, major };
          const c = triangleCentroid(pos);
          if (!inStage(toPx(c.i, c.j, ZERO), margin)) continue;
          tris.push({ key: `${i},${j},${major ? 'M' : 'm'}`, pos, triad: triangleAt(el.centre, pos), c });
        }
      }
    }
    return { tris, nodes };
  }, [el.centre, margin]);

  const store = () => canvasStore.getState();

  const playTriad = (t: Triad) => {
    setPlaying(true);
    setLit(t);
    playChord(triadPitches(t), {
      onLit: (s) => {
        if (s.size === 0) setLit(null);
      },
      onDone: () => setPlaying(false),
    });
  };

  const playNote = (pc: number) => {
    getAudioEngine().triggerNote(36 + pc, 900);
    setLitNote(pc);
    window.setTimeout(() => setLitNote((n) => (n === pc ? null : n)), 500);
  };

  const selectTriad = (t: Triad) => {
    store().updateElement(el.id, { triad: t }, { commit: true });
    playTriad(t);
  };

  const recentre = (i: number, j: number) => {
    const pc = pcAt(el.centre, i, j);
    if (i === 0 && j === 0) return;
    // The clicked note becomes (0, 0): start the new view where it was.
    slideFrom(i, j);
    if (pc !== el.centre) recentringRef.current = true;
    store().updateElement(el.id, { centre: pc }, { commit: true });
  };

  const doMove = (move: Move) => {
    const from = el.triad;
    if (!from) return;
    const to = applyMove(from, move);
    uiTick(MOVES.indexOf(move));
    store().updateElement(el.id, { triad: to }, { commit: true });
    const ends = [from, to];
    setPlaying(true);
    playProgression(voiceProgression(ends), {
      onStep: (k) => setLit(k < 0 ? null : ends[k]),
      onDone: () => setPlaying(false),
    }, 650);
  };

  // Typing P L R N S H moves when this card is the only selection.
  useEffect(() => {
    if (!selected || !soloSelected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      const move = MOVE_KEYS[e.key.toLowerCase()];
      if (!move) return;
      e.preventDefault();
      e.stopPropagation();
      doMove(move);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  });

  const open3D = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    worldStore.getState().open(el.id, r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null);
  };

  const centreName = NOTE_NAMES[el.centre];
  const outline = (d: number) =>
    windowCorners(d)
      .map(([i, j]) => toPx(i, j, { x: 0, y: 0 }))
      .map((p) => `${p.x},${p.y}`)
      .join(' ');

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div ref={wrapRef} className={`${chordStyles.wrap} ${styles.wrap}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span
            className={`${chordStyles.nameTab} ${styles.nameTab}`}
            role="button"
            tabIndex={0}
            aria-expanded={tuneOpen}
            title="Tonnetz settings"
            // a press that turns into a drag moves the card instead of opening
            onPointerDown={(e) => (pressRef.current = { x: e.clientX, y: e.clientY })}
            onClick={(e) => {
              const p = pressRef.current;
              if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
              e.stopPropagation();
              setTuneOpen((o) => !o);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setTuneOpen((o) => !o);
              }
            }}
          >
            <span className={chordStyles.nameTabInner}>Tonnetz – {centreName}</span>
          </span>
          {tuneOpen && (
            <div
              ref={tuneRef}
              className={styles.tune}
              role="dialog"
              aria-label="Tonnetz settings"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <label className={styles.tuneRow}>
                <span>Repeat opacity</span>
                <span className={styles.tuneValue}>{Math.round(repeats * 100)}%</span>
              </label>
              <input
                className={styles.tuneSlider}
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(repeats * 100)}
                aria-label="Opacity of the repeats around the main repetition"
                onChange={(e) => store().updateElement(el.id, { repeats: Number(e.target.value) / 100 })}
                onPointerUp={() => store().updateElement(el.id, { repeats }, { commit: true })}
                onKeyUp={() => store().updateElement(el.id, { repeats }, { commit: true })}
              />
            </div>
          )}
          <PlayButton playing={playing} onClick={() => playTriad(el.triad ?? { root: el.centre, minor: false })} />
        </div>
        {/* a click anywhere else on the card (repeats, legend, margins) clears the selected triad */}
        <div
          className={`${chordStyles.card} ${styles.body}`}
          onPointerDownCapture={(e) => (cardPressRef.current = { x: e.clientX, y: e.clientY })}
          onClick={(e) => {
            const p = cardPressRef.current;
            if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return; // that was a drag
            if (el.triad) store().updateElement(el.id, { triad: null }, { commit: true });
          }}
        >
          {/* only the controls swallow presses and clicks; the gaps select the card and clear the triad */}
          <div className={styles.bar}>
            <div className={styles.toggles}>
              <label
                className={styles.check}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={el.showChords}
                  onChange={(e) => store().updateElement(el.id, { showChords: e.target.checked }, { commit: true })}
                />
                <span className={styles.box} aria-hidden />
                Chord names
              </label>
              <label
                className={styles.check}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={el.showLegend}
                  onChange={(e) => store().updateElement(el.id, { showLegend: e.target.checked }, { commit: true })}
                />
                <span className={styles.box} aria-hidden />
                Show legend
              </label>
            </div>
            <button
              className={styles.pill}
              title="Open the Tonnetz in 3D"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerEnter={prefetchWorld}
              onFocus={prefetchWorld}
              onClick={(e) => {
                e.stopPropagation();
                open3D();
              }}
            >
              3D
            </button>
          </div>

          <div ref={stageRef} className={styles.stage}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label={`Tonnetz centred on ${centreName}`}
              className={styles.svg}
              data-chords={el.showChords || undefined}
              style={
                {
                  '--tz-repeats': repeats,
                  ...(glass ? { '--tz-major-fill': `url(#tzMaj${uid})`, '--tz-minor-fill': `url(#tzMin${uid})` } : {}),
                } as React.CSSProperties
              }
            >
              <defs>
                {glass && <GlassGradient id={`glass${uid}`} color="var(--text-muted)" quiet />}
                {glass && <GlassGradient id={`glassLit${uid}`} color="var(--accent)" />}
                {glass &&
                  (['Maj', 'Min'] as const).map((k) => {
                    const c = k === 'Maj' ? 'var(--tonnetz-major)' : 'var(--tonnetz-minor)';
                    return (
                      <linearGradient key={k} id={`tz${k}${uid}`} x1="0.2" y1="0" x2="0.8" y2="1">
                        <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${c} 82%, #fff)` }} />
                        <stop offset="0.45" style={{ stopColor: c }} />
                        <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${c} 86%, #000)` }} />
                      </linearGradient>
                    );
                  })}
                {/* names fade by where they are, not by a flag: full inside the window
                    (grown to cover the border nodes), the repeats alpha outside */}
                <mask id={`names${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
                  <rect width={W} height={H} fill="#fff" fillOpacity={repeats} />
                  <polygon points={outline(0.18)} fill="#fff" filter={`url(#soft${uid})`} />
                </mask>
                <mask id={`chords${uid}`} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
                  <rect width={W} height={H} fill="#fff" fillOpacity={repeats} />
                  <polygon points={outline(0)} fill="#fff" />
                </mask>
                <filter id={`soft${uid}`} x="-5%" y="-5%" width="110%" height="110%">
                  <feGaussianBlur stdDeviation="1.2" />
                </filter>
              </defs>

              {/* one group, so the legends can draw it again behind themselves */}
              <g id={`lat${uid}`}>
                <g ref={triGroupRef}>
                  {tris.map((t) => {
                    const pts = triangleCorners(t.pos)
                      .map(([i, j]) => toPx(i, j, ZERO))
                      .map((p) => `${p.x},${p.y}`)
                      .join(' ');
                    const isSel = sameTriad(t.triad, el.triad);
                    const isLit = sameTriad(t.triad, lit);
                    const out = !pxInWindow(toPx(t.c.i, t.c.j, ZERO));
                    return (
                      <polygon
                        key={t.key}
                        points={pts}
                        className={styles.tri}
                        data-minor={t.triad.minor || undefined}
                        data-out={out || undefined}
                        data-selected={isSel || undefined}
                        data-lit={isLit || undefined}
                        onPointerDown={(e) => !out && e.stopPropagation()}
                        // the faded repeats are background: a click there falls through and deselects
                        onClick={(e) => {
                          if (out) return;
                          e.stopPropagation();
                          selectTriad(t.triad);
                        }}
                      >
                        <title>{triadName(t.triad)}</title>
                      </polygon>
                    );
                  })}

                </g>

                {/* the window border runs under the nodes */}
                <polygon points={outline(0)} className={styles.border} />

                <g ref={nodeGroupRef}>
                  {nodes.map((n) => {
                    const p = toPx(n.i, n.j, ZERO);
                    const isCentre = n.i === 0 && n.j === 0;
                    const inTriad = el.triad ? touches(el.centre, n.i, n.j, el.triad) : false;
                    const r = isCentre ? R_NODE + 2.5 : R_NODE;
                    const nodeOut = !pxInWindow(p, 0.01);
                    return (
                      <g
                        key={n.key}
                        className={styles.node}
                        data-out={nodeOut || undefined}
                        data-centre={isCentre || undefined}
                        data-tone={inTriad || undefined}
                        data-lit={litNote === n.pc || undefined}
                        onPointerDown={(e) => !nodeOut && e.stopPropagation()}
                        // faded notes are background for a click (it deselects); double-click still recentres
                        onClick={(e) => {
                          if (nodeOut) return;
                          e.stopPropagation();
                          playNote(n.pc);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          recentre(n.i, n.j);
                        }}
                      >
                        <circle cx={p.x} cy={p.y} r={r} className={styles.disc} />
                        {glass && (
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={r - 0.7}
                            fill={`url(#${inTriad ? 'glassLit' : 'glass'}${uid})`}
                            pointerEvents="none"
                          />
                        )}
                      </g>
                    );
                  })}
                </g>

                {/* names ride on their own layers: a transpose slides them between fixed nodes */}
                {el.showChords && (
                  // chord names: exactly the window, so none straddling it lights halfway
                  <g mask={`url(#chords${uid})`} pointerEvents="none">
                    <g ref={chordGroupRef}>
                      {tris.map((t) => {
                        const p = toPx(t.c.i, t.c.j, ZERO);
                        // styled by where it is drawn now (its start node while a transpose slides)
                        const [si, sj] = nameFrom ?? [0, 0];
                        const at = { i: t.pos.i + si, j: t.pos.j + sj, major: t.pos.major };
                        return (
                          <text
                            key={`l${t.key}`}
                            x={p.x}
                            y={p.y + 4}
                            className={styles.chordLabel}
                            data-selected={sameTriad(triangleAt(el.centre, at), el.triad) || undefined}
                          >
                            {triadName(t.triad)}
                          </text>
                        );
                      })}
                    </g>
                  </g>
                )}
                <g mask={`url(#names${uid})`} pointerEvents="none">
                  <g ref={labelGroupRef}>
                    {nodes.map((n) => {
                      const p = toPx(n.i, n.j, ZERO);
                      const [si, sj] = nameFrom ?? [0, 0];
                      const ai = n.i + si;
                      const aj = n.j + sj;
                      const isCentre = ai === 0 && aj === 0;
                      return (
                        <text
                          key={`n${n.key}`}
                          x={p.x}
                          y={p.y + (isCentre ? 5.5 : 4.2)}
                          className={styles.noteLabel}
                          data-centre={isCentre || undefined}
                          data-tone={(el.triad && touches(el.centre, ai, aj, el.triad)) || undefined}
                        >
                          {NOTE_NAMES[n.pc]}
                        </text>
                      );
                    })}
                  </g>
                </g>
              </g>
            </svg>
            {el.showLegend && (
              <>
                <div ref={keyLegendRef} className={`${styles.legend} ${styles.legendKey}`} aria-hidden>
                  <LegendBackdrop latticeId={`lat${uid}`} viewBox={backdrops.key} />
                  <LegendKey />
                </div>
                <div ref={movesLegendRef} className={`${styles.legend} ${styles.legendMoves}`} aria-hidden>
                  <LegendBackdrop latticeId={`lat${uid}`} viewBox={backdrops.moves} />
                  <LegendMoves />
                </div>
              </>
            )}
            <span onClick={(e) => e.stopPropagation()}>
              <TransposeControl id={el.id} visible={selected && soloSelected} />
            </span>
          </div>

          <div className={styles.moves}>
            {MOVES.map((m) => (
              <button
                key={m}
                className={styles.move}
                onPointerDown={(e) => e.stopPropagation()}
                disabled={!el.triad}
                title={el.triad ? moveLabel(el.triad, m) : 'Select a triangle first'}
                aria-label={el.triad ? moveLabel(el.triad, m) : `${m} move`}
                onClick={(e) => {
                  e.stopPropagation();
                  doMove(m);
                }}
              >
                {m}
              </button>
            ))}
            <span className={styles.current}>{el.triad ? triadName(el.triad) : ''}</span>
          </div>
        </div>
      </div>
    </ElementShell>
  );
}

/** Is the note at (i, j) a corner of a copy of `t`? (6 triangles meet at a node.) */
/**
 * Behind a legend: the lattice drawn again at full strength (repeats and the
 * edge fade lifted), blurred and tinted, as the 3D view's panels.
 */
function LegendBackdrop({ latticeId, viewBox }: { latticeId: string; viewBox?: string }) {
  return (
    <span className={styles.backdrop} aria-hidden>
      {viewBox && (
        <svg viewBox={viewBox} preserveAspectRatio="none" className={styles.backdropLattice}>
          <use href={`#${latticeId}`} />
        </svg>
      )}
    </span>
  );
}

const touches = (centre: number, i: number, j: number, t: Triad) =>
  [
    { i, j, major: true },
    { i: i - 1, j, major: true },
    { i, j: j - 1, major: true },
    { i: i - 1, j, major: false },
    { i, j: j - 1, major: false },
    { i: i - 1, j: j - 1, major: false },
  ].some((p) => sameTriad(triangleAt(centre, p), t));
