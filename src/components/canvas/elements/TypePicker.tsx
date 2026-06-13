'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import { SCALE_GROUPS } from '@/lib/theory/scales';
import { CHORD_GROUPS } from '@/lib/theory/chords';
import styles from './TypePicker.module.scss';

/**
 * Root + type picker, shared by the spawn stub and the name-tab editor.
 * Type ids are namespaced: 'scale:<scaleId>' or 'chord:<qualityId>'.
 * `kinds` limits which sections show (editing keeps the element's kind).
 */
interface TypePickerProps {
  kinds: Array<'scale' | 'chord'>;
  root: NoteName | null;
  typeId: string | null;
  onChange(root: NoteName | null, typeId: string | null): void;
  onClose?(): void;
  /** Render flat inside a parent (spawn stub) instead of as a popover. */
  inline?: boolean;
}

export function TypePicker({ kinds, root, typeId, onChange, onClose, inline }: TypePickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: -6, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'power3.out' },
    );
  }, []);

  // Scrolling the type list must not pan the canvas. The viewport's wheel
  // handler is a native listener on an ancestor, so stop propagation natively.
  useEffect(() => {
    const node = ref.current!;
    const isolate = (e: WheelEvent) => e.stopPropagation();
    node.addEventListener('wheel', isolate);
    return () => node.removeEventListener('wheel', isolate);
  }, []);

  // close on outside click
  useEffect(() => {
    if (!onClose) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('pointerdown', handler, { capture: true });
    return () => window.removeEventListener('pointerdown', handler, { capture: true });
  }, [onClose]);

  const sections: Array<{ label: string; items: Array<{ id: string; label: string }> }> = [];
  if (kinds.includes('scale')) {
    for (const g of SCALE_GROUPS) {
      sections.push({
        label: kinds.length > 1 ? `Scales — ${g.label}` : g.label,
        items: g.scales.map((s) => ({ id: `scale:${s.id}`, label: s.label })),
      });
    }
  }
  if (kinds.includes('chord')) {
    for (const g of CHORD_GROUPS) {
      sections.push({
        label: kinds.length > 1 ? `Chords — ${g.label}` : g.label,
        items: g.chords.map((c) => ({ id: `chord:${c.id}`, label: c.label || 'maj' })),
      });
    }
  }

  return (
    <div
      ref={ref}
      className={inline ? styles.pickerInline : styles.picker}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className={styles.roots}>
        {NOTE_NAMES.map((n) => (
          <button
            key={n}
            className={styles.root}
            data-active={n === root || undefined}
            onClick={() => onChange(n, typeId)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className={styles.types}>
        {sections.map((section) => (
          <div key={section.label}>
            <div className={styles.groupLabel}>{section.label}</div>
            {section.items.map((item) => (
              <button
                key={item.id}
                className={styles.type}
                data-active={item.id === typeId || undefined}
                onClick={() => onChange(root, item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
