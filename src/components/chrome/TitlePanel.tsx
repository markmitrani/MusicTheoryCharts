'use client';

import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import { CloseIcon, LightbulbIcon } from './icons';
import styles from './TitlePanel.module.scss';

/**
 * Intro panel, top-right. Fully collapses into a lightbulb icon; the
 * lightbulb reopens it. Panel and bulb cross-fade through the same corner.
 */
export function TitlePanel() {
  const [open, setOpen] = useState(true);
  const panelRef = useRef<HTMLElement>(null);
  const bulbRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    gsap.to(panelRef.current, {
      scale: 0.6,
      opacity: 0,
      transformOrigin: 'top right',
      duration: 0.4,
      ease: 'power3.in',
      onComplete: () => {
        setOpen(false);
        requestAnimationFrame(() => {
          gsap.fromTo(
            bulbRef.current,
            { scale: 0.4, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.2)' },
          );
        });
      },
    });
  };

  const reopen = () => {
    gsap.to(bulbRef.current, {
      scale: 0.4,
      opacity: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        setOpen(true);
        requestAnimationFrame(() => {
          gsap.fromTo(
            panelRef.current,
            { scale: 0.6, opacity: 0, transformOrigin: 'top right' },
            { scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out' },
          );
        });
      },
    });
  };

  if (!open) {
    return (
      <button
        ref={bulbRef}
        className={styles.bulb}
        aria-label="About this playground"
        title="About this playground"
        onClick={reopen}
      >
        <LightbulbIcon width={20} height={20} />
      </button>
    );
  }

  return (
    <aside ref={panelRef} className={styles.panel}>
      <button className={styles.collapse} aria-label="Collapse intro" onClick={close}>
        <CloseIcon width={15} height={15} />
      </button>
      <h1 className={styles.title}>Music Theory Playground</h1>
      <p className={styles.byline}>
        made by <a href="https://github.com/markmitrani" target="_blank" rel="noreferrer">Mark Mitrani</a>
      </p>
      <div className={styles.body}>
        <p>
          Music theory is often presented as a series of isolated groups of concepts. Having to
          switch contexts between different groups of musical tools such as scales and chords leads
          to a lot of cognitive strain for theory learners, diminishing the motivation to fully
          grasp the concepts necessary for advanced jazz playing.
        </p>
        <p>
          This canvas is the solution. It lets you arrange everything together, your way. Place
          scales, chords, circle of fifths, upload reference images, and explore other conceptual
          tools however suits your purpose best, whether that&rsquo;s composition, improvisation, or
          pure learning.
        </p>
        <p className={styles.featuresLead}>Features:</p>
        <ul>
          <li>Place scales, chords &amp; the circle of fifths side by side</li>
          <li>Explore Bart&oacute;k&rsquo;s Pitch Axis and other advanced frameworks</li>
          <li>Upload reference scores or charts alongside your tools</li>
          <li>Arrange everything however <i>you</i> think; no forced structure</li>
        </ul>
      </div>
    </aside>
  );
}
