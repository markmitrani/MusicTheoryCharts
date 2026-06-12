'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import { CameraController } from '@/lib/canvas-store/camera';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { loadImageFile, imageFilesFrom } from '@/lib/images';
import { Viewport } from './Viewport';
import { AudioBoot } from './AudioBoot';
import { MultiSelectBox } from './MultiSelectBox';
import { ChordCard } from './elements/ChordCard';
import { ScaleCard } from './elements/ScaleCard';
import { ImageCard } from './elements/ImageCard';
import { StubCard } from './elements/StubCard';
import { Toolbar } from '@/components/chrome/Toolbar';
import { PageRail } from '@/components/chrome/PageRail';
import { TitlePanel } from '@/components/chrome/TitlePanel';
import { CornerActions } from '@/components/chrome/SettingsPanel';
import styles from './CanvasApp.module.scss';

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;

export function CanvasApp() {
  const page = useCanvas((s) => s.pages.find((p) => p.id === s.activePageId)!);
  const selection = useCanvas((s) => s.selection);
  const cameraRef = useRef<CameraController | null>(null);
  if (!cameraRef.current) cameraRef.current = new CameraController();
  const camera = cameraRef.current;

  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentAnimRef = useRef<HTMLDivElement>(null);

  // ---- spawn helpers ----

  const screenCenterOnCanvas = () =>
    camera.screenToCanvas(window.innerWidth / 2, window.innerHeight / 2);

  const spawnStub = () => {
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    const c = screenCenterOnCanvas();
    s.addElement({ kind: 'stub', x: c.x - 160, y: c.y - 140, root: null, typeId: null });
    s.setTool('select');
  };

  const spawnImages = async (files: File[], at?: { x: number; y: number }) => {
    const origin = at ?? screenCenterOnCanvas();
    let offset = 0;
    for (const file of files) {
      try {
        const img = await loadImageFile(file);
        canvasStore.getState().addElement({
          kind: 'image',
          x: origin.x - img.width / 2 + offset,
          y: origin.y - img.width / img.aspectRatio / 2 + offset,
          src: img.src,
          width: img.width,
          aspectRatio: img.aspectRatio,
        });
        offset += 28;
      } catch (err) {
        console.warn('Skipped image:', err);
      }
    }
  };

  // ---- global input: keyboard shortcuts, paste, drag-and-drop ----

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const s = canvasStore.getState();
      const cmd = e.metaKey || e.ctrlKey;
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection.size > 0) {
        e.preventDefault();
        s.removeElements([...s.selection]);
      } else if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const files = imageFilesFrom(e.clipboardData);
      if (files.length > 0) {
        e.preventDefault();
        spawnImages(files);
      }
    };

    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = imageFilesFrom(e.dataTransfer);
      if (files.length > 0) {
        spawnImages(files, camera.screenToCanvas(e.clientX, e.clientY));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- page switch transition ----

  useEffect(() => {
    if (!contentAnimRef.current) return;
    gsap.fromTo(
      contentAnimRef.current,
      { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.4, ease: 'power2.out', clearProps: 'scale' },
    );
  }, [page.id]);

  // ---- marquee selection (select tool, drag on empty canvas) ----

  const onBackgroundPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    if (!e.shiftKey) s.clearSelection();
    if (s.tool !== 'select' || e.button !== 0) return;

    const start = { x: e.clientX, y: e.clientY };
    setMarquee({ x0: start.x, y0: start.y, x1: start.x, y1: start.y });

    const onMove = (me: PointerEvent) => {
      const box = { x0: start.x, y0: start.y, x1: me.clientX, y1: me.clientY };
      setMarquee(box);
      const left = Math.min(box.x0, box.x1);
      const right = Math.max(box.x0, box.x1);
      const top = Math.min(box.y0, box.y1);
      const bottom = Math.max(box.y0, box.y1);
      const hits: string[] = [];
      document.querySelectorAll<HTMLElement>('[data-element-id]').forEach((node) => {
        const r = node.getBoundingClientRect();
        if (r.left < right && r.right > left && r.top < bottom && r.bottom > top) {
          hits.push(node.dataset.elementId!);
        }
      });
      canvasStore.getState().select(hits);
    };
    const onUp = () => {
      setMarquee(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const soloSelected = selection.size === 1;
  const sorted = [...page.elements].sort((a, b) => a.z - b.z);

  return (
    <>
      <AudioBoot />
      <Viewport camera={camera} onBackgroundPointerDown={onBackgroundPointerDown}>
        <div ref={contentAnimRef}>
          {sorted.map((el) => {
            const common = { selected: selection.has(el.id), soloSelected };
            switch (el.kind) {
              case 'chord':
                return <ChordCard key={el.id} el={el} {...common} />;
              case 'scale':
                return <ScaleCard key={el.id} el={el} {...common} />;
              case 'image':
                return <ImageCard key={el.id} el={el} {...common} />;
              case 'stub':
                return <StubCard key={el.id} el={el} />;
            }
          })}
        </div>
      </Viewport>

      {marquee && (
        <div
          className={styles.marquee}
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
          }}
        />
      )}
      <MultiSelectBox camera={camera} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length > 0) spawnImages(files);
        }}
      />

      <PageRail />
      <TitlePanel />
      <CornerActions />
      <Toolbar onAddNew={spawnStub} onUpload={() => fileInputRef.current?.click()} />
    </>
  );
}
