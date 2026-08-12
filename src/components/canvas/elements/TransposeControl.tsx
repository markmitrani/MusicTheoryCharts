'use client';

import { canvasStore } from '@/lib/canvas-store/store';
import { ChevronUpIcon, ChevronDownIcon } from '@/components/chrome/icons';
import styles from './TransposeControl.module.scss';

/**
 * Small ▲▼ overlay on a piano that transposes that element by a semitone.
 * (Keyboard ↑/↓ transposes the whole selection; Shift moves by a fifth.)
 */
export function TransposeControl({ id, visible }: { id: string; visible: boolean }) {
  const bump = (semitones: number) => (e: React.MouseEvent) => {
    e.stopPropagation();
    canvasStore.getState().transposeElements([id], semitones);
  };

  return (
    <div className={styles.control} data-visible={visible || undefined} onPointerDown={(e) => e.stopPropagation()}>
      <button className={styles.btn} aria-label="Transpose up a semitone" title="Transpose up" onClick={bump(1)}>
        <ChevronUpIcon width={14} height={14} />
      </button>
      <button
        className={styles.btn}
        aria-label="Transpose down a semitone"
        title="Transpose down"
        onClick={bump(-1)}
      >
        <ChevronDownIcon width={14} height={14} />
      </button>
    </div>
  );
}
