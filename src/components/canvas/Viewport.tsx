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
import { useCanvas } from '@/lib/canvas-store/store';
import styles from './Viewport.module.scss';

const CameraContext = createContext<CameraController | null>(null);

export function useCamera(): CameraController {
  const camera = useContext(CameraContext);
  if (!camera) throw new Error('useCamera must be used inside <Viewport>');
  return camera;
}

interface ViewportProps {
  children: ReactNode;
  /** Click landed on empty canvas (not on an element). Screen coords. */
  onBackgroundPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export function Viewport({ children, onBackgroundPointerDown }: ViewportProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<CameraController | null>(null);
  if (!cameraRef.current) cameraRef.current = new CameraController();
  const camera = cameraRef.current;

  const tool = useCanvas((s) => s.tool);
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

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        if (!spaceHeld.current) {
          spaceHeld.current = true;
          surface.classList.add(styles.grabbable);
        }
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
        surface.classList.remove(styles.grabbable);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      surface.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      camera.detach();
    };
  }, [camera]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const panMode = spaceHeld.current || tool === 'move' || e.button === 1;
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div ref={contentRef} className={styles.content}>
          {children}
        </div>
      </div>
    </CameraContext.Provider>
  );
}
