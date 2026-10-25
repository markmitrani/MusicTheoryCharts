'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
import {
  MOVES,
  applyMove,
  latticeToXY,
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

/** Window: notes i, j ∈ [−N, N], a parallelogram with horizontal top and bottom (as Wikipedia's figure). */
const N = 3;
const E = 56; // edge length in px
const PAD = 24;
const W = E * (2 * N + N) + PAD * 2; // row span 2N plus the slant N (half a step per row)
const H = E * 2 * N * (Math.sqrt(3) / 2) + PAD * 2;
const CX = W / 2;
const CY = H / 2;
const R_NODE = 13;

/** Lattice coordinate → stage px (world y is up, SVG y is down), shifted by the recentre slide. */
const toPx = (i: number, j: number, off: { x: number; y: number }) => {
  const p = latticeToXY(i, j);
  return { x: CX + E * p.x + off.x, y: CY - E * p.y + off.y };
};

/** The window outline in lattice coordinates, grown by `d` steps on every side. */
const windowCorners = (d: number): [number, number][] => [
  [-N - d, -N - d],
  [N + d, -N - d],
  [N + d, N + d],
  [-N - d, N + d],
];
const inWindow = (i: number, j: number, d = 0) => i >= -N - d && i <= N + d && j >= -N - d && j <= N + d;
/** Nodes on the rim stay whole: their clip grows by a node radius (lattice lines are 0.866·E apart). */
const NODE_GROW = (R_NODE + 3) / (E * (Math.sqrt(3) / 2));

/**
 * Torus seams (where the 12-note lattice repeats): lines i ≡ −2 (mod 4) run
 * along the major thirds, lines i + j ≡ −1 (mod 3) along the minor thirds.
 */
const SEAMS: [number, number, number, number][] = [
  ...[-6, -2, 2, 6].map((i) => [i, -12, i, 12] as [number, number, number, number]),
  ...[-10, -7, -4, -1, 2, 5, 8].map((u) => [u + 12, -12, u - 12, 12] as [number, number, number, number]),
];

interface Tri {
  key: string;
  pos: TriPos;
  triad: Triad;
}

interface Node {
  key: string;
  i: number;
  j: number;
  pc: number;
}

const MOVE_KEYS: Record<string, Move> = { p: 'P', l: 'L', r: 'R', n: 'N', s: 'S', h: 'H' };

/**
 * Tonnetz card: the flat lattice in the familiar Wikipedia orientation, fifths
 * (→), major thirds (↘) and minor thirds (↗), every triangle a triad (▽ major,
 * △ minor), framed as the figure's parallelogram with dashed seams where the
 * 12-note lattice repeats.
 * Double-click a note to recentre on it; click a triangle to select and play
 * it; the move bar (or typing P L R N S H) walks to a neighbouring triad.
 */
export function TonnetzCard({ el, selected, soloSelected }: TonnetzCardProps) {
  const glass = useSurfaces() === 'glass';
  const uid = useId().replace(/[:]/g, '');
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const [lit, setLit] = useState<Triad | null>(null);
  const [litNote, setLitNote] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Recentre slide: after the centre changes, the lattice starts where the old
  // view was and eases home. Only the offset is animated; shapes are recomputed.
  const slideRef = useRef({ x: 0, y: 0 });
  const [off, setOff] = useState({ x: 0, y: 0 });
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  useEffect(() => () => void tweenRef.current?.kill(), []);

  // While sliding, draw a margin beyond the window (clipped) so content moves through it.
  const margin = off.x !== 0 || off.y !== 0 ? 2 * N + 1 : 0;
  const { tris, nodes } = useMemo(() => {
    const tris: Tri[] = [];
    const nodes: Node[] = [];
    for (let i = -N - margin; i <= N + margin; i++) {
      for (let j = -N - margin; j <= N + margin; j++) {
        nodes.push({ key: `${i},${j}`, i, j, pc: pcAt(el.centre, i, j) });
        if (i === N + margin || j === N + margin) continue;
        for (const major of [true, false]) {
          const pos = { i, j, major };
          tris.push({ key: `${i},${j},${major ? 'M' : 'm'}`, pos, triad: triangleAt(el.centre, pos) });
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
    const p = latticeToXY(i, j);
    const live = slideRef.current;
    // The clicked note becomes (0, 0): start the new view where it was.
    live.x += E * p.x;
    live.y -= E * p.y; // world y up → SVG y down
    setOff({ ...live });
    tweenRef.current?.kill();
    tweenRef.current = gsap.to(live, {
      x: 0,
      y: 0,
      duration: 0.75,
      ease: 'power3.inOut',
      onUpdate: () => setOff({ x: live.x, y: live.y }),
    });
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
  const axisDirs: [number, number][] = [
    [1, 0],
    [0, 1],
    [1, -1],
  ];

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div ref={wrapRef} className={`${chordStyles.wrap} ${styles.wrap}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner}>Tonnetz – {centreName}</span>
          </span>
          <PlayButton playing={playing} onClick={() => playTriad(el.triad ?? { root: el.centre, minor: false })} />
        </div>
        <div className={chordStyles.card}>
          <div className={styles.bar} onPointerDown={(e) => e.stopPropagation()}>
            <div className={styles.toggles}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={el.showChords}
                  onChange={(e) => store().updateElement(el.id, { showChords: e.target.checked }, { commit: true })}
                />
                <span className={styles.box} aria-hidden />
                Chord names
              </label>
              <label className={styles.check}>
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

          <div className={styles.stage}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              width="100%"
              role="img"
              aria-label={`Tonnetz centred on ${centreName}`}
              className={styles.svg}
              data-chords={el.showChords || undefined}
            >
              <defs>
                <clipPath id={`win${uid}`}>
                  <polygon points={outline(0)} />
                </clipPath>
                <clipPath id={`winNodes${uid}`}>
                  <polygon points={outline(NODE_GROW)} />
                </clipPath>
                {glass && <GlassGradient id={`glass${uid}`} color="var(--text-muted)" quiet />}
                {glass && <GlassGradient id={`glassLit${uid}`} color="var(--accent)" />}
              </defs>

              <g clipPath={`url(#win${uid})`}>
                {tris.map((t) => {
                  const pts = triangleCorners(t.pos)
                    .map(([i, j]) => toPx(i, j, off))
                    .map((p) => `${p.x},${p.y}`)
                    .join(' ');
                  const isSel = sameTriad(t.triad, el.triad);
                  const isLit = sameTriad(t.triad, lit);
                  return (
                    <polygon
                      key={t.key}
                      points={pts}
                      className={styles.tri}
                      data-minor={t.triad.minor || undefined}
                      data-selected={isSel || undefined}
                      data-lit={isLit || undefined}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectTriad(t.triad);
                      }}
                    >
                      <title>{triadName(t.triad)}</title>
                    </polygon>
                  );
                })}

                {el.showChords &&
                  tris.map((t) => {
                    const c = triangleCentroid(t.pos);
                    const p = toPx(c.i, c.j, off);
                    return (
                      <text
                        key={`l${t.key}`}
                        x={p.x}
                        y={p.y + 4}
                        className={styles.chordLabel}
                        data-selected={sameTriad(t.triad, el.triad) || undefined}
                      >
                        {triadName(t.triad)}
                      </text>
                    );
                  })}

                {SEAMS.map(([i1, j1, i2, j2], k) => {
                  const a = toPx(i1, j1, off);
                  const b = toPx(i2, j2, off);
                  return <line key={`s${k}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.seam} />;
                })}

                {hover &&
                  axisDirs.map(([di, dj], k) => {
                    const a = toPx(hover.i - 8 * di, hover.j - 8 * dj, off);
                    const b = toPx(hover.i + 8 * di, hover.j + 8 * dj, off);
                    return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={styles.axis} data-axis={k} />;
                  })}

              </g>
              <polygon points={outline(0)} className={styles.frame} />

              <g clipPath={`url(#winNodes${uid})`}>
                {nodes.map((n) => {
                  const p = toPx(n.i, n.j, off);
                  const isCentre = n.i === 0 && n.j === 0;
                  const inTriad = el.triad ? touches(el.centre, n.i, n.j, el.triad) : false;
                  const r = isCentre ? R_NODE + 2.5 : R_NODE;
                  return (
                    <g
                      key={n.key}
                      className={styles.node}
                      data-edge={!inWindow(n.i, n.j) || undefined}
                      data-centre={isCentre || undefined}
                      data-tone={inTriad || undefined}
                      data-lit={litNote === n.pc || undefined}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerEnter={() => setHover({ i: n.i, j: n.j })}
                      onPointerLeave={() => setHover((h) => (h && h.i === n.i && h.j === n.j ? null : h))}
                      onClick={(e) => {
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
                      <text x={p.x} y={p.y + (isCentre ? 5.5 : 4.2)} className={styles.noteLabel}>
                        {NOTE_NAMES[n.pc]}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
            {el.showLegend && (
              <>
                <div className={`${styles.legend} ${styles.legendKey}`} aria-hidden>
                  <LegendKey />
                </div>
                <div className={`${styles.legend} ${styles.legendMoves}`} aria-hidden>
                  <LegendMoves />
                </div>
              </>
            )}
            <TransposeControl id={el.id} visible={selected && soloSelected} />
          </div>

          <div className={styles.moves} onPointerDown={(e) => e.stopPropagation()}>
            {MOVES.map((m) => (
              <button
                key={m}
                className={styles.move}
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
            <span className={styles.current}>{el.triad ? triadName(el.triad) : 'No triad'}</span>
          </div>
        </div>
      </div>
    </ElementShell>
  );
}

/** Is the note at (i, j) a corner of a copy of `t`? (6 triangles meet at a node.) */
const touches = (centre: number, i: number, j: number, t: Triad) =>
  [
    { i, j, major: true },
    { i: i - 1, j, major: true },
    { i, j: j - 1, major: true },
    { i: i - 1, j, major: false },
    { i, j: j - 1, major: false },
    { i: i - 1, j: j - 1, major: false },
  ].some((p) => sameTriad(triangleAt(centre, p), t));
