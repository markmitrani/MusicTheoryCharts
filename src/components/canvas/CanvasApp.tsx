'use client';

import { useEffect, useRef } from 'react';
import { Viewport } from './Viewport';
import { AudioBoot } from './AudioBoot';
import { ChordCard } from './elements/ChordCard';
import { ScaleCard } from './elements/ScaleCard';
import { Toolbar } from '@/components/chrome/Toolbar';
import { PageRail } from '@/components/chrome/PageRail';
import { TitlePanel } from '@/components/chrome/TitlePanel';
import { CornerActions } from '@/components/chrome/SettingsPanel';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';

export function CanvasApp() {
  const page = useCanvas((s) => s.pages.find((p) => p.id === s.activePageId)!);
  const selection = useCanvas((s) => s.selection);
  const seeded = useRef(false);

  // Temporary seeds for check-ins 2/3: one chord + one scale to review design
  // and audio. Replaced by the spawn-stub flow in Phase 5.
  useEffect(() => {
    if (seeded.current || canvasStore.getState().activePage().elements.length > 0) return;
    seeded.current = true;
    const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 720;
    const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    canvasStore.getState().addElement({
      kind: 'chord',
      x: cx - 480,
      y: cy - 100,
      root: 'G',
      octave: 3,
      quality: 'maj7',
      inversion: 0,
      seventh: false,
    });
    canvasStore.getState().addElement({
      kind: 'scale',
      x: cx - 120,
      y: cy - 100,
      root: 'F',
      octave: 3,
      scaleId: 'lydian',
    });
  }, []);

  const soloSelected = selection.size === 1;
  const sorted = [...page.elements].sort((a, b) => a.z - b.z);

  return (
    <>
      <AudioBoot />
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
            case 'scale':
              return (
                <ScaleCard
                  key={el.id}
                  el={el}
                  selected={selection.has(el.id)}
                  soloSelected={soloSelected}
                />
              );
            default:
              return null; // image + stub land in Phases 5–6
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
