'use client';

import { useEffect } from 'react';
import { canvasStore } from '@/lib/canvas-store/store';
import { setAudioSink } from '@/lib/playback/playback';

/**
 * Boots the audio engine: installs it as the playback sink, unlocks the
 * AudioContext on the first user gesture, and mirrors the store's mute flag.
 * Tone.js is imported dynamically so it never loads during SSR.
 */
export function AudioBoot() {
  useEffect(() => {
    let disposed = false;
    let unsubscribe = () => {};
    const cleanups: Array<() => void> = [];

    (async () => {
      const { getAudioEngine } = await import('@/lib/audio/engine');
      if (disposed) return;
      const engine = getAudioEngine();
      setAudioSink(engine);
      engine.setMuted(canvasStore.getState().muted);

      unsubscribe = canvasStore.subscribe((s, prev) => {
        if (s.muted !== prev.muted) engine.setMuted(s.muted);
      });

      const unlock = () => engine.ensureStarted();
      window.addEventListener('pointerdown', unlock, { capture: true });
      window.addEventListener('keydown', unlock, { capture: true });
      cleanups.push(() => {
        window.removeEventListener('pointerdown', unlock, { capture: true });
        window.removeEventListener('keydown', unlock, { capture: true });
      });
    })();

    return () => {
      disposed = true;
      unsubscribe();
      cleanups.forEach((fn) => fn());
      setAudioSink(null);
    };
  }, []);

  return null;
}
