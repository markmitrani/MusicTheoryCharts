'use client';

import { useCallback, useState } from 'react';
import {
  numeral,
  rootName,
  runToProgression,
  voiceProgression,
  walkPcs,
  walkToProgression,
  type CadenceType,
} from '@/lib/theory/cadence';
import type { WaysHomeElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { lessonStore } from '@/lib/lesson/store';
import { playProgression, uiTick } from '@/lib/playback/playback';
import { FractalScene, type NodeLabel } from '@/components/cadence/FractalScene';
import { Breadcrumb } from '@/components/cadence/Breadcrumb';
import { DirectionSwitch } from '@/components/cadence/DirectionSwitch';
import { CornerLegend } from '@/components/cadence/CornerLegend';
import { LightbulbIcon } from '@/components/chrome/icons';
import { ElementShell } from '../ElementShell';
import { PlayButton } from './PlayButton';
import chordStyles from './ChordCard.module.scss';
import styles from './WaysHomeCard.module.scss';

interface WaysHomeCardProps {
  el: WaysHomeElement;
  selected: boolean;
  soloSelected: boolean;
}

const MAX_WALK = 12;
export const CHORD_MS = 950;

/**
 * Ways Home: the cadence fractal on the canvas. Click a chord to hear the move
 * and travel there; flip to see where the centre can go; the breadcrumb is the
 * walk (click to zoom back) and the play button plays it as a progression.
 */
export function WaysHomeCard({ el, selected, soloSelected }: WaysHomeCardProps) {
  const [playingCrumb, setPlayingCrumb] = useState(-1);
  const pcs = walkPcs(el.walk);
  const focus = pcs[pcs.length - 1];
  const key = el.key;

  const name = useCallback((pc: number) => (key ? rootName(pc, key) : numeral(pc)), [key]);
  const labelFor = useCallback(
    (pc: number): NodeLabel => (key ? { main: rootName(pc, key), sub: numeral(pc) } : { main: numeral(pc) }),
    [key],
  );

  const update = (patch: Partial<WaysHomeElement>) =>
    canvasStore.getState().updateElement(el.id, patch, { commit: true });

  const travel = (rel: CadenceType[]) => {
    if (el.walk.length + rel.length > MAX_WALK) return;
    const chords = voiceProgression(runToProgression(focus, el.dir, rel), key ?? 'C');
    playProgression(chords, { onStep: () => {}, onDone: () => {} }, CHORD_MS);
    update({ walk: [...el.walk, ...rel.map((type) => ({ dir: el.dir, type }))] });
  };

  const playWalk = () => {
    const progression = walkToProgression(el.walk);
    // Map each chord back to its crumb: the last run, heard in musical time.
    let start = el.walk.length - 1;
    while (start > 0 && el.walk[start - 1].dir === el.walk[el.walk.length - 1].dir) start--;
    const inward = el.walk.length > 0 && el.walk[el.walk.length - 1].dir === 'in';
    const crumbOf = (j: number) => (el.walk.length === 0 ? 0 : inward ? pcs.length - 1 - j : start + j);
    playProgression(
      voiceProgression(progression, key ?? 'C'),
      {
        onStep: (j) => setPlayingCrumb(j < 0 ? -1 : crumbOf(j)),
        onDone: () => setPlayingCrumb(-1),
      },
      CHORD_MS,
    );
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div className={`${chordStyles.wrap} ${styles.wrap}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <span className={chordStyles.nameTab}>
            <span className={chordStyles.nameTabInner}>Ways Home – {name(focus)}</span>
          </span>
          <PlayButton playing={playingCrumb >= 0} onClick={playWalk} />
        </div>
        <div className={chordStyles.card}>
          <div className={styles.topBar}>
            <Breadcrumb
              walk={el.walk}
              name={name}
              playing={playingCrumb}
              onPick={(i) => {
                uiTick(i);
                update({ walk: el.walk.slice(0, i) });
              }}
            />
            <div className={styles.actions}>
              <button
                className={styles.legendBtn}
                aria-pressed={el.showLegend}
                data-active={el.showLegend || undefined}
                title={el.showLegend ? 'Hide the colour key' : 'Show the colour key'}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  update({ showLegend: !el.showLegend });
                }}
              >
                Legend
              </button>
              <button
                className={styles.explainBtn}
                title="Open the explainer"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  uiTick(2);
                  lessonStore.getState().openLesson('ways-home', el.id);
                }}
              >
                <LightbulbIcon width={15} height={15} />
                Explainer
              </button>
            </div>
          </div>
          <div className={styles.stage}>
            <FractalScene
              walk={el.walk}
              dir={el.dir}
              labelFor={labelFor}
              interactive
              onNodeClick={travel}
              ariaLabel={`Ways home fractal centred on ${name(focus)}`}
            />
            {el.showLegend && <CornerLegend />}
          </div>
          <div className={styles.bottomBar}>
            <DirectionSwitch
              dir={el.dir}
              onChange={(dir) => {
                uiTick(dir === 'in' ? 0 : 3);
                update({ dir });
              }}
            />
          </div>
        </div>
      </div>
    </ElementShell>
  );
}
