import { NOTE_NAMES } from '@/lib/theory/note';
import { TRIADS, triadName } from '@/lib/theory/tonnetz';

/**
 * Glyph atlas for the 3D labels: only 36 strings ever appear (12 note names,
 * 24 chord names), so they are drawn once with the app's own loaded faces
 * (Fraunces for notes, Inter for chords) and sampled in the lattice shader.
 * White on transparent; the shader colours it. Cell k: notes 0–11, chord
 * `12 + triadIndex`.
 */
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 5;
// High resolution so labels stay crisp when zoomed in (mipmaps cover zoomed out).
export const CELL_W = 384;
export const CELL_H = 192;

const family = (token: string, fallback: string) => {
  const v = getComputedStyle(document.body).getPropertyValue(token).trim();
  return v || fallback;
};

/** Accidentals: the display face has no ♯, so draw it from the body face, smaller. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, face: string, body: string, size: number, weight: number) {
  const m = /^([A-G])(#?)(m?)$/.exec(text);
  const letter = m ? m[1] : text;
  const sharp = m && m[2] ? '♯' : '';
  const minor = m ? m[3] : '';
  ctx.font = `${weight} ${size}px ${face}`;
  const wL = ctx.measureText(letter).width;
  ctx.font = `${weight} ${size * 0.78}px ${body}`;
  const wS = sharp ? ctx.measureText(sharp).width : 0;
  ctx.font = `${weight} ${size * 0.86}px ${face}`;
  const wM = minor ? ctx.measureText(minor).width : 0;
  let x = cx - (wL + wS + wM) / 2;
  ctx.font = `${weight} ${size}px ${face}`;
  ctx.fillText(letter, x, cy);
  x += wL;
  if (sharp) {
    ctx.font = `${weight} ${size * 0.78}px ${body}`;
    ctx.fillText(sharp, x, cy - size * 0.18);
    x += wS;
  }
  if (minor) {
    ctx.font = `${weight} ${size * 0.86}px ${face}`;
    ctx.fillText(minor, x, cy);
  }
}

export function drawAtlas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  canvas.width = ATLAS_COLS * CELL_W;
  canvas.height = ATLAS_ROWS * CELL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const display = family('--font-display', 'Georgia, serif');
  const body = family('--font-body', 'system-ui, sans-serif');
  const strings = [...NOTE_NAMES, ...TRIADS.map(triadName)];
  strings.forEach((s, k) => {
    const cx = (k % ATLAS_COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(k / ATLAS_COLS) * CELL_H + CELL_H / 2 + 6;
    if (k < 12) drawLabel(ctx, s, cx, cy, display, body, 128, 560);
    else drawLabel(ctx, s, cx, cy, body, body, 104, 500);
  });
  return canvas;
}
