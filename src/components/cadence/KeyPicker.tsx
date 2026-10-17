'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { CIRCLE_KEYS } from '@/lib/theory/circle';
import type { NoteName } from '@/lib/theory/note';
import { Acc } from './Acc';
import styles from './KeyPicker.module.scss';

interface KeyPickerProps {
  value: NoteName | null;
  onChange: (key: NoteName | null) => void;
  onClose: () => void;
}

/**
 * Choose the I: "Functional" keeps Roman numerals; a key maps every node to
 * its chord name in that key. Keys run in circle-of-fifths order.
 */
export function KeyPicker({ value, onChange, onClose }: KeyPickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    gsap.fromTo(ref.current, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      // The anchor (folder tab) toggles the picker itself.
      if (ref.current?.contains(t) || t.closest?.('[data-key-anchor]')) return;
      closeRef.current();
    };
    // Capture phase: Esc closes only the picker, not the window it sits in.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeRef.current();
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('keydown', onKey, { capture: true });
    };
  }, []);

  return (
    <div ref={ref} className={styles.picker} role="dialog" aria-label="Choose a key" onPointerDown={(e) => e.stopPropagation()}>
      <p className={styles.heading}>Home key (I)</p>
      <button className={styles.functional} data-active={value === null || undefined} onClick={() => onChange(null)}>
        Functional <span>I, IV, V…</span>
      </button>
      <div className={styles.keys}>
        {CIRCLE_KEYS.map((k) => (
          <button key={k.note} className={styles.key} data-active={value === k.note || undefined} onClick={() => onChange(k.note)}>
            <Acc text={k.label} />
          </button>
        ))}
      </div>
    </div>
  );
}
