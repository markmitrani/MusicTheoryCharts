/**
 * Theme is a user preference (not part of the canvas document), persisted to
 * localStorage and applied via `data-theme` on <html>. A no-flash inline
 * script in the root layout applies the saved value before first paint.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'mtp-theme';

export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return (document.documentElement.dataset.theme as Theme) || 'dark';
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private mode / storage disabled — theme still applies for this session
  }
}

/**
 * Surface treatment, toggled independently of the colour theme so flat vs
 * gradient ("glass") surfaces can be A/B compared. Components stay flat by
 * default and opt into gradients under `[data-surfaces='glass']` — the token
 * architecture keeps this a one-attribute switch, no per-component plumbing.
 */
export type Surfaces = 'flat' | 'glass';

const SURFACES_KEY = 'mtp-surfaces';

export function getSurfaces(): Surfaces {
  if (typeof document === 'undefined') return 'flat';
  return (document.documentElement.dataset.surfaces as Surfaces) || 'flat';
}

export function setSurfaces(surfaces: Surfaces): void {
  document.documentElement.dataset.surfaces = surfaces;
  try {
    localStorage.setItem(SURFACES_KEY, surfaces);
  } catch {
    // storage disabled — still applies for this session
  }
}
