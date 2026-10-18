'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CADENCES,
  keyLabel,
  numeral,
  rootName,
  runToProgression,
  voiceProgression,
  walkPcs,
  walkToProgression,
  type CadenceType,
  type ChordSpec,
  type Direction,
  type WalkStep,
} from '@/lib/theory/cadence';
import { canvasStore } from '@/lib/canvas-store/store';
import type { NoteName } from '@/lib/theory/note';
import { lessonStore, useLesson } from '@/lib/lesson/store';
import { playProgression, uiTick } from '@/lib/playback/playback';
import { WAYS_HOME_SLIDES, WAYS_HOME_TITLE } from '@/lessons/ways-home';
import { LessonWindow } from '@/components/lesson/LessonWindow';
import { PianoKeys } from '@/components/canvas/PianoKeys';
import { PlayButton } from '@/components/canvas/elements/PlayButton';
import { CHORD_MS } from '@/components/canvas/elements/WaysHomeCard';
import { CadenceStage } from './CadenceStage';
import { moveLights, walkLights, type LitNode } from './lights';
import { ChainStrip } from './ChainStrip';
import { Breadcrumb } from './Breadcrumb';
import { DirectionSwitch } from './DirectionSwitch';
import { CornerLegend } from './CornerLegend';
import { Acc } from './Acc';
import { KeyPicker } from './KeyPicker';
import type { NodeLabel } from './FractalScene';
import type { Road } from './RoadsRing';
import { useIsMobile } from '@/lib/use-mobile';
import styles from './WaysHomeLesson.module.scss';

const NO_PITCHES = new Set<number>();
const GROW_STEPS_MS = [1500, 2500];

