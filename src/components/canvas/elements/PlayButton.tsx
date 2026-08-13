'use client';

import { gsap } from 'gsap';
import { PlayIcon } from '@/components/chrome/icons';
import styles from './PlayButton.module.scss';

export function PlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      className={styles.play}
      data-playing={playing || undefined}
      aria-label="Play"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        gsap.fromTo(e.currentTarget, { scale: 0.85 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' });
        onClick();
      }}
    >
      <PlayIcon width={15} height={15} />
    </button>
  );
}
