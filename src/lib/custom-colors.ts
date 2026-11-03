import type { Theme } from './theme';

/**
 * User colour overrides, a preference like the theme: saved per theme to
 * localStorage as the final CSS custom properties, and applied as inline
 * styles on <html> so they win over the theme blocks in globals.scss. The
 * no-flash script in the root layout replays the saved properties pre-paint.
 */
export type ColorSlot = 'bg' | 'surface' | 'accent' | 'text' | 'major' | 'minor';

export const COLOR_SLOTS: { slot: ColorSlot; label: string; token: string }[] = [
  { slot: 'bg', label: 'Background', token: '--canvas-bg' },
  { slot: 'surface', label: 'Surfaces', token: '--element-fill' },
  { slot: 'accent', label: 'Accent', token: '--accent' },
  { slot: 'text', label: 'Text', token: '--text-primary' },
  { slot: 'major', label: 'Major', token: '--tonnetz-major' },
  { slot: 'minor', label: 'Minor', token: '--tonnetz-minor' },
];

const STORAGE_KEY = 'mtp-colors';
/** Experimental switch: off keeps the saved colours but stops applying them. */
const ENABLED_KEY = 'mtp-colors-on';

type Props = Record<string, string>;
type Saved = Partial<Record<Theme, Props>>;

const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
};

/** Every property a slot writes: the token itself plus the tokens derived from it. */
function propsFor(slot: ColorSlot, hex: string, theme: Theme): Props {
  switch (slot) {
    case 'bg':
      return { '--canvas-bg': hex };
    case 'surface':
      // cards (glass-fill), panels and toolbars (chrome-fill) as well as flat fills;
      // dark keeps its see-through cards
      return {
        '--element-fill': hex,
        '--element-fill-raised': `color-mix(in srgb, ${hex} 90%, var(--text-primary))`,
        '--glass-fill':
          theme === 'dark'
            ? `linear-gradient(135deg, color-mix(in srgb, ${hex} 50%, transparent) 0%, color-mix(in srgb, ${hex} 35%, transparent) 100%)`
            : `linear-gradient(150deg, ${hex} 0%, color-mix(in srgb, ${hex} 93%, var(--text-primary)) 100%)`,
        '--chrome-fill': `color-mix(in srgb, ${hex} 82%, transparent)`,
      };
    case 'accent':
      return {
        '--accent': hex,
        '--accent-soft': `color-mix(in srgb, ${hex} 16%, transparent)`,
        '--accent-glow': `color-mix(in srgb, ${hex} 40%, transparent)`,
        '--on-accent': luminance(hex) > 140 ? '#111111' : '#ffffff',
        // chart keys: playing in the accent, highlighted a step toward the background
        '--key-lit': hex,
        '--key-highlight': `color-mix(in srgb, ${hex} 62%, var(--canvas-bg))`,
      };
    case 'text':
      return { '--text-primary': hex };
    case 'major':
      return { '--tonnetz-major': hex };
    case 'minor':
      return { '--tonnetz-minor': hex };
  }
}

const ALL_PROPS = COLOR_SLOTS.flatMap(({ slot }) => Object.keys(propsFor(slot, '#000000', 'light')));

function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Saved;
  } catch {
    return {};
  }
}

function save(saved: Saved): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // storage disabled — still applies for this session
  }
}

export function colorsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setColorsEnabled(on: boolean, theme: Theme): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // storage disabled — still applies for this session
  }
  applyColors(theme, on);
}

/** Replaces the inline overrides on <html> with the ones saved for `theme`, if enabled. */
export function applyColors(theme: Theme, enabled = colorsEnabled()): void {
  const style = document.documentElement.style;
  for (const p of ALL_PROPS) style.removeProperty(p);
  if (!enabled) return;
  const props = load()[theme] ?? {};
  for (const [p, v] of Object.entries(props)) style.setProperty(p, v);
}

export function setColor(theme: Theme, slot: ColorSlot, hex: string): void {
  const saved = load();
  saved[theme] = { ...saved[theme], ...propsFor(slot, hex, theme) };
  save(saved);
  applyColors(theme);
}

export function resetColors(theme: Theme): void {
  const saved = load();
  delete saved[theme];
  save(saved);
  applyColors(theme);
}

export function hasColors(theme: Theme): boolean {
  return Object.keys(load()[theme] ?? {}).length > 0;
}

/** The slot's current colour as #rrggbb, resolved through the live theme. */
export function readColor(token: string): string {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${token})`;
  document.body.appendChild(probe);
  const m = /rgba?\(([^)]+)\)/.exec(getComputedStyle(probe).color);
  probe.remove();
  if (!m) return '#808080';
  const [r, g, b] = m[1].split(/[\s,/]+/).map(Number);
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}
