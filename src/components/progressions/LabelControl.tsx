'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { LabelKind } from '@/lib/theory/progressions';
import { uiTick } from '@/lib/playback/playback';
import styles from './LabelControl.module.scss';

const NAMES: Record<LabelKind, string> = { functions: 'Functions', notes: 'Notes' };
const DRAG_START = 5;

interface LabelControlProps {
  /** Both kinds, in order: the first shown takes the big face. */
  order: LabelKind[];
  hidden?: LabelKind;
  onChange(order: LabelKind[], hidden: LabelKind | undefined): void;
}

/**
 * An orderable segmented control for what chords show. Click a segment to
 * switch it on or off (one always stays on); drag it past the other, or
 * ⌥←/⌥→, to swap them. With both on, the left one is big and the right one is
 * the subtitle.
 */
export function LabelControl({ order, hidden, onChange }: LabelControlProps) {
  const segRefs = useRef<Partial<Record<LabelKind, HTMLButtonElement | null>>>({});
  const drag = useRef<{ kind: LabelKind; pointer: number; x0: number; moved: boolean } | null>(null);

  const swap = () => {
    uiTick(2);
    onChange([order[1], order[0]], hidden);
  };

  const toggle = (kind: LabelKind) => {
    if (hidden === kind) {
      uiTick(1);
      onChange(order, undefined);
    } else if (!hidden) {
      uiTick(0);
      onChange(order, kind);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, kind: LabelKind) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, pointer: e.pointerId, x0: e.clientX, moved: false };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientX - d.x0) < DRAG_START) return;
    d.moved = true;
    // Swap as soon as the pointer crosses the other segment's middle.
    const other = order.find((k) => k !== d.kind)!;
    const r = segRefs.current[other]?.getBoundingClientRect();
    if (!r) return;
    const mine = order.indexOf(d.kind);
    const mid = r.left + r.width / 2;
    if ((mine === 0 && e.clientX > mid) || (mine === 1 && e.clientX < mid)) swap();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) toggle(d.kind);
  };

  return (
    <div className={styles.group} role="group" aria-label="Chord labels" onPointerDown={(e) => e.stopPropagation()}>
      {order.map((kind) => {
        const on = hidden !== kind;
        return (
          <button
            key={kind}
            ref={(n) => {
              segRefs.current[kind] = n;
            }}
            className={styles.segment}
            data-on={on || undefined}
            aria-pressed={on}
            title={`${NAMES[kind]} – click to show or hide, drag to reorder`}
            onPointerDown={(e) => onPointerDown(e, kind)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              drag.current = null;
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(kind);
              } else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                e.stopPropagation();
                const at = order.indexOf(kind);
                if ((e.key === 'ArrowLeft' && at === 1) || (e.key === 'ArrowRight' && at === 0)) swap();
              }
            }}
          >
            <span className={styles.grip} aria-hidden="true" />
            {NAMES[kind]}
          </button>
        );
      })}
    </div>
  );
}
