'use client';

import { useCallback, useState } from 'react';
import {
  keyLabel,
  numeral,
  rootName,
  runToProgression,
  voiceProgression,
  walkPcs,
  walkToProgression,
  type CadenceType,
  type ChordSpec,
} from '@/lib/theory/cadence';
import type { WaysHomeElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { lessonStore } from '@/lib/lesson/store';
import { playProgression, uiTick } from '@/lib/playback/playback';
import { FractalScene, type NodeLabel } from '@/components/cadence/FractalScene';
import { moveLights, walkLights, type LitNode } from '@/components/cadence/lights';
import { Breadcrumb } from '@/components/cadence/Breadcrumb';
import { DirectionSwitch } from '@/components/cadence/DirectionSwitch';
import { CornerLegend } from '@/components/cadence/CornerLegend';
import { KeyPicker } from '@/components/cadence/KeyPicker';
import { Acc } from '@/components/cadence/Acc';
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
/** Without the corner legend the fractal grows into the freed corners. */
const LEGENDLESS_SCALE = 1.17;
export const CHORD_MS = 950;

/**
 * Ways Home: the cadence fractal on the canvas. Click a chord to hear the move,
 * double-click to travel there; flip to see where the centre can go; the
 * breadcrumb is the walk (click to zoom back) and the play button plays it.
 */
export function WaysHomeCard({ el, selected, soloSelected }: WaysHomeCardProps) {
  const [playingCrumb, setPlayingCrumb] = useState(-1);
  const [playingNode, setPlayingNode] = useState<LitNode | null>(null);
  const [picking, setPicking] = useState(false);
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

  // Each chord lights its node as it sounds, so you can follow the move.
  const play = (chords: ChordSpec[], lights: LitNode[], onStep?: (j: number) => void, onDone?: () => void) =>
    playProgression(
      voiceProgression(chords, key ?? 'C'),
      {
        onStep: (j) => {
          setPlayingNode(j < 0 ? null : (lights[j] ?? null));
          onStep?.(j);
        },
        onDone: () => {
          setPlayingNode(null);
          onDone?.();
        },
      },
      CHORD_MS,
    );

  const listen = (rel: CadenceType[]) => play(runToProgression(focus, el.dir, rel), moveLights(el.walk, el.dir, rel));

  const travel = (rel: CadenceType[]) => {
    if (el.walk.length + rel.length > MAX_WALK) return;
    listen(rel);
    update({ walk: [...el.walk, ...rel.map((type) => ({ dir: el.dir, type }))] });
  };

  const playWalk = () => {
    const progression = walkToProgression(el.walk);
    // Map each chord back to its crumb: the last run, heard in musical time.
    let start = el.walk.length - 1;
    while (start > 0 && el.walk[start - 1].dir === el.walk[el.walk.length - 1].dir) start--;
    const inward = el.walk.length > 0 && el.walk[el.walk.length - 1].dir === 'in';
    const crumbOf = (j: number) => (el.walk.length === 0 ? 0 : inward ? pcs.length - 1 - j : start + j);
    play(
      progression,
      walkLights(el.walk),
      (j) => setPlayingCrumb(j < 0 ? -1 : crumbOf(j)),
      () => setPlayingCrumb(-1),
    );
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected} lifted={picking}>
      <div className={`${chordStyles.wrap} ${styles.wrap}`} data-selected={selected || undefined}>
        <div className={chordStyles.header}>
          <button
            className={chordStyles.nameTab}
            data-key-anchor
            title="Choose the home key"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setPicking((v) => !v);
            }}
          >
            <span className={chordStyles.nameTabInner}>
              Ways Home – <Acc text={name(focus)} />
              {key && focus !== 0 && (
                <span className={styles.inKey}>
                  &nbsp;(in <Acc text={keyLabel(key)} />)
                </span>
              )}
            </span>
          </button>
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
              playing={playingNode}
              onNodeClick={listen}
              onNodeDoubleClick={travel}
              scale={el.showLegend ? 1 : LEGENDLESS_SCALE}
              ariaLabel={`Ways home fractal centred on ${name(focus)}`}
            />
            {el.showLegend && <CornerLegend dir={el.dir} />}
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
        {picking && (
          <KeyPicker
            value={key}
            onChange={(k) => {
              uiTick(k ? 1 : 0);
              update({ key: k });
            }}
            onClose={() => setPicking(false)}
          />
        )}
      </div>
    </ElementShell>
  );
}
