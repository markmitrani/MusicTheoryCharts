/**
 * Theme tokens for the 3D world, read live from globals.scss. A probe element
 * resolves each token (var(), color-mix(), rgba()) to the browser's rgb()
 * form; translucent tokens are composited over the canvas background so the
 * shader gets opaque sRGB colours that match the card exactly.
 */

export interface WorldColors {
  bg: string;
  fill: string;
  rim: string;
  hairline: string;
  seam: string;
  text: string;
  textStrong: string;
  accent: string;
  accentWarm: string;
  major: string;
  minor: string;
  dark: boolean;
}

type RGBA = [number, number, number, number];

const parse = (css: string): RGBA => {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (m) {
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  const s = /color\(srgb ([^)]+)\)/.exec(css);
  if (s) {
    const p = s[1].split(/[\s/]+/).filter(Boolean).map(Number);
    return [p[0] * 255, p[1] * 255, p[2] * 255, p.length > 3 ? p[3] : 1];
  }
  return [128, 128, 128, 1];
};

const over = (c: RGBA, bg: RGBA): string => {
  const a = c[3];
  const ch = (k: number) => Math.round(c[k] * a + bg[k] * (1 - a));
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
};

export function readWorldColors(): WorldColors {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const get = (token: string): RGBA => {
    probe.style.color = '';
    probe.style.color = `var(${token})`;
    return parse(getComputedStyle(probe).color);
  };
  const mix = (token: string, pct: number): RGBA => {
    probe.style.color = `color-mix(in srgb, var(${token}) ${pct}%, var(--canvas-bg))`;
    return parse(getComputedStyle(probe).color);
  };
  const bg = get('--canvas-bg');
  const out: WorldColors = {
    bg: over(bg, bg),
    fill: over(get('--element-fill'), bg),
    rim: over(get('--element-stroke-hover'), bg),
    hairline: over(mix('--text-primary', 16), bg),
    seam: over(get('--accent-warm'), bg),
    text: over(get('--text-secondary'), bg),
    textStrong: over(get('--text-primary'), bg),
    accent: over(get('--accent'), bg),
    accentWarm: over(get('--accent-warm'), bg),
    major: over(get('--tonnetz-major'), bg),
    minor: over(get('--tonnetz-minor'), bg),
    dark: bg[0] + bg[1] + bg[2] < 384,
  };
  probe.remove();
  return out;
}

/** Calls `fn` whenever the theme or surfaces mode changes on <html>. */
export function onThemeChange(fn: () => void): () => void {
  const obs = new MutationObserver(fn);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-surfaces', 'class', 'style'] });
  return () => obs.disconnect();
}
