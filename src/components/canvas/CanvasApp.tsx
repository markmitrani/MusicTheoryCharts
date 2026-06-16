'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { gsap } from 'gsap';
import { CameraController } from '@/lib/canvas-store/camera';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { loadImageFile, imageFilesFrom } from '@/lib/images';
import { inversionCount, withSeventh } from '@/lib/theory/chords';
import { HIGHLIGHT_COUNT } from '@/lib/highlight-presets';
import { Viewport } from './Viewport';
import { AudioBoot } from './AudioBoot';
import { UrlSync } from './UrlSync';
import { MultiSelectBox } from './MultiSelectBox';
import { ChordCard } from './elements/ChordCard';
import { ScaleCard } from './elements/ScaleCard';
import { HarmonyCard } from './elements/HarmonyCard';
import { CircleCard } from './elements/CircleCard';
import { PitchAxisCard } from './elements/PitchAxisCard';
import { ImageCard } from './elements/ImageCard';
import { SectionCard } from './elements/SectionCard';
import { StubCard } from './elements/StubCard';
import { Toolbar } from '@/components/chrome/Toolbar';
import { PageRail } from '@/components/chrome/PageRail';
import { TitlePanel } from '@/components/chrome/TitlePanel';
import { CornerActions } from '@/components/chrome/SettingsPanel';
import styles from './CanvasApp.module.scss';

interface DragRect {
  mode: 'marquee' | 'frame';
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

