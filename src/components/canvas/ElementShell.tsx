'use client';

import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import { useCamera } from './Viewport';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import styles from './ElementShell.module.scss';

/**
 * Shared wrapper for canvas elements: absolute positioning, click/shift+click
 * selection, drag-to-move (select tool), and the three visual states
 * (default / hover / selected). Dragging uses window-level listeners rather
 * than pointer capture so fast drags never lose events.
 */
interface ElementShellProps {
  id: string;
  x: number;
  y: number;
  z: number;
  selected: boolean;
  /** Hide per-element adornments during multi-select. */
  soloSelected: boolean;
  adornments?: ReactNode;
  children: ReactNode;
}

export function ElementShell({ id, x, y, z, selected, soloSelected, adornments, children }: ElementShellProps) {
  const camera = useCamera();
  const tool = useCanvas((s) => s.tool);
  const ref = useRef<HTMLDivElement>(null);

  // spawn pop-in
  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' },
    );
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    const s = canvasStore.getState();
    // Note: stubs are dismissed by the background click-away handler + their own
    // fade timer — not here, so a stub can be clicked/dragged without vanishing.
    if (e.shiftKey) {
      s.toggleSelect(id);
      return;
    }
    if (!s.selection.has(id)) s.select([id]);

    const start = { px: e.clientX, py: e.clientY, elX: x, elY: y };
    let moved = false;

    const onMove = (me: PointerEvent) => {
      const k = camera.camera.k;
      const dx = (me.clientX - start.px) / k;
      const dy = (me.clientY - start.py) / k;
      if (!moved && Math.hypot(dx, dy) * k > 2) {
        moved = true;
        canvasStore.getState().commit(); // one undo step per drag
      }
      if (moved) {
        canvasStore.getState().updateElement(id, { x: start.elX + dx, y: start.elY + dy });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={ref}
      className={styles.shell}
      style={{ left: x, top: y, zIndex: z }}
      data-element-id={id}
      data-selected={selected || undefined}
      onPointerDown={onPointerDown}
    >
      {children}
      {selected && soloSelected && tool === 'select' && adornments}
    </div>
  );
}
