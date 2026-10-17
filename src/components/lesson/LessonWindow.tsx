'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/components/chrome/icons';
import { uiTick } from '@/lib/playback/playback';
import styles from './LessonWindow.module.scss';

interface LessonWindowProps {
  label: string;
  slideCount: number;
  slide: number;
  onSlide: (slide: number) => void;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Paged slideshow shell for lessons: glass window over a dimmed canvas,
 * → on the right edge, ← on the left once there's a previous slide, dots
 * along the bottom. ←/→ and Esc work from the keyboard.
 */
export function LessonWindow({ label, slideCount, slide, onSlide, onClose, children }: LessonWindowProps) {
  // Portal target only exists on the client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const go = (n: number) => {
    if (n < 0 || n >= slideCount || n === slide) return;
    uiTick(n);
    onSlide(n);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(slide + 1);
      else if (e.key === 'ArrowLeft') go(slide - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!mounted) return null;

  return createPortal(
    <div className={styles.backdrop}>
      <section className={styles.window} role="dialog" aria-modal="true" aria-label={label}>
        <button className={styles.close} aria-label="Close explainer" onClick={onClose}>
          <CloseIcon width={16} height={16} />
        </button>

        <div className={styles.body}>{children}</div>

        {slide > 0 && (
          <button className={`${styles.arrow} ${styles.prev}`} aria-label="Previous slide" onClick={() => go(slide - 1)}>
            <ChevronLeftIcon width={22} height={22} />
          </button>
        )}
        {slide < slideCount - 1 && (
          <button className={`${styles.arrow} ${styles.next}`} aria-label="Next slide" onClick={() => go(slide + 1)}>
            <ChevronRightIcon width={22} height={22} />
          </button>
        )}

        <nav className={styles.dots} aria-label="Slides">
          {Array.from({ length: slideCount }, (_, i) => (
            <button
              key={i}
              className={styles.dot}
              data-active={i === slide || undefined}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === slide ? 'step' : undefined}
              onClick={() => go(i)}
            />
          ))}
        </nav>
      </section>
    </div>,
    document.body,
  );
}