  const [dragRect, setDragRect] = useState<DragRect | null>(null);
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
      } else if (!cmd && e.key.toLowerCase() === 'r' && s.selection.size > 0) {
        // Cycle the highlight colour of selected scale/chord elements.
        const targets = s
          .activePage()
          .elements.filter((el) => s.selection.has(el.id) && (el.kind === 'scale' || el.kind === 'chord'));
        if (targets.length === 0) return;
        e.preventDefault();
        targets.forEach((el, i) => {
          const cur = (el as { highlightColor?: number }).highlightColor ?? 0;
          s.updateElement(el.id, { highlightColor: (cur + 1) % HIGHLIGHT_COUNT }, { commit: i === 0 });
        });
      } else if (cmd && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        s.selectAll();
      } else if (cmd && e.key.toLowerCase() === 'c') {
        // Defer to native copy when text is selected or nothing is on canvas.
        if (s.selection.size === 0 || window.getSelection()?.toString()) return;
        e.preventDefault();
        s.copySelection();
      } else if (cmd && e.key.toLowerCase() === 'x') {
        if (s.selection.size === 0 || window.getSelection()?.toString()) return;
        e.preventDefault();
        s.cutSelection();
      } else if (cmd && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateSelection();
      } else if (cmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (cmd && (e.key === ']' || e.key === '}') && s.selection.size > 0) {
        e.preventDefault();
        const fn = e.shiftKey ? s.bringToFront : s.bringForward;
        s.selection.forEach((id) => fn(id));
      } else if (cmd && (e.key === '[' || e.key === '{') && s.selection.size > 0) {
        e.preventDefault();
        const fn = e.shiftKey ? s.sendToBack : s.sendBackward;
        s.selection.forEach((id) => fn(id));
      } else if (!cmd && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const dir = e.key === 'ArrowUp' ? 1 : -1;
        const pitched = s.activePage().elements.some(
          (el) =>
            s.selection.has(el.id) &&
            (el.kind === 'scale' || el.kind === 'chord' || el.kind === 'harmony'),
        );
        if (pitched) {
          // Transpose the selection: ±1 semitone, or ±a fifth with Shift.
          e.preventDefault();
          s.transposeElements([...s.selection], dir * (e.shiftKey ? 7 : 1));
        } else {
          // Nothing pitched selected → move up/down the page stack (the view).
          const idx = s.pages.findIndex((p) => p.id === s.activePageId);
          const next = e.key === 'ArrowUp' ? idx - 1 : idx + 1;
          if (next >= 0 && next < s.pages.length) {
            e.preventDefault();
            s.setActivePage(s.pages[next].id);
          }
        }
      } else if (!cmd && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && s.selection.size === 1) {
        // Cycle inversions of a single selected chord.
        const el = s.activePage().elements.find((x) => s.selection.has(x.id));
        if (el?.kind === 'chord') {
          e.preventDefault();
          const eff = el.seventh ? withSeventh(el.quality) : el.quality;
          const count = inversionCount(eff);
          const dir = e.key === 'ArrowRight' ? 1 : -1;
          const inversion = (el.inversion + dir + count) % count;
          s.updateElement(el.id, { inversion }, { commit: true });
        }
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const files = imageFilesFrom(e.clipboardData);
      if (files.length > 0) {
        e.preventDefault();
        spawnImages(files);
        return;
      }
      // No image in the OS clipboard → paste any copied canvas elements.
      e.preventDefault();
      canvasStore.getState().pasteClipboard();
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

  // ---- background drags: marquee selection (select tool) or section drawing (frame tool) ----

  const onBackgroundPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = canvasStore.getState();
    // Don't remove stubs here — clicking away unfocuses them so they fade out
    // gracefully (the stub manages its own despawn once the fade completes).
    if (!e.shiftKey) s.clearSelection();
    if (e.button !== 0 || (s.tool !== 'select' && s.tool !== 'frame')) return;

    const mode = s.tool === 'select' ? 'marquee' : 'frame';
    const start = { x: e.clientX, y: e.clientY };
    setDragRect({ mode, x0: start.x, y0: start.y, x1: start.x, y1: start.y });
    let last = start;

    const onMove = (me: PointerEvent) => {
      last = { x: me.clientX, y: me.clientY };
      setDragRect({ mode, x0: start.x, y0: start.y, x1: last.x, y1: last.y });
      if (mode !== 'marquee') return;
      const left = Math.min(start.x, last.x);
      const right = Math.max(start.x, last.x);
      const top = Math.min(start.y, last.y);
      const bottom = Math.max(start.y, last.y);
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
      setDragRect(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (mode !== 'frame') return;
      const a = camera.screenToCanvas(Math.min(start.x, last.x), Math.min(start.y, last.y));
      const b = camera.screenToCanvas(Math.max(start.x, last.x), Math.max(start.y, last.y));
      const width = Math.max(160, b.x - a.x);
      const height = Math.max(100, b.y - a.y);
      const store = canvasStore.getState();
      const id = store.addElement({ kind: 'section', x: a.x, y: a.y, width, height, name: '' });
      store.setTool('select');
      store.select([id]);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const soloSelected = selection.size === 1;
  const sorted = [...page.elements].sort((a, b) => a.z - b.z);
  const sections = sorted.filter((el) => el.kind === 'section');
  const others = sorted.filter((el) => el.kind !== 'section');

  return (
    <>
      <AudioBoot />
      <UrlSync />
      <Viewport camera={camera} onBackgroundPointerDown={onBackgroundPointerDown}>
        <div ref={contentAnimRef}>
          {sections.map((el) => (
            <SectionCard key={el.id} el={el} selected={selection.has(el.id)} />
          ))}
          {others.map((el) => {
            const common = { selected: selection.has(el.id), soloSelected };
            switch (el.kind) {
              case 'chord':
                return <ChordCard key={el.id} el={el} {...common} />;
              case 'scale':
                return <ScaleCard key={el.id} el={el} {...common} />;
              case 'harmony':
                return <HarmonyCard key={el.id} el={el} {...common} />;
              case 'circle':
                return <CircleCard key={el.id} el={el} {...common} />;
              case 'pitchaxis':
                return <PitchAxisCard key={el.id} el={el} {...common} />;
              case 'image':
                return <ImageCard key={el.id} el={el} {...common} />;
              case 'stub':
                return <StubCard key={el.id} el={el} />;
              default:
                return null;
            }
          })}
        </div>
      </Viewport>

      {dragRect && (
        <div
          className={styles.marquee}
          data-mode={dragRect.mode}
          style={{
            left: Math.min(dragRect.x0, dragRect.x1),
            top: Math.min(dragRect.y0, dragRect.y1),
            width: Math.abs(dragRect.x1 - dragRect.x0),
            height: Math.abs(dragRect.y1 - dragRect.y0),
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
