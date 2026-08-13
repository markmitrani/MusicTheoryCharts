'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/chrome/icons';
import { uiTick } from '@/lib/playback/playback';
import styles from './InversionChevrons.module.scss';

/** Inversion cyclers flanking a selected chord, outside the card frame. */
export function InversionChevrons({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.fromTo(
      ref.current!.children,
      { opacity: 0, x: (i: number) => (i === 0 ? 6 : -6) },
      { opacity: 1, x: 0, duration: 0.35, ease: 'power3.out', stagger: 0.04 },
    );
  }, []);

  const press = (e: React.MouseEvent<HTMLButtonElement>, fn: () => void) => {
    e.stopPropagation();
    gsap.fromTo(e.currentTarget, { scale: 0.82 }, { scale: 1, duration: 0.4, ease: 'back.out(2.5)' });
    uiTick(2);
    fn();
  };

  return (
    <div ref={ref} className={styles.frame} onPointerDown={(e) => e.stopPropagation()}>
      <button
        className={`${styles.chevron} ${styles.left}`}
        aria-label="Previous inversion"
        onClick={(e) => press(e, onPrev)}
      >
        <ChevronLeftIcon width={18} height={18} />
      </button>
      <button
        className={`${styles.chevron} ${styles.right}`}
        aria-label="Next inversion"
        onClick={(e) => press(e, onNext)}
      >
        <ChevronRightIcon width={18} height={18} />
      </button>
    </div>
  );
}
