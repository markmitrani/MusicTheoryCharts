'use client';

import { useEffect, useState } from 'react';

/**
 * Print texture for the progression stage background, built from layered
 * noise rather than a single turbulence: a softly lit paper tooth, broad
 * faintly coloured mottling (a minimal hue drift), a crackle of veins and a
 * dust of pits whose warm and cool copies sit a hair apart (chromatic
 * aberration in the grain itself).
 *
 * The filter runs once, offscreen, into a 2400×1200 bitmap that every stage
 * shares: crisp at 2× and when zoomed, one image across the whole stage so it
 * never repeats, and nothing to recompute while the canvas pans or zooms.
 */
const W = 2400;
const H = 1200;

const GRUNGE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'>
<filter id='g' x='0' y='0' width='100%' height='100%' color-interpolation-filters='sRGB'>
  <feTurbulence type='fractalNoise' baseFrequency='0.38' numOctaves='3' seed='4' result='fine'/>
  <feDiffuseLighting in='fine' surfaceScale='0.7' diffuseConstant='1' lighting-color='white' result='lit'>
    <feDistantLight azimuth='225' elevation='60'/>
  </feDiffuseLighting>
  <feComponentTransfer in='lit' result='tooth'>
    <feFuncR type='linear' slope='1.6' intercept='-0.89'/>
    <feFuncG type='linear' slope='1.6' intercept='-0.89'/>
    <feFuncB type='linear' slope='1.6' intercept='-0.89'/>
  </feComponentTransfer>
  <feTurbulence type='fractalNoise' baseFrequency='0.0022' numOctaves='4' seed='9' result='mottle'/>
  <feColorMatrix in='mottle' type='matrix' values='0.5 0.2 0.2 0 0.05  0.2 0.5 0.2 0 0.05  0.2 0.2 0.5 0 0.05  0 0 0 0 1' result='tint'/>
  <feBlend in='tooth' in2='tint' mode='overlay' result='base'/>
  <feTurbulence type='turbulence' baseFrequency='0.012' numOctaves='3' seed='33' result='veins'/>
  <feColorMatrix in='veins' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 -14 0 0 0.5' result='crackle'/>
  <feTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='1' seed='17' result='dust'/>
  <feColorMatrix in='dust' type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -22 0 0 0 5.2' result='pits'/>
  <feMerge result='marks'><feMergeNode in='crackle'/><feMergeNode in='pits'/></feMerge>
  <feOffset in='marks' dx='-1.6' result='marksL'/>
  <feColorMatrix in='marksL' type='matrix' values='0 0 0 0 1  0 0 0 0 0.3  0 0 0 0 0.2  0 0 0 0.5 0' result='warm'/>
  <feOffset in='marks' dx='1.6' result='marksR'/>
  <feColorMatrix in='marksR' type='matrix' values='0 0 0 0 0.2  0 0 0 0 0.4  0 0 0 0 1  0 0 0 0.5 0' result='cool'/>
  <feMerge><feMergeNode in='base'/><feMergeNode in='warm'/><feMergeNode in='cool'/><feMergeNode in='marks'/></feMerge>
</filter>
<rect width='100%' height='100%' filter='url(#g)'/>
</svg>`;

const SVG_URL = `data:image/svg+xml,${encodeURIComponent(GRUNGE_SVG.replace(/\n\s*/g, ' '))}`;

let bitmap: Promise<string> | null = null;

/** Renders the texture once (when the browser is idle) and resolves to an image URL. */
function renderGrunge(): Promise<string> {
  bitmap ??= new Promise((resolve) => {
    const run = () => {
      const img = new Image(W, H);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          canvas.getContext('2d')!.drawImage(img, 0, 0, W, H);
          canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : SVG_URL), 'image/jpeg', 0.9);
        } catch {
          // A browser that won't read an SVG back from a canvas still draws it as a background.
          resolve(SVG_URL);
        }
      };
      img.onerror = () => resolve('');
      img.src = SVG_URL;
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 200);
  });
  return bitmap;
}

/** The shared grunge texture URL, or null until it's ready. */
export function useGrunge(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    renderGrunge().then((u) => live && u && setUrl(u));
    return () => {
      live = false;
    };
  }, []);
  return url;
}
