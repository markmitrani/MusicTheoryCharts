'use client';

import { Fragment } from 'react';
import { walkPcs, type WalkStep } from '@/lib/theory/cadence';
import styles from './Breadcrumb.module.scss';

interface BreadcrumbProps {
  walk: WalkStep[];
  name: (pc: number) => string;
  /** Crumb index currently sounding, -1 for none. */
  playing?: number;
  onPick: (index: number) => void;
}

const MAX_SHOWN = 6;

/**
 * Explorer-style trail of the walk: I › V › II. Clicking a crumb zooms back
 * to it; a ⇄ marks where the walk flipped between ways in and homes.
 */
export function Breadcrumb({ walk, name, playing = -1, onPick }: BreadcrumbProps) {
  const pcs = walkPcs(walk);
  const last = pcs.length - 1;
  const shown = pcs.length > MAX_SHOWN ? [0, -1, ...pcs.map((_, i) => i).slice(-(MAX_SHOWN - 2))] : pcs.map((_, i) => i);

  return (
    <nav className={styles.crumbs} aria-label="Walk" onPointerDown={(e) => e.stopPropagation()}>
      {shown.map((i, n) => {
        const turn = i >= 2 && walk[i - 1].dir !== walk[i - 2].dir;
        return (
          <Fragment key={i}>
            {n > 0 && (
              <span className={turn ? styles.turn : styles.sep} aria-hidden="true">
                {turn ? '⇄' : '›'}
              </span>
            )}
            {i < 0 ? (
              <span className={styles.more}>…</span>
            ) : (
              <button
                className={styles.crumb}
                data-current={i === last || undefined}
                data-playing={i === playing || undefined}
                disabled={i === last}
                title={i === last ? undefined : 'Zoom back here'}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(i);
                }}
              >
                {name(pcs[i])}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
