import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/** Lessons that can open in the explainer window. */
export type LessonId = 'ways-home';

interface LessonState {
  open: LessonId | null;
  slide: number;
  /** Canvas element that launched the lesson (its key carries into the finale). */
  sourceId: string | null;
  openLesson(id: LessonId, sourceId?: string): void;
  close(): void;
  setSlide(slide: number): void;
}

export const lessonStore = createStore<LessonState>((set) => ({
  open: null,
  slide: 0,
  sourceId: null,
  openLesson: (id, sourceId) => set({ open: id, slide: 0, sourceId: sourceId ?? null }),
  close: () => set({ open: null, sourceId: null }),
  setSlide: (slide) => set({ slide }),
}));

export function useLesson<T>(selector: (s: LessonState) => T): T {
  return useStore(lessonStore, selector);
}
