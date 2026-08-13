'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';
import styles from './KeyboardShortcuts.module.scss';

// macOS uses ⌘; everything else uses Ctrl. Detected once at module load.
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

interface Shortcut {
  keys: string[];
  label: string;
}

const GROUPS: Array<{ heading: string; items: Shortcut[] }> = [
  {
    heading: 'Canvas',
    items: [
      { label: 'Pan', keys: ['Two-finger drag', 'Space + drag'] },
      { label: 'Zoom', keys: ['Pinch', `${MOD} + scroll`] },
    ],
  },
  {
    heading: 'Select',
    items: [
      { label: 'Select all', keys: [`${MOD} A`] },
      { label: 'Add to selection', keys: ['Shift + click'] },
      { label: 'Marquee select', keys: ['Drag empty canvas'] },
    ],
  },
  {
    heading: 'Edit',
    items: [
      { label: 'Copy / Cut / Paste', keys: [`${MOD} C`, `${MOD} X`, `${MOD} V`] },
      { label: 'Duplicate', keys: [`${MOD} D`] },
      { label: 'Delete', keys: ['Delete', '⌫'] },
      { label: 'Undo / Redo', keys: [`${MOD} Z`, `${MOD} ⇧ Z`] },
    ],
  },
  {
    heading: 'Arrange',
    items: [
      { label: 'Forward / Backward', keys: [`${MOD} ]`, `${MOD} [`] },
      { label: 'To front / back', keys: [`${MOD} ⇧ ]`, `${MOD} ⇧ [`] },
    ],
  },
  {
    heading: 'Pitch',
    items: [
      { label: 'Transpose ± semitone', keys: ['↑', '↓'] },
      { label: 'Transpose ± a fifth', keys: ['⇧ ↑', '⇧ ↓'] },
      { label: 'Cycle chord inversion', keys: ['←', '→'] },
      { label: 'Cycle highlight colour', keys: ['R'] },
    ],
  },
  {
    heading: 'Navigate',
    items: [{ label: 'Switch page (nothing selected)', keys: ['↑', '↓'] }],
  },
];

/** Modal listing every keyboard + trackpad shortcut, grouped by purpose. */
export function KeyboardShortcuts({ onClose }: { onClose: () => void }) {
  // Portal to <body> so the fixed backdrop covers the viewport — rendered in
  // place it would inherit the intro panel's GSAP transform as its containing
  // block and stay trapped inside that pane.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <h2>Keyboard shortcuts</h2>
          <button className={styles.close} aria-label="Close" onClick={onClose}>
            <CloseIcon width={16} height={16} />
          </button>
        </header>
        <div className={styles.grid}>
          {GROUPS.map((group) => (
            <section key={group.heading} className={styles.group}>
              <h3>{group.heading}</h3>
              {group.items.map((item) => (
                <div key={item.label} className={styles.row}>
                  <span className={styles.label}>{item.label}</span>
                  <span className={styles.keys}>
                    {item.keys.map((k, i) => (
                      <kbd key={i} className={styles.kbd}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
