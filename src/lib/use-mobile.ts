import { useSyncExternalStore } from 'react';

/** Phone layout breakpoint. Keep in sync with the `max-width: 640px` media queries. */
export const MOBILE_QUERY = '(max-width: 640px)';

export const isMobile = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;

const subscribe = (fn: () => void) => {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', fn);
  return () => mq.removeEventListener('change', fn);
};

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, isMobile, () => false);
}

/** Shared touch-gesture state, written by the Viewport's pinch handler. */
export const touchGesture = {
  /** True from a second finger landing until every finger lifts. */
  pinching: false,
  /** Bumps on each pinch start, so a tap can tell it became a pinch. */
  serial: 0,
};
