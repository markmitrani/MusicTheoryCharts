'use client';

import { useEffect, useRef } from 'react';
import { Viewport } from './Viewport';
import { ChordCard } from './elements/ChordCard';
import { Toolbar } from '@/components/chrome/Toolbar';
import { PageRail } from '@/components/chrome/PageRail';
import { TitlePanel } from '@/components/chrome/TitlePanel';
import { CornerActions } from '@/components/chrome/SettingsPanel';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';

export function CanvasApp() {
  const page = useCanvas((s) => s.pages.find((p) => p.id === s.activePageId)!);
  const selection = useCanvas((s) => s.selection);
  const seeded = useRef(false);

  // Temporary seed for check-in 2: one Gmaj7 to review the element design.
  // Replaced by the spawn-stub flow in Phase 5.
  useEffect(() => {
    if (seeded.current || canvasStore.getState().activePage().elements.length > 0) return;
    seeded.current = true;
    canvasStore.getState().addElement({
      kind: 'chord',
      x: typeof window !== 'undefined' ? window.innerWidth / 2 - 320 : 400,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 - 90 : 300,
      root: 'G',
      octave: 3,
      quality: 'maj7',
      inversion: 0,
      seventh: false,
    });
  }, []);

  const soloSelected = selection.size === 1;
  const sorted = [...page.elements].sort((a, b) => a.z - b.z);

  return (
    <>
      <Viewport onBackgroundPointerDown={() => canvasStore.getState().clearSelection()}>
        {sorted.map((el) => {
          switch (el.kind) {
            case 'chord':
              return (
                <ChordCard
                  key={el.id}
                  el={el}
                  selected={selection.has(el.id)}
                  soloSelected={soloSelected}
                />
              );
            default:
              return null; // scale, image, stub land in Phases 5–6
          }
        })}
      </Viewport>
      <PageRail />
      <TitlePanel />
      <CornerActions />
      <Toolbar onAddNew={() => {}} onUpload={() => {}} />
    </>
  );
}
