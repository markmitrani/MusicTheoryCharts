'use client';

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { stepFollows, type LabelKind, type ResolvedChord } from '@/lib/theory/progressions';
import { uiTick } from '@/lib/playback/playback';
import { Acc } from '@/components/cadence/Acc';
import { CloseIcon, PencilIcon } from '@/components/chrome/icons';
import styles from './ProgressionTrail.module.scss';

interface ProgressionTrailProps {
  /** Written steps ("mode:id"), possibly from several modes. */
  trail: string[];
  resolved: Map<string, ResolvedChord>;
  /** Crumb sounding during playback, -1 for none. */
  playing: number;
  /** What a crumb shows: the chord's function or its name (the card's big label). */
  main: LabelKind;
  writing: boolean;
  onWritingChange(on: boolean): void;
  selected: number | null;
  onSelect(i: number | null): void;
  /** Move the chord at `from` so it lands before the chord now at `to` (to = length: the end). */
  onMove(from: number, to: number): void;
  onRemove(i: number): void;
  onClear(): void;
}

interface Drag {
  i: number;
  pointer: number;
  x0: number;
  y0: number;
  /** Screen px per CSS px: the canvas camera's zoom. */
  scale: number;
  moved: boolean;
}

const DRAG_START = 4;

/**
 * The written progression as a wrapping row of numeral crumbs. The pencil
 * toggles whether clicks on the map write. Click a crumb to select it (no
 * sound), drag to reorder, Delete or its × to remove; ←/→ move the selection,
 * ⌥←/⌥→ move the chord.
 */
export function ProgressionTrail({
  trail,
  resolved,
  playing,
  main,
  writing,
  onWritingChange,
  selected,
  onSelect,
  onMove,
  onRemove,
  onClear,
}: ProgressionTrailProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const drag = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState<{ i: number; dx: number; dy: number; target: number } | null>(null);

  // A click anywhere outside the row drops the selection.
  useEffect(() => {
    if (selected === null) return;
    const onDown = (e: PointerEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) onSelect(null);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [selected, onSelect]);

  /** Insertion index for a pointer, in reading order across wrapped lines. */
  const dropIndex = (cx: number, cy: number) => {
    for (let k = 0; k < trail.length; k++) {
      const r = stepRefs.current[k]?.getBoundingClientRect();
      if (!r) continue;
      if (cy < r.top) return k;
      if (cy <= r.bottom && cx < r.left + r.width / 2) return k;
    }
    return trail.length;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    const node = e.currentTarget;
    node.setPointerCapture(e.pointerId);
    drag.current = {
      i,
      pointer: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      scale: node.getBoundingClientRect().width / (node.offsetWidth || 1),
      moved: false,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_START) return;
    d.moved = true;
    setDragging({ i: d.i, dx: dx / d.scale, dy: dy / d.scale, target: dropIndex(e.clientX, e.clientY) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    drag.current = null;
    if (d.moved) {
      const to = dropIndex(e.clientX, e.clientY);
      setDragging(null);
      if (to !== d.i && to !== d.i + 1) {
        uiTick(2);
        onMove(d.i, to);
      }
      return;
    }
    // A plain click selects (or deselects) without sounding.
    onSelect(selected === d.i ? null : d.i);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (selected === null) return;
    // Keep the canvas from treating these as element shortcuts (delete, inversions).
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      e.stopPropagation();
      onRemove(selected);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      onSelect(null);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      const step = e.key === 'ArrowLeft' ? -1 : 1;
      const next = selected + step;
      if (next < 0 || next >= trail.length) return;
      if (e.altKey) onMove(selected, step < 0 ? next : next + 1);
      onSelect(next);
    }
  };

  // Keep keyboard focus on the selected crumb as it moves or the row re-renders.
  useEffect(() => {
    if (selected === null) return;
    stepRefs.current[selected]?.querySelector('button')?.focus({ preventScroll: true });
  }, [selected, trail]);

  return (
    <div
      ref={rowRef}
      className={styles.row}
      role="toolbar"
      aria-label="Written progression"
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={onKeyDown}
    >
      <button
        className={styles.pencil}
        aria-pressed={writing}
        data-on={writing || undefined}
        title={writing ? 'Writing: clicks on the map add chords' : 'Not writing: clicks on the map only play'}
        onClick={(e) => {
          e.stopPropagation();
          uiTick(writing ? 0 : 1);
          onWritingChange(!writing);
        }}
      >
        <PencilIcon width={15} height={15} />
      </button>
      {trail.length === 0 ? (
        <span className={styles.hint}>
          {writing ? 'Click chords to write a progression' : 'Click chords to hear them'}
        </span>
      ) : (
        <>
          {trail.map((id, i) => {
            const r = resolved.get(id);
            if (!r) return null;
            const against = i > 0 && !stepFollows(trail[i - 1], id);
            const nextAgainst = i < trail.length - 1 && !stepFollows(id, trail[i + 1]);
            const lifted = dragging?.i === i;
            return (
              <span
                key={i}
                ref={(n) => {
                  stepRefs.current[i] = n;
                }}
                className={styles.step}
                data-drop-before={dragging && dragging.target === i && !lifted ? '' : undefined}
                data-drop-after={dragging && dragging.target === trail.length && i === trail.length - 1 ? '' : undefined}
              >
                <button
                  className={styles.crumb}
                  data-selected={selected === i || undefined}
                  data-playing={playing === i || undefined}
                  data-against={against || undefined}
                  data-lifted={lifted || undefined}
                  style={lifted ? { translate: `${dragging.dx}px ${dragging.dy}px` } : undefined}
                  title={`${main === 'notes' ? r.numeral : r.name}${against ? ' – against the flow' : ''}`}
                  aria-pressed={selected === i}
                  onPointerDown={(e) => onPointerDown(e, i)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => {
                    drag.current = null;
                    setDragging(null);
                  }}
                >
                  <Acc text={main === 'notes' ? r.name : r.numeral} />
                  {selected === i && (
                    <span
                      className={styles.remove}
                      role="button"
                      aria-label={`Remove ${r.numeral}`}
                      title="Remove"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(i);
                      }}
                    >
                      <CloseIcon width={9} height={9} strokeWidth={2.4} />
                    </span>
                  )}
                </button>
                {i < trail.length - 1 && (
                  <span className={nextAgainst ? styles.against : styles.sep} aria-hidden="true">
                    {nextAgainst ? '↺' : '›'}
                  </span>
                )}
              </span>
            );
          })}
          <button
            className={styles.clear}
            aria-label="Clear the progression"
            title="Clear"
            onClick={(e) => {
              e.stopPropagation();
              uiTick(0);
              onClear();
            }}
          >
            <CloseIcon width={12} height={12} />
          </button>
        </>
      )}
    </div>
  );
}
