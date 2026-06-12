'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { PlusIcon } from './icons';
import styles from './PageRail.module.scss';

const ROW_HEIGHT = 23; // bar 9px + gap 14px, used for drag-reorder math

/**
 * Vertical page rail (Direction A / page-navigation.png): "+" on top,
 * stacked bars, active page wide + bright. Hover reveals the name,
 * double-click renames inline, right-click offers delete (disabled at one
 * page), dragging a bar vertically reorders.
 */
export function PageRail() {
  const pages = useCanvas((s) => s.pages);
  const activePageId = useCanvas((s) => s.activePageId);
  const [hovered, setHovered] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; startY: number; fromIndex: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuFor]);

  const commitRename = (id: string, value: string) => {
    canvasStore.getState().renamePage(id, value.trim());
    setRenaming(null);
  };

  const onBarPointerDown = (id: string, index: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { id, startY: e.clientY, fromIndex: index, moved: false };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // synthetic events have no active pointer
    }
  };

  const onBarPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = e.clientY - d.startY;
    if (!d.moved && Math.abs(delta) < ROW_HEIGHT / 2) return;
    d.moved = true;
    const toIndex = Math.max(
      0,
      Math.min(pages.length - 1, d.fromIndex + Math.round(delta / ROW_HEIGHT)),
    );
    const currentIndex = pages.findIndex((p) => p.id === d.id);
    if (toIndex !== currentIndex) {
      canvasStore.getState().reorderPage(d.id, toIndex);
    }
  };

  const onBarPointerUp = (id: string) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    if (!wasDrag) canvasStore.getState().setActivePage(id);
  };

  return (
    <nav className={styles.rail} aria-label="Pages">
      <button
        className={styles.add}
        aria-label="Add page"
        onClick={() => canvasStore.getState().addPage()}
      >
        <PlusIcon width={18} height={18} />
      </button>
      {pages.map((page, i) => (
        <div key={page.id} className={styles.row}>
          <button
            className={styles.bar}
            data-active={page.id === activePageId || undefined}
            aria-label={page.name || `Page ${i + 1}`}
            aria-current={page.id === activePageId ? 'page' : undefined}
            onPointerDown={(e) => onBarPointerDown(page.id, i, e)}
            onPointerMove={onBarPointerMove}
            onPointerUp={() => onBarPointerUp(page.id)}
            onDoubleClick={() => setRenaming(page.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuFor(page.id);
            }}
            onMouseEnter={() => setHovered(page.id)}
            onMouseLeave={() => setHovered((h) => (h === page.id ? null : h))}
          />

          {renaming === page.id ? (
            <input
              ref={inputRef}
              className={styles.renameInput}
              defaultValue={page.name}
              placeholder="Untitled"
              onBlur={(e) => commitRename(page.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(page.id, e.currentTarget.value);
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <span
              className={styles.label}
              data-visible={hovered === page.id || undefined}
              onDoubleClick={() => setRenaming(page.id)}
            >
              {page.name || <em>Untitled</em>}
            </span>
          )}

          {menuFor === page.id && (
            <div className={styles.menu} onPointerDown={(e) => e.stopPropagation()}>
              <button
                className={styles.menuItem}
                disabled={pages.length <= 1}
                onClick={() => {
                  canvasStore.getState().removePage(page.id);
                  setMenuFor(null);
                }}
              >
                Delete page
              </button>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setMenuFor(null);
                  setRenaming(page.id);
                }}
              >
                Rename
              </button>
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
