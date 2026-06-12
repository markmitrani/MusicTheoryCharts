'use client';

import { useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import { useCamera } from './Viewport';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { SettingsBar } from './elements/SettingsBar';
import { BringForwardIcon, SendBackwardIcon } from '@/components/chrome/icons';
import styles from './ElementShell.module.scss';

/**
 * Shared wrapper for canvas elements: absolute positioning, click/shift+click
 * selection, drag-to-move (select tool), and the three visual states
 * (default / hover / selected). Adornments (settings bar, chevrons) render
 * via the `adornments` slot so they sit outside the card frame.
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
  const drag = useRef<{ startX: number; startY: number; elX: number; elY: number; moved: boolean } | null>(null);

  // spawn pop-in
  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { scale: 0.85, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.8)' },
    );
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((tool !== 'select' && tool !== 'layers') || e.button !== 0) return;
    e.stopPropagation();
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    if (e.shiftKey) {
      s.toggleSelect(id);
      return;
    }
    if (!s.selection.has(id)) s.select([id]);
    if (tool !== 'select') return; // layers tool selects but never drags
    drag.current = { startX: e.clientX, startY: e.clientY, elX: x, elY: y, moved: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // synthetic events (tests) have no active pointer; drag still works
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const k = camera.camera.k;
    const dx = (e.clientX - drag.current.startX) / k;
    const dy = (e.clientY - drag.current.startY) / k;
    if (!drag.current.moved && Math.hypot(dx, dy) > 2) {
      drag.current.moved = true;
      canvasStore.getState().commit(); // one undo step per drag
    }
    if (drag.current.moved) {
      canvasStore.getState().updateElement(id, {
        x: drag.current.elX + dx,
        y: drag.current.elY + dy,
      });
    }
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      className={styles.shell}
      style={{ left: x, top: y, zIndex: z }}
      data-element-id={id}
      data-selected={selected || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
      {selected && soloSelected && tool === 'select' && adornments}
      {selected && soloSelected && tool === 'layers' && (
        <SettingsBar>
          <button
            className={styles.layerBtn}
            aria-label="Send backward"
            title="Send backward"
            onClick={() => canvasStore.getState().sendBackward(id)}
          >
            <SendBackwardIcon width={18} height={18} />
          </button>
          <button
            className={styles.layerBtn}
            aria-label="Bring forward"
            title="Bring forward"
            onClick={() => canvasStore.getState().bringForward(id)}
          >
            <BringForwardIcon width={18} height={18} />
          </button>
        </SettingsBar>
      )}
    </div>
  );
}
