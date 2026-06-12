'use client';

import { useState } from 'react';
import { useCanvas, canvasStore } from '@/lib/canvas-store/store';
import { PlusIcon } from './icons';
import styles from './PageRail.module.scss';

/**
 * Vertical page rail, left edge (Direction A / page-navigation.png):
 * stacked bars, active page wide + bright, "+" on top. Hover reveals the
 * page name. Rename/reorder/delete interactions land with Phase 7.
 */
export function PageRail() {
  const pages = useCanvas((s) => s.pages);
  const activePageId = useCanvas((s) => s.activePageId);
  const [hovered, setHovered] = useState<string | null>(null);

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
            onClick={() => canvasStore.getState().setActivePage(page.id)}
            onMouseEnter={() => setHovered(page.id)}
            onMouseLeave={() => setHovered((h) => (h === page.id ? null : h))}
          />
          <span className={styles.label} data-visible={hovered === page.id || undefined}>
            {page.name || <em>Untitled</em>}
          </span>
        </div>
      ))}
    </nav>
  );
}
