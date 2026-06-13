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