/** The "Many Ways Home" explainer: seven slides ending on the live explorer. */
export function WaysHomeLesson() {
  const slideIdx = useLesson((s) => s.slide);
  const sourceId = useLesson((s) => s.sourceId);
  const slide = WAYS_HOME_SLIDES[slideIdx];
  const stage = slide.stage;
  const mobile = useIsMobile();

  // The finale speaks the launching card's key; the narrative is in C.
  const sourceKey = (() => {
    const el = canvasStore.getState().activePage().elements.find((e) => e.id === sourceId);
    return el?.kind === 'wayshome' ? el.key : null;
  })();

  const [explorer, setExplorer] = useState<{ walk: WalkStep[]; dir: Direction }>({ walk: [], dir: 'in' });
  const [finaleKey, setFinaleKey] = useState<NoteName | null>(sourceKey);
  const [picking, setPicking] = useState(false);
  const [growLevel, setGrowLevel] = useState(1);
  const [active, setActive] = useState<{ id: string; index: number } | null>(null);
  const [lit, setLit] = useState<ReadonlySet<number>>(NO_PITCHES);
  const [playingNode, setPlayingNode] = useState<LitNode | null>(null);

  useEffect(() => {
    if (stage.scene !== 'fractal' || !stage.grow) return;
    setGrowLevel(1);
    const timers = GROW_STEPS_MS.map((ms, i) => window.setTimeout(() => setGrowLevel(i + 2), ms));
    return () => timers.forEach(clearTimeout);
  }, [slideIdx, stage]);

  const finale = stage.scene === 'explorer';
  const key = finale ? finaleKey : 'C';

  const labelFor = useCallback(
    (pc: number): NodeLabel => {
      if (!finale) return { main: numeral(pc), sub: rootName(pc, 'C') };
      return finaleKey ? { main: rootName(pc, finaleKey), sub: numeral(pc) } : { main: numeral(pc) };
    },
    [finale, finaleKey],
  );

  /** `lights`: the fractal node to light at each chord, when the chords live on the graph. */
  const play = (id: string, chords: ChordSpec[], lights: LitNode[] = []) => {
    const voiced = voiceProgression(chords, key ?? 'C');
    playProgression(
      voiced,
      {
        onStep: (i) => {
          setActive(i < 0 ? null : { id, index: i });
          setLit(i < 0 ? NO_PITCHES : new Set(voiced[i]));
          setPlayingNode(i < 0 ? null : (lights[i] ?? null));
        },
        onDone: () => {
          setActive(null);
          setLit(NO_PITCHES);
          setPlayingNode(null);
        },
      },
      CHORD_MS,
    );
  };

  const onNodeClick = (rel: CadenceType[]) => {
    const frame = finale ? explorer : stage.scene === 'fractal' ? stage : null;
    if (!frame) return;
    play('node', runToProgression(walkPcs(frame.walk).at(-1)!, frame.dir, rel), moveLights(frame.walk, frame.dir, rel));
  };

  const onNodeDoubleClick = (rel: CadenceType[]) => {
    if (explorer.walk.length + rel.length > 12) return;
    onNodeClick(rel);
    setExplorer((x) => ({ ...x, walk: [...x.walk, ...rel.map((type) => ({ dir: x.dir, type }))] }));
  };

  const onRoadClick = (road: Road) =>
    play('road', [
      { pc: road.from, quality: CADENCES[road.type].approachQuality },
      { pc: road.to, quality: 'maj7' },
    ]);

  const legendTypes =
    stage.scene === 'roads'
      ? (['dominant', 'plagal'] as CadenceType[])
      : stage.scene === 'fractal'
        ? (stage.corners ?? null)
        : null;

  const names = (pc: number) => (finaleKey ? rootName(pc, finaleKey) : numeral(pc));
  const pcs = walkPcs(explorer.walk);
  // Crumb lit while the walk plays: the last run, in musical time.
  const runStart = (() => {
    let s = explorer.walk.length - 1;
    while (s > 0 && explorer.walk[s - 1].dir === explorer.walk[explorer.walk.length - 1].dir) s--;
    return s;
  })();
  const inward = explorer.walk.at(-1)?.dir === 'in';
  const playingCrumb =
    active?.id === 'walk' ? (explorer.walk.length === 0 ? 0 : inward ? pcs.length - 1 - active.index : runStart + active.index) : -1;

  return (
    <LessonWindow
      label={WAYS_HOME_TITLE}
      slideCount={WAYS_HOME_SLIDES.length}
      slide={slideIdx}
      onSlide={(n) => lessonStore.getState().setSlide(n)}
      onClose={() => lessonStore.getState().close()}
    >
      <div className={styles.layout}>
        <article key={slide.id} className={styles.text}>
          <p className={styles.kicker}>
            {WAYS_HOME_TITLE} · {slideIdx + 1} of {WAYS_HOME_SLIDES.length}
          </p>
          <h2 className={styles.title}>{slide.title}</h2>
          {slide.body.map((p, i) => (
            <p key={i} className={styles.para}>
              <Acc text={p} />
            </p>
          ))}
          {slide.chains && (
            <div className={styles.chains}>
              {slide.chains.map((t) => (
                <ChainStrip key={t} type={t} active={active} onPlay={play} />
              ))}
            </div>
          )}
          <div className={styles.drill}>
            <span className={styles.drillLabel}>At the piano</span>
            <p>
              <Acc text={slide.drill} />
            </p>
          </div>
          {!finale && (
            <p className={styles.hint}>
              {mobile ? 'Tap any arrow or chord below to hear it.' : 'Click any arrow or chord on the right to hear it.'}
            </p>
          )}
        </article>

        <div className={styles.stageCol}>
          <div className={styles.explorerBar} data-hidden={!finale || undefined}>
            <Breadcrumb
              walk={explorer.walk}
              name={names}
              playing={playingCrumb}
              onPick={(i) => {
                uiTick(i);
                setExplorer((x) => ({ ...x, walk: x.walk.slice(0, i) }));
              }}
            />
            <div className={styles.explorerActions}>
              <button
                className={styles.keyBtn}
                data-key-anchor
                aria-expanded={picking}
                title="Choose the home key"
                onClick={() => setPicking((v) => !v)}
              >
                {finaleKey ? (
                  <>
                    Key <Acc text={keyLabel(finaleKey)} />
                  </>
                ) : (
                  'Functional'
                )}
              </button>
              <PlayButton playing={active?.id === 'walk'} onClick={() => play('walk', walkToProgression(explorer.walk), walkLights(explorer.walk))} />
              {picking && (
                <KeyPicker
                  value={finaleKey}
                  onChange={(k) => {
                    uiTick(k ? 1 : 0);
                    setFinaleKey(k);
                  }}
                  onClose={() => setPicking(false)}
                />
              )}
            </div>
          </div>
          <div className={styles.stage}>
            <CadenceStage
              stage={stage}
              explorer={explorer}
              growLevel={growLevel}
              labelFor={labelFor}
              playing={playingNode}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onRoadClick={onRoadClick}
              scale={stage.scene === 'fractal' && (stage.maxLevel ?? 2) <= 1 ? 1.28 : 1}
            />
            <CornerLegend
              key={legendTypes?.join() ?? 'all'}
              types={legendTypes}
              dir={finale ? explorer.dir : stage.scene === 'fractal' ? stage.dir : 'in'}
            />
          </div>
          <div className={styles.switchRow} data-hidden={!finale || undefined}>
            <DirectionSwitch
              dir={explorer.dir}
              onChange={(dir) => {
                uiTick(dir === 'in' ? 0 : 3);
                setExplorer((x) => ({ ...x, dir }));
              }}
            />
          </div>
          <div className={styles.piano}>
            <PianoKeys baseC={12} octaves={4} highlighted={NO_PITCHES} lit={lit} />
          </div>
        </div>
      </div>
    </LessonWindow>
  );
}
