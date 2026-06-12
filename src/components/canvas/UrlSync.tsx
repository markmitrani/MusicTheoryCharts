'use client';

import { useEffect } from 'react';
import { canvasStore } from '@/lib/canvas-store/store';
import { encodeDoc, decodeDoc } from '@/lib/url-state/codec';

const DEBOUNCE_MS = 400;
const LOAD_MARGIN = { x: 80, y: 100 }; // decoded docs are origin-normalized; nudge off the corner

/**
 * Two-way URL <-> document sync: decodes the hash once on mount, then
 * mirrors document changes back into the hash via replaceState, debounced
 * 400ms so drags don't spam history.
 */
export function UrlSync() {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const doc = decodeDoc(hash);
    if (doc) {
      canvasStore.getState().loadDoc({
        activePageId: doc.activePageId,
        pages: doc.pages.map((p) => ({
          ...p,
          elements: p.elements.map((e) => ({
            ...e,
            x: e.x + LOAD_MARGIN.x,
            y: e.y + LOAD_MARGIN.y,
          })),
        })),
      });
    }

    let timer: number | undefined;
    const unsubscribe = canvasStore.subscribe((s, prev) => {
      if (s.pages === prev.pages && s.activePageId === prev.activePageId) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        history.replaceState(null, '', `#${encodeDoc(canvasStore.getState())}`);
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}
