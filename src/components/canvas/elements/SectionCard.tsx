'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { SectionElement } from '@/lib/canvas-store/types';
import { canvasStore, useCanvas } from '@/lib/canvas-store/store';
import { useCamera } from '../Viewport';
import chordStyles from './ChordCard.module.scss';
import styles from './SectionCard.module.scss';

/**
 * Section: a named region that groups whatever it fully encloses. Dragging
 * the section moves it and every element whose bounds sit entirely inside
 * its area at drag start. Renders beneath regular elements.
 */
export function SectionCard({ el, selected }: { el: SectionElement; selected: boolean }) {
  const camera = useCamera();
  const tool = useCanvas((s) => s.tool);
  const areaRef = useRef<HTMLDivElement>(null);
  const [renaming, setRenaming] = useState(el.name === '' /* fresh sections invite a name */);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  const commitRename = (value: string) => {
    canvasStore.getState().updateElement(el.id, { name: value.trim() }, { commit: true });
    setRenaming(false);
  };

  const onBodyPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== 'select' || e.button !== 0) return;
    e.stopPropagation();
    const s = canvasStore.getState();
    s.removeUnconfirmedStubs();
    if (e.shiftKey) {
      s.toggleSelect(el.id);
      return;
    }
    s.select([el.id]);

    // Group membership is decided at drag start: every element whose DOM
    // bounds are fully inside the section area (screen space) moves along.
    const area = areaRef.current!.getBoundingClientRect();
    const enclosed: Array<{ id: string; startX: number; startY: number }> = [];
    const elements = s.activePage().elements;
    document.querySelectorAll<HTMLElement>('[data-element-id]').forEach((node) => {
      const id = node.dataset.elementId!;
      if (id === el.id) return;
      const r = node.getBoundingClientRect();
      if (r.left >= area.left && r.right <= area.right && r.top >= area.top && r.bottom <= area.bottom) {
        const target = elements.find((x) => x.id === id);
        if (target) enclosed.push({ id, startX: target.x, startY: target.y });
      }
    });

    const start = { px: e.clientX, py: e.clientY, elX: el.x, elY: el.y };
    let moved = false;

    const onMove = (me: PointerEvent) => {
      const k = camera.camera.k;
      const dx = (me.clientX - start.px) / k;
      const dy = (me.clientY - start.py) / k;
      if (!moved && Math.hypot(dx, dy) * k > 2) {
        moved = true;
        canvasStore.getState().commit(); // one undo step per group drag
      }
      if (moved) {
        canvasStore.getState().moveElements([
          { id: el.id, x: start.elX + dx, y: start.elY + dy },
          ...enclosed.map((m) => ({ id: m.id, x: m.startX + dx, y: m.startY + dy })),
        ]);
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={styles.shell}
      style={{ left: el.x, top: el.y }}
      data-element-id={el.id}
      data-selected={selected || undefined}
    >
      <div className={chordStyles.header}>
        <button
          className={chordStyles.nameTab}
          title="Rename section"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setRenaming(true);
          }}
        >
          <span className={chordStyles.nameTabInner} data-empty={!el.name || undefined}>
            {renaming ? (
              <input
                ref={inputRef}
                className={styles.renameInput}
                defaultValue={el.name}
                placeholder="Section name"
                onPointerDown={(e) => e.stopPropagation()}
                onBlur={(e) => commitRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename(e.currentTarget.value);
                  if (e.key === 'Escape') setRenaming(false);
                }}
              />
            ) : (
              el.name || 'Section'
            )}
          </span>
        </button>
      </div>
      <div
        ref={areaRef}
        className={styles.area}
        style={{ width: el.width, height: el.height }}
        onPointerDown={onBodyPointerDown}
      />
    </div>
  );
}
