'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import styles from './SettingsBar.module.scss';

/** Floating settings bar above a solo-selected element, with a small gap. */
export function SettingsBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 6, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'power3.out' },
    );
  }, []);

  return (
    <div ref={ref} className={styles.bar} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
