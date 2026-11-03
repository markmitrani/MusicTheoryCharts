import { TRIADS, noteName, triadName, triadFunction } from '@/lib/theory/tonnetz';

/**
 * Glyph atlas for the 3D labels: only 60 strings ever appear (12 note names,
 * 24 chord names, 24 harmonic functions), so they are drawn once with the
 * app's own loaded faces (Fraunces for notes, Inter for chords and numerals)
 * and sampled in the lattice shader. White on transparent; the shader colours
 * it. Cell k: notes 0–11, chord `12 + triadIndex`, function
 * `36 + 2 · (root − centre) + minor`.
 */
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
// High resolution so labels stay crisp when zoomed in (mipmaps cover zoomed out).
export const CELL_W = 384;
export const CELL_H = 192;

const family = (token: string, fallback: string) => {
  const v = getComputedStyle(document.body).getPropertyValue(token).trim();
  return v || fallback;
};

interface Run {
  text: string;
  font: string;
  /** Vertical shift in px (raised accidentals). */
  dy?: number;
  /** Accidentals: set by their ink, not their full-em advance (Inter centres them in one). */
  tight?: boolean;
}

/** Draws runs centred on (cx, cy), accidentals kerned in to a hair of air. */
function drawRuns(ctx: CanvasRenderingContext2D, runs: Run[], cx: number, cy: number) {
  const placed = runs.map((r) => {
    ctx.font = r.font;
    const m = ctx.measureText(r.text);
    if (!r.tight) return { r, width: m.width, offset: 0 };
    const air = m.width * 0.06;
    return { r, width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 2 * air, offset: m.actualBoundingBoxLeft + air };
  });
  let x = cx - placed.reduce((w, p) => w + p.width, 0) / 2;
  for (const { r, width, offset } of placed) {
    ctx.font = r.font;
    ctx.fillText(r.text, x + offset, cy + (r.dy ?? 0));
    x += width;
  }
}

/** "D♭m" → letter, accidental (body face, smaller, raised), minor suffix. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, face: string, body: string, size: number, weight: number) {
  const m = /^([A-G])([#♯♭]?)(m?)$/.exec(text);
  if (!m) return drawRuns(ctx, [{ text, font: `${weight} ${size}px ${face}` }], cx, cy);
  const runs: Run[] = [{ text: m[1], font: `${weight} ${size}px ${face}` }];
  if (m[2]) runs.push({ text: m[2] === '♭' ? '♭' : '♯', font: `${weight} ${size * 0.78}px ${body}`, dy: -size * 0.18, tight: true });
  if (m[3]) runs.push({ text: m[3], font: `${weight} ${size * 0.86}px ${face}` });
  drawRuns(ctx, runs, cx, cy);
}

/** "♭VII" → accidental (tight) then the numeral, in the body face. */
function drawNumeral(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, body: string, size: number) {
  const m = /^([♭♯]?)(.*)$/.exec(text)!;
  const runs: Run[] = [];
  if (m[1]) runs.push({ text: m[1], font: `500 ${size * 0.9}px ${body}`, tight: true });
  runs.push({ text: m[2], font: `500 ${size}px ${body}` });
  drawRuns(ctx, runs, cx, cy);
}

/** Names are spelled for `centre`'s key, as on the card. */
export function drawAtlas(canvas: HTMLCanvasElement, centre: number): HTMLCanvasElement {
  canvas.width = ATLAS_COLS * CELL_W;
  canvas.height = ATLAS_ROWS * CELL_H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  const display = family('--font-display', 'Georgia, serif');
  const body = family('--font-body', 'system-ui, sans-serif');
  const functions = Array.from({ length: 24 }, (_, k) => triadFunction({ root: k >> 1, minor: (k & 1) === 1 }, 0));
  const notes = Array.from({ length: 12 }, (_, pc) => noteName(pc, centre));
  const strings = [...notes, ...TRIADS.map((t) => triadName(t, centre)), ...functions];
  strings.forEach((s, k) => {
    const cx = (k % ATLAS_COLS) * CELL_W + CELL_W / 2;
    const cy = Math.floor(k / ATLAS_COLS) * CELL_H + CELL_H / 2 + 6;
    if (k < 12) drawLabel(ctx, s, cx, cy, display, body, 128, 560);
    else if (k < 36) drawLabel(ctx, s, cx, cy, body, body, 104, 500);
    // numerals as elsewhere in the app: body face, medium weight
    else drawNumeral(ctx, s, cx, cy, body, 92);
  });
  return canvas;
}
