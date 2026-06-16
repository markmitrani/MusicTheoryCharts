'use client';

import { useEffect, useRef, useState } from 'react';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { uiTick } from '@/lib/playback/playback';
import { PlusIcon } from './icons';
import styles from './PageRail.module.scss';

const ROW_HEIGHT = 13.75; // bar 6.75px + gap 7px, used for drag-reorder math

/**
 * Vertical page rail (Direction A / page-navigation.png): "+" on top,
 * stacked bars, active page wide + bright. Hover reveals the name,
 * double-click renames inline, right-click offers delete (disabled at one
 * page), dragging a bar vertically reorders.
 */
/** Bars taper as they get further from the active page (reference design). */
const barWidth = (distance: number, hovered: boolean) => {
  const base = distance === 0 ? 56 : Math.max(22, 48 - 8 * distance);
  return hovered && distance !== 0 ? base + 12 : base;
};

export function PageRail() {
  const pages = useCanvas((s) => s.pages);
  const activePageId = useCanvas((s) => s.activePageId);
  const [hovered, setHovered] = useState<string | null>(null);
  // True while the pointer is anywhere over the rail — reveals every label.
  const [railHovered, setRailHovered] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: string; startY: number; fromIndex: number; moved: boolean } | null>(null);
  // Live transform of the bar being carried; cleared on release so it snaps home.
  const [dragView, setDragView] = useState<{ id: string; offset: number } | null>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    setConfirmingDelete(false);
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
    // Tiny threshold so a genuine click still reads as a tap, not a drag.
    if (!d.moved && Math.abs(delta) < 4) return;
    d.moved = true;
    // Read live order from the store: reorderPage may already have run this drag,
    // and the `pages` closure value is stale within a synchronous handler.
    const list = canvasStore.getState().pages;
    const currentIndex = list.findIndex((p) => p.id === d.id);
    const toIndex = Math.max(
      0,
      Math.min(list.length - 1, d.fromIndex + Math.round(delta / ROW_HEIGHT)),
    );
    if (toIndex !== currentIndex) {
      canvasStore.getState().reorderPage(d.id, toIndex);
    }
    // Keep the carried bar glued to the cursor regardless of how far the
    // underlying order has shifted: compensate for slots already moved.
    const liveIndex = canvasStore.getState().pages.findIndex((p) => p.id === d.id);
    const offset = (d.fromIndex - liveIndex) * ROW_HEIGHT + delta;
    setDragView({ id: d.id, offset });
  };

  const onBarPointerUp = (id: string) => {
    const wasDrag = drag.current?.moved;
    drag.current = null;
    setDragView(null); // transform returns to 0 → CSS transition snaps it home
    if (!wasDrag && id !== canvasStore.getState().activePageId) {
      uiTick(4);
      canvasStore.getState().setActivePage(id);
    }
  };

  return (
    <nav
      className={styles.rail}
      aria-label="Pages"
      onMouseEnter={() => setRailHovered(true)}
      onMouseLeave={() => setRailHovered(false)}
    >
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
            style={
              {
                width: barWidth(
                  Math.abs(i - pages.findIndex((p) => p.id === activePageId)),
                  hovered === page.id,
                ),
                '--drag-offset': dragView?.id === page.id ? `${dragView.offset}px` : '0px',
              } as React.CSSProperties
            }
            data-active={page.id === activePageId || undefined}
            data-dragging={dragView?.id === page.id || undefined}
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
              data-visible={railHovered || hovered === page.id || undefined}
              onDoubleClick={() => setRenaming(page.id)}
            >
              {page.name || <em>Untitled</em>}
            </span>
          )}

          {menuFor === page.id && (
            <div className={styles.menu} onPointerDown={(e) => e.stopPropagation()}>
              <button
                className={styles.menuItem}
                onClick={() => {
                  setMenuFor(null);
                  setRenaming(page.id);
                }}
              >
                Rename
              </button>
              {confirmingDelete ? (
                <div className={styles.confirmRow}>
                  <span>Delete page?</span>
                  <button
                    className={styles.confirmDelete}
                    onClick={() => {
                      canvasStore.getState().removePage(page.id);
                      setMenuFor(null);
                    }}
                  >
                    Delete
                  </button>
                  <button className={styles.confirmCancel} onClick={() => setConfirmingDelete(false)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  className={styles.menuItem}
                  disabled={pages.length <= 1}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete page…
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
