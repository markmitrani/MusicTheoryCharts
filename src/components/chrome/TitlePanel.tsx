'use client';

import { useRef, useState } from 'react';
import { gsap } from 'gsap';
import styles from './TitlePanel.module.scss';

/** Collapsible intro panel, top-right (content per the reference screenshot). */
export function TitlePanel() {
  const [open, setOpen] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  const toggle = () => {
    const body = bodyRef.current!;
    if (open) {
      gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: 'power3.inOut' });
    } else {
      gsap.set(body, { height: 'auto' });
      gsap.from(body, {
        height: 0,
        duration: 0.45,
        ease: 'power3.inOut',
        onComplete: () => gsap.set(body, { clearProps: 'height' }),
      });
      gsap.to(body, { opacity: 1, duration: 0.35, delay: 0.1, ease: 'power2.out' });
    }
    setOpen(!open);
  };

  return (
    <aside className={styles.panel}>
      <button
        className={styles.collapse}
        aria-label={open ? 'Collapse intro' : 'Expand intro'}
        aria-expanded={open}
        onClick={toggle}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <path d="M14 10 20 4M20 4h-5M20 4v5M10 14l-6 6M4 20h5M4 20v-5" />
        </svg>
      </button>
      <h1 className={styles.title}>Music Theory Playground</h1>
      <p className={styles.byline}>
        made by <a href="https://github.com/markmitrani" target="_blank" rel="noreferrer">Mark Mitrani</a>
      </p>
      <div ref={bodyRef} className={styles.body}>
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
