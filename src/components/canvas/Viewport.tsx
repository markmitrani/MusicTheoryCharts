'use client';

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { CameraController } from '@/lib/canvas-store/camera';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { lessonStore } from '@/lib/lesson/store';
import { touchGesture } from '@/lib/use-mobile';
import styles from './Viewport.module.scss';

const CameraContext = createContext<CameraController | null>(null);

export function useCamera(): CameraController {
  const camera = useContext(CameraContext);
  if (!camera) throw new Error('useCamera must be used inside <Viewport>');
  return camera;
}

interface ViewportProps {
  children: ReactNode;
  /** Owned by the app shell so chrome (toolbar, marquee) can use it too. */
  camera: CameraController;
  /** Click landed on empty canvas (not on an element). Screen coords. */
  onBackgroundPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** Screen-fixed layers drawn behind the (transformed) element content. */
  backdrop?: ReactNode;
}

export function Viewport({ children, camera, onBackgroundPointerDown, backdrop }: ViewportProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const tool = useCanvas((s) => s.tool);
  const deleteMode = useCanvas((s) => s.deleteMode);
  const spaceHeld = useRef(false);
  const panning = useRef<{ px: number; py: number } | null>(null);

  useEffect(() => {
    const surface = surfaceRef.current!;
    const content = contentRef.current!;
    camera.attach(surface, content);

    // Wheel must be non-passive to preventDefault browser zoom/scroll.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // pinch (ctrlKey on macOS trackpads) or cmd+scroll → zoom toward cursor
        camera.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.012));
      } else {
        camera.pan(-e.deltaX, -e.deltaY);
      }
    };
    surface.addEventListener('wheel', onWheel, { passive: false });

    // Touch pinch + two-finger pan. Window capture runs before any element or
    // marquee handler, so a pinch works anywhere on the canvas and freezes
    // those drags until every finger lifts.
    const touches = new Map<number, { x: number; y: number }>();
    let pinch: { dist: number; mx: number; my: number } | null = null;
    const pinchMetrics = () => {
      const [a, b] = [...touches.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || lessonStore.getState().open) return;
      if (!surface.contains(e.target as Node)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        pinch = pinchMetrics();
        touchGesture.pinching = true;
        touchGesture.serial++;
      }
      if (touches.size >= 2) e.stopPropagation();
    };
    const onTouchMove = (e: PointerEvent) => {
      const t = touches.get(e.pointerId);
      if (!t) return;
      t.x = e.clientX;
      t.y = e.clientY;
      if (!touchGesture.pinching) return;
      e.stopPropagation();
      if (!pinch || touches.size < 2) return;
      const m = pinchMetrics();
      camera.pan(m.mx - pinch.mx, m.my - pinch.my);
      camera.zoomAt(m.mx, m.my, m.dist / pinch.dist);
      pinch = m;
    };
    const onTouchUp = (e: PointerEvent) => {
      if (!touches.delete(e.pointerId)) return;
      if (touches.size < 2) pinch = null;
      if (touches.size === 0) touchGesture.pinching = false;
    };
    window.addEventListener('pointerdown', onTouchDown, true);
    window.addEventListener('pointermove', onTouchMove, true);
    window.addEventListener('pointerup', onTouchUp, true);
    window.addEventListener('pointercancel', onTouchUp, true);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !lessonStore.getState().open) {
        if (!spaceHeld.current) {
          spaceHeld.current = true;
          surface.classList.add(styles.grabbable);
          canvasStore.getState().setSpacePanning(true);
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        surface.classList.remove(styles.grabbable);
        canvasStore.getState().setSpacePanning(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      surface.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointerdown', onTouchDown, true);
      window.removeEventListener('pointermove', onTouchMove, true);
      window.removeEventListener('pointerup', onTouchUp, true);
      window.removeEventListener('pointercancel', onTouchUp, true);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      camera.detach();
    };
  }, [camera]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // One finger on empty canvas pans; a marquee is no use on a phone.
    const touchPan = e.pointerType === 'touch' && tool === 'select' && e.target === surfaceRef.current;
    const panMode = spaceHeld.current || tool === 'move' || e.button === 1 || touchPan;
    if (touchPan) canvasStore.getState().clearSelection();
    if (panMode) {
      panning.current = { px: e.clientX, py: e.clientY };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // synthetic events (tests) have no active pointer; pan still works
      }
      surfaceRef.current!.classList.add(styles.grabbing);
      return;
    }
    if (e.target === surfaceRef.current) {
      onBackgroundPointerDown?.(e);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panning.current) return;
    camera.pan(e.clientX - panning.current.px, e.clientY - panning.current.py);
    panning.current = { px: e.clientX, py: e.clientY };
  };

  const handlePointerUp = () => {
    panning.current = null;
    surfaceRef.current?.classList.remove(styles.grabbing);
  };

  return (
    <CameraContext.Provider value={camera}>
      <div
        ref={surfaceRef}
        className={styles.surface}
        data-tool={tool}
        data-delete-mode={deleteMode || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {backdrop}
        <div ref={contentRef} className={styles.content}>
          {children}
        </div>
      </div>
    </CameraContext.Provider>
  );
}
