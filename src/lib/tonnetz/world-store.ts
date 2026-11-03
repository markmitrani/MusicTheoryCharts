import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

/** Screen rect the 3D world expands from (the card that opened it). */
export interface OriginRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface WorldState {
  /** Tonnetz element the 3D world is showing, or null when closed. */
  elementId: string | null;
  origin: OriginRect | null;
  open(elementId: string, origin: OriginRect | null): void;
  close(): void;
}

export const worldStore = createStore<WorldState>((set) => ({
  elementId: null,
  origin: null,
  open: (elementId, origin) => set({ elementId, origin }),
  close: () => set({ elementId: null, origin: null }),
}));

export function useWorld<T>(selector: (s: WorldState) => T): T {
  return useStore(worldStore, selector);
}

/** Load the 3D bundle ahead of the click (hover / focus on the 3D button). */
export function prefetchWorld() {
  void import('@/components/tonnetz/TonnetzWorld');
}
