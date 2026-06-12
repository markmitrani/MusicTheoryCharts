'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { ImageElement } from '@/lib/canvas-store/types';
import { canvasStore } from '@/lib/canvas-store/store';
import { useCamera } from '../Viewport';
import { ElementShell } from '../ElementShell';
import styles from './ImageCard.module.scss';

interface ImageCardProps {
  el: ImageElement;
  selected: boolean;
  soloSelected: boolean;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';
const CORNERS: Corner[] = ['tl', 'tr', 'bl', 'br'];

/**
 * Image element: AR-locked. Resizing scales by the ratio of the cursor's
 * distance from the anchor (opposite corner) to the original corner's
 * distance, so diagonal drags feel natural at any zoom.
 */
export function ImageCard({ el, selected, soloSelected }: ImageCardProps) {
  const camera = useCamera();
  const height = el.width / el.aspectRatio;
  const resize = useRef<{
    corner: Corner;
    anchorX: number;
    anchorY: number;
    startDist: number;
    startW: number;
    startX: number;
    startY: number;
  } | null>(null);

  const onHandleDown = (corner: Corner) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const h = el.width / el.aspectRatio;
    const corners = {
      tl: { x: el.x, y: el.y },
      tr: { x: el.x + el.width, y: el.y },
      bl: { x: el.x, y: el.y + h },
      br: { x: el.x + el.width, y: el.y + h },
    };
    const anchor = corners[{ tl: 'br', tr: 'bl', bl: 'tr', br: 'tl' }[corner] as Corner];
    const start = corners[corner];
    canvasStore.getState().commit(); // one undo step per resize
    resize.current = {
      corner,
      anchorX: anchor.x,
      anchorY: anchor.y,
      startDist: Math.hypot(start.x - anchor.x, start.y - anchor.y),
      startW: el.width,
      startX: el.x,
      startY: el.y,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // synthetic events have no active pointer
    }
  };

  const onHandleMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = resize.current;
    if (!r) return;
    e.stopPropagation();
    const p = camera.screenToCanvas(e.clientX, e.clientY);
    const dist = Math.hypot(p.x - r.anchorX, p.y - r.anchorY);
    const scale = Math.max(0.1, dist / r.startDist);
    const w = Math.max(60, r.startW * scale);
    const h = w / el.aspectRatio;
    const startH = r.startW / el.aspectRatio;
    const x = r.corner === 'tl' || r.corner === 'bl' ? r.startX + (r.startW - w) : r.startX;
    const y = r.corner === 'tl' || r.corner === 'tr' ? r.startY + (startH - h) : r.startY;
    canvasStore.getState().updateElement(el.id, { x, y, width: w });
  };

  const onHandleUp = () => {
    resize.current = null;
  };

  return (
    <ElementShell id={el.id} x={el.x} y={el.y} z={el.z} selected={selected} soloSelected={soloSelected}>
      <div
        className={styles.frame}
        data-selected={selected || undefined}
        style={{ width: el.width, height }}
      >
        {/* object URLs / data URIs from user uploads; next/image needs remote config */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={el.src} alt="" draggable={false} className={styles.img} />
        {selected &&
          CORNERS.map((corner) => (
            <div
              key={corner}
              className={`${styles.handle} ${styles[corner]}`}
              onPointerDown={onHandleDown(corner)}
              onPointerMove={onHandleMove}
              onPointerUp={onHandleUp}
            />
          ))}
      </div>
    </ElementShell>
  );
}
