'use client';

import { useEffect, useRef } from 'react';
import styles from './Backdrops.module.scss';

/**
 * Experimental harmonics visualizer: reads the real time-domain signal off the
 * audio master bus and draws it as layered travelling waves (fundamental +
 * octave + fifth partials) sweeping left→right behind the canvas. Reactive —
 * the whole thing fades to nothing when silent and surges with whatever's
 * playing. Screen-fixed, pointer-transparent. Tone is imported lazily so this
 * adds nothing to the initial bundle.
 */
const ZERO = new Float32Array(0);

export function HarmonicsBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    let getWave: () => Float32Array = () => ZERO;
    // Lazy-load the engine so Tone stays out of the initial bundle.
    import('@/lib/audio/engine').then((m) => {
      if (disposed) return;
      const engine = m.getAudioEngine();
      getWave = () => engine.getWaveform();
    });

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f49119';

    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * d));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * d));
    };
    resize();
    window.addEventListener('resize', resize);

    const layers = [
      { mult: 1, amp: 1.0, offset: 0.0 },
      { mult: 2, amp: 0.5, offset: 0.33 },
      { mult: 3, amp: 0.32, offset: 0.66 },
    ];

    let raf = 0;
    let scroll = 0;
    let env = 0; // smoothed amplitude envelope (0 = silent → invisible)

    const render = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cy = h * 0.5;
      ctx.clearRect(0, 0, w, h);

      const wave = getWave();
      const N = wave.length;
      let rms = 0;
      for (let i = 0; i < N; i++) rms += wave[i] * wave[i];
      rms = N ? Math.sqrt(rms / N) : 0;

      // Gate out the near-silent tail, then fast attack / quick release so the
      // wave blooms on a hit and fades away soon after the note stops.
      const target = rms > 0.012 ? Math.min(1, rms * 6) : 0;
      env += (target - env) * (target > env ? 0.3 : 0.12);
      if (env < 0.004) env = 0; // settle fully to nothing
      if (!reduce) scroll += 0.0008 + env * 0.004; // travel left→right, faster when loud

      const alpha = Math.min(1, env * 1.5);
      if (N > 0 && alpha > 0.003) {
        const baseAmp = h * 0.17 * env;
        ctx.lineWidth = Math.max(1, h * 0.0016);
        ctx.shadowColor = accent;
        ctx.shadowBlur = h * 0.018;
        ctx.strokeStyle = accent;
        for (const L of layers) {
          ctx.globalAlpha = alpha * L.amp * 0.7;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 2) {
            const u = x / w;
            const phase = (u * L.mult + scroll + L.offset) % 1;
            const idx = ((Math.floor(phase * N) % N) + N) % N;
            const y = cy + wave[idx] * baseAmp * L.amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className={styles.layer} aria-hidden />;
}
