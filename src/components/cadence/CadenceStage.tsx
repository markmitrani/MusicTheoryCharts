'use client';

import { useRef } from 'react';
import type { CadenceType, Direction, WalkStep } from '@/lib/theory/cadence';
import type { StageState } from '@/lessons/ways-home';
import { FractalScene, type NodeLabel } from './FractalScene';
import type { LitNode } from './lights';
import { RoadsRing, type Road, type RingLight } from './RoadsRing';
import styles from './CadenceStage.module.scss';

type FractalProps = { walk: WalkStep[]; dir: Direction; corners: CadenceType[] | null; maxLevel: number };

interface CadenceStageProps {
  stage: StageState;
  explorer: { walk: WalkStep[]; dir: Direction };
  /** Current level of a growing reveal (slides with `grow`). */
  growLevel: number;
  labelFor: (pc: number) => NodeLabel;
  onNodeClick: (rel: CadenceType[]) => void;
  onNodeDoubleClick?: (rel: CadenceType[]) => void;
  onRoadClick: (road: Road) => void;
  /** Camera scale for sparse slides; eases back to 1 as the map fills in. */
  scale?: number;
  /** Node sounding right now. */
  playing?: LitNode | null;
  /** Roads-ring stop sounding right now. */
  playingStop?: RingLight | null;
}

export const INTERLUDE_ROADS: Road[] = [
  { from: 7, to: 0, type: 'dominant', delay: 0.15 },
  { from: 0, to: 7, type: 'plagal', delay: 1.1 },
];

/**
 * The explainer's stage. One FractalScene stays mounted across slides so its
 * changes animate (reveals, zooms, flips); the roads ring fades over it for
 * the interlude while the fractal keeps its last state underneath.
 */
export function CadenceStage({
  stage,
  explorer,
  growLevel,
  labelFor,
  onNodeClick,
  onNodeDoubleClick,
  onRoadClick,
  scale = 1,
  playing = null,
  playingStop = null,
}: CadenceStageProps) {
  const lastFractal = useRef<FractalProps>({ walk: [], dir: 'in', corners: ['dominant'], maxLevel: 1 });
  if (stage.scene === 'fractal') {
    lastFractal.current = {
      walk: stage.walk,
      dir: stage.dir,
      corners: stage.corners ?? null,
      maxLevel: stage.grow ? growLevel : (stage.maxLevel ?? 2),
    };
  } else if (stage.scene === 'explorer') {
    lastFractal.current = { walk: explorer.walk, dir: explorer.dir, corners: null, maxLevel: 2 };
  }
  const f = lastFractal.current;
  const roads = stage.scene === 'roads';

  return (
    <div className={styles.stack}>
      <div className={styles.layer} data-hidden={roads || undefined} style={{ ['--zoom' as string]: scale }}>
        <FractalScene
          walk={f.walk}
          dir={f.dir}
          corners={f.corners}
          maxLevel={f.maxLevel}
          labelFor={labelFor}
          interactive={!roads}
          playing={playing}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={stage.scene === 'explorer' ? onNodeDoubleClick : undefined}
        />
      </div>
      {roads && (
        <div className={`${styles.layer} ${styles.over}`}>
          <RoadsRing centre="C" roads={INTERLUDE_ROADS} ghostNeighbours onRoadClick={onRoadClick} playing={playingStop} />
        </div>
      )}
    </div>
  );
}
