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
    const startDist = Math.hypot(start.x - anchor.x, start.y - anchor.y);
    const { width: startW, x: startX, y: startY } = el;
    canvasStore.getState().commit(); // one undo step per resize

    const onMove = (me: PointerEvent) => {
      const p = camera.screenToCanvas(me.clientX, me.clientY);
      const dist = Math.hypot(p.x - anchor.x, p.y - anchor.y);
      const scale = Math.max(0.1, dist / startDist);
      const w = Math.max(60, startW * scale);
      const hNew = w / el.aspectRatio;
      const startH = startW / el.aspectRatio;
      const x = corner === 'tl' || corner === 'bl' ? startX + (startW - w) : startX;
      const y = corner === 'tl' || corner === 'tr' ? startY + (startH - hNew) : startY;
      canvasStore.getState().updateElement(el.id, { x, y, width: w });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
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
            />
          ))}
      </div>
    </ElementShell>
  );
}
