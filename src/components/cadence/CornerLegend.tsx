'use client';

import { CADENCES, CADENCE_TYPES, type CadenceType } from '@/lib/theory/cadence';
import styles from './CornerLegend.module.scss';

const ARROW = { tr: '↗', tl: '↖', bl: '↙', br: '↘' } as const;
const MOVE: Record<CadenceType, string> = {
  dominant: 'V→I',
  plagal: 'IV→I',
  backdoor: '♭VII→I',
  tritone: '♭II→I',
};

/** Colour key placed in the corner each move points to. */
export function CornerLegend({ types = CADENCE_TYPES }: { types?: CadenceType[] | null }) {
  return (
    <div className={styles.legend} aria-label="Legend">
      {(types ?? CADENCE_TYPES).map((t) => {
        const c = CADENCES[t];
        return (
          <span key={t} className={styles.item} data-corner={c.corner} style={{ color: c.colorVar }}>
            <span className={styles.arrow}>{ARROW[c.corner]}</span>
            <span className={styles.name}>{c.label}</span>
            <span className={styles.move}>{MOVE[t]}</span>
          </span>
        );
      })}
    </div>
  );
}
