'use client';

import type { Direction } from '@/lib/theory/cadence';
import styles from './DirectionSwitch.module.scss';

const OPTIONS: Array<{ dir: Direction; label: string; hint: string }> = [
  { dir: 'in', label: 'Ways in', hint: 'Chords that lead to the centre' },
  { dir: 'out', label: 'Homes', hint: 'Where the centre can go' },
];

/** Segmented flip between ways in and homes. */
export function DirectionSwitch({ dir, onChange }: { dir: Direction; onChange: (dir: Direction) => void }) {
  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Direction" onPointerDown={(e) => e.stopPropagation()}>
      {OPTIONS.map((o) => (
        <button
          key={o.dir}
          role="radio"
          aria-checked={dir === o.dir}
          title={o.hint}
          className={styles.seg}
          data-active={dir === o.dir || undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (dir !== o.dir) onChange(o.dir);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
