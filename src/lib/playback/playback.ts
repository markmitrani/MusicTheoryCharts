import { gsap } from 'gsap';

/**
 * Element playback sequencing. Drives the piano key-light animation via a
 * GSAP timeline; the audio engine (Phase 4) attaches to the same timeline so
 * sound and visuals are one frame-synced event. Visual playback always runs,
 * muted or not.
 */
export interface PlaybackHandle {
  stop(): void;
}

interface PlaybackCallbacks {
  onLit(lit: ReadonlySet<number>): void;
  onDone(): void;
}

/** Audio hooks installed by the audio engine in Phase 4. */
export interface AudioSink {
  triggerNote(pitch: number, durationMs: number, velocity?: number): void;
  triggerChord(pitches: number[], durationMs: number): void;
  /** A new playback is taking over — release held notes so tails cross-fade. */
  interrupt(): void;
  /** Quiet UI pluck for chrome interactions, pitch cycled by step. */
  uiTick(step: number): void;
}

/** Frame-synced UI sound for button presses; no-op until audio boots. */
export function uiTick(step = 0) {
  audioSink?.uiTick(step);
}

let audioSink: AudioSink | null = null;
let current: { tl: gsap.core.Timeline; cancel: () => void } | null = null;

export function setAudioSink(sink: AudioSink | null) {
  audioSink = sink;
}

/** Stop whatever is playing (audio engine cross-fades on its side). */
function takeOver(cb: PlaybackCallbacks): gsap.core.Timeline {
  current?.cancel();
  audioSink?.interrupt();
  const tl = gsap.timeline({
    onComplete: () => {
      cb.onLit(new Set());
      cb.onDone();
      current = null;
    },
  });
  current = {
    tl,
    cancel: () => {
      tl.kill();
      cb.onLit(new Set());
      cb.onDone();
    },
  };
  return tl;
}

/** All notes at once, sustained ~1.5s with a soft visual release. */
export function playChord(pitches: number[], cb: PlaybackCallbacks, sustainMs = 1500): PlaybackHandle {
  const tl = takeOver(cb);
  tl.call(() => {
    cb.onLit(new Set(pitches));
    audioSink?.triggerChord(pitches, sustainMs);
  });
  tl.call(() => cb.onLit(new Set()), [], sustainMs / 1000);
  return { stop: () => current?.cancel() };
}

/**
 * Sequential scale playback (~stepMs per note, slight legato overlap),
 * ending on the octave root above the last note even though it isn't
 * highlighted on the element.
 */
/**
 * Sequential chord progression (harmony element's card play): each chord
 * sustains slightly past the next one's attack for a connected feel.
 * onStep receives the current chord index, -1 when finished.
 */
export function playProgression(
  chords: number[][],
  cb: { onStep(index: number): void; onDone(): void },
  stepMs = 700,
): PlaybackHandle {
  const tl = takeOver({ onLit: () => {}, onDone: cb.onDone });
  chords.forEach((pitches, i) => {
    tl.call(
      () => {
        cb.onStep(i);
        audioSink?.triggerChord(pitches, stepMs * 1.3);
      },
      [],
      (i * stepMs) / 1000,
    );
  });
  tl.call(() => cb.onStep(-1), [], (chords.length * stepMs + 300) / 1000);
  return { stop: () => current?.cancel() };
}

export function playScale(pitches: number[], cb: PlaybackCallbacks, stepMs = 180): PlaybackHandle {
  const tl = takeOver(cb);
  const noteMs = stepMs * 1.35; // legato: each note overlaps the next slightly
  const active = new Map<number, number>(); // pitch → overlap count
  const update = () => cb.onLit(new Set(active.keys()));

  pitches.forEach((pitch, i) => {
    const at = (i * stepMs) / 1000;
    tl.call(
      () => {
        active.set(pitch, (active.get(pitch) ?? 0) + 1);
        update();
        audioSink?.triggerNote(pitch, noteMs);
      },
      [],
      at,
    );
    tl.call(
      () => {
        const count = (active.get(pitch) ?? 1) - 1;
        if (count <= 0) active.delete(pitch);
        else active.set(pitch, count);
        update();
      },
      [],
      at + noteMs / 1000,
    );
  });
  return { stop: () => current?.cancel() };
}
