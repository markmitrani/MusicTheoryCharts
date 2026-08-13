'use client';

import { useEffect, useReducer } from 'react';
import type { CameraController } from '@/lib/canvas-store/camera';
import { useCanvas } from '@/lib/canvas-store/store';
import styles from './MultiSelectBox.module.scss';

/**
 * Bounding box around a multi-selection (per-element settings bars are
 * hidden in this mode). Measured from the DOM in screen space so it stays
 * correct under any zoom; re-measures on camera moves and store changes.
 */
export function MultiSelectBox({ camera }: { camera: CameraController }) {
  const selection = useCanvas((s) => s.selection);
  useCanvas((s) => s.pages); // re-render when elements move
  const [, bump] = useReducer((x: number) => x + 1, 0);

  useEffect(() => camera.subscribe(() => bump()), [camera]);

  if (selection.size < 2) return null;

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  selection.forEach((id) => {
    const node = document.querySelector<HTMLElement>(`[data-element-id="${CSS.escape(id)}"]`);
    if (!node) return;
    const r = node.getBoundingClientRect();
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  });
  if (!Number.isFinite(left)) return null;

  const pad = 8;
  return (
    <div
      className={styles.box}
      style={{
        left: left - pad,
        top: top - pad,
        width: right - left + pad * 2,
        height: bottom - top + pad * 2,
      }}
    />
  );
}
