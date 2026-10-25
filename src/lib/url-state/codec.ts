import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import type { CanvasElement, Page } from '@/lib/canvas-store/types';
import { CADENCE_TYPES, type WalkStep } from '@/lib/theory/cadence';

/**
 * Compact URL codec. The current writer emits v2; v1 is still decoded so links
 * shared before the format change keep working.
 *
 *   v2:<activeIdx>;<page>;<page>...
 *   page    = <escapedName>~<el>-<el>...        (elements joined by '-')
 *   scale   = s + pc1 + type1 + x2 + y2         (7 chars)
 *   harmony = h + pc1 + type1 + x2 + y2 [+f1]   (7-8 chars; trailing 1 = 7ths)
 *   chord   = c + pc1 + type1 + pack1 + x2 + y2 (8 chars; pack = inv*2+seventh)
 *   circle  = o + center1 + flags1 + x2 + y2    (7 chars; flags = sig + minor*2)
 *   pitchax = p + center1 + x2 + y2             (6 chars)
 *   wayshome = w + flags1 + key1 + x2 + y2 + steps (7 + n chars; flags = out + noLegend*2;
 *             key = pitch class, or 'c' functional; step = dirBit*4 + cadence index)
 *   roads   = r + center1 + show1 + x2 + y2     (7 chars; show 0 both / 1 in / 2 out)
 *   tonnetz = t + flags1 + centre1 + triad1 + x2 + y2 (8 chars; flags = chordNames + legend*2,
 *             other bits reserved; triad = base36(root*2 + minor), or 'z' = none)
 *   section = f + x2 + y2 + w2 + h2 + escapedName (9+ chars; name may be empty)
 *
 * v2 vs v1: pitched elements encode only the pitch class (pc1, 1 char) — the
 * octave is always 3 in the app, so storing it wasted a character. Positions
 * quantize to a 24px grid (v1 used 16px) and elements are joined by '-' instead
 * of ',', so escapeName also escapes '-'. Positions are normalized per page
 * (min → 0), 2 base36 chars each. Images and stubs are not serialized.
 *
 * REGISTRIES ARE APPEND-ONLY: existing indices must never change or old links
 * break. Add new scales/qualities at the end only.
 */
const SCALE_REGISTRY = [
  'major', 'minor', 'melodicMinor', 'harmonicMinor', 'harmonicMajor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'pentatonicMajor', 'pentatonicMinor', 'bluesMajor', 'bluesMinor',
  'phrygianDominant', 'halfWholeDiminished', 'altered', 'mixolydianFlat6',
  'dominantBebop', 'majorBebop', 'minorBebop', 'chromatic',
  'wholeHalfDiminished',
];

const CHORD_REGISTRY = [
  'maj', 'min', 'dim', 'aug', 'sus2', 'sus4',
  'maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6',
  '9', 'm9', '11', '13',
  'maj7s11', '7b9', '7s9', '7s11', '7b13',
];

const V2 = 'v2:';
const V1 = 'v1:';
const BUCKET_V2 = 24;
const BUCKET_V1 = 16;
const DEFAULT_OCTAVE = 3;
const MAX_WALK = 12;
const ROADS_SHOW = ['both', 'in', 'out'] as const;

export interface DocSnapshot {
  pages: readonly Page[];
  activePageId: string;
}

export interface DecodedDoc {
  pages: Page[];
  activePageId: string;
}

const b36 = (n: number, width: number) =>
  Math.max(0, Math.round(n)).toString(36).padStart(width, '0');

// encodeURIComponent already escapes ',' / ';' etc.; '~' and '-' are separators
// it leaves alone, so escape them explicitly so names can't break parsing.
const escapeName = (name: string) =>
  encodeURIComponent(name).replace(/~/g, '%7E').replace(/-/g, '%2D');

const pcCode = (root: NoteName) => b36(NOTE_NAMES.indexOf(root), 1);

// v1 root: (octave-1)*12 + pitchClass packed in 2 base36 chars.
const parseRootV1 = (code: string): { root: NoteName; octave: number } | null => {
  const v = parseInt(code, 36);
  if (Number.isNaN(v) || v < 0 || v >= 96) return null;
  return { root: NOTE_NAMES[v % 12], octave: Math.floor(v / 12) + 1 };
};

const parsePc = (code: string): NoteName | null => {
  const v = parseInt(code, 36);
  if (Number.isNaN(v) || v < 0 || v >= 12) return null;
  return NOTE_NAMES[v];
};

export function encodeDoc(doc: DocSnapshot): string {
  const activeIdx = Math.max(0, doc.pages.findIndex((p) => p.id === doc.activePageId));
  const pages = doc.pages.map((page) => {
    const serializable = page.elements.filter(
      (
        e,
      ): e is Extract<
        CanvasElement,
        { kind: 'scale' | 'chord' | 'harmony' | 'circle' | 'pitchaxis' | 'wayshome' | 'roads' | 'tonnetz' | 'section' }
      > =>
        e.kind === 'scale' ||
        e.kind === 'chord' ||
        e.kind === 'harmony' ||
        e.kind === 'circle' ||
        e.kind === 'pitchaxis' ||
        e.kind === 'wayshome' ||
        e.kind === 'roads' ||
        e.kind === 'tonnetz' ||
        e.kind === 'section',
    );
    const minX = Math.min(...serializable.map((e) => e.x), 0);
    const minY = Math.min(...serializable.map((e) => e.y), 0);
    const els = [...serializable]
      .sort((a, b) => a.y - b.y || a.x - b.x) // top-to-bottom, then left-to-right
      .map((e) => {
        const x = b36(Math.min(1295, (e.x - minX) / BUCKET_V2), 2);
        const y = b36(Math.min(1295, (e.y - minY) / BUCKET_V2), 2);
        if (e.kind === 'section') {
          const w = b36(Math.min(1295, e.width / BUCKET_V2), 2);
          const h = b36(Math.min(1295, e.height / BUCKET_V2), 2);
          return `f${x}${y}${w}${h}${escapeName(e.name)}`;
        }
        if (e.kind === 'circle') {
          const flags = (e.showSignatures ? 1 : 0) + (e.showRelativeMinor ? 2 : 0);
          return `o${b36(NOTE_NAMES.indexOf(e.centerKey), 1)}${b36(flags, 1)}${x}${y}`;
        }
        if (e.kind === 'pitchaxis') {
          return `p${b36(NOTE_NAMES.indexOf(e.centerKey), 1)}${x}${y}`;
        }
        if (e.kind === 'tonnetz') {
          const triad = e.triad ? b36(e.triad.root * 2 + (e.triad.minor ? 1 : 0), 1) : 'z';
          const flags = (e.showChords ? 1 : 0) + (e.showLegend ? 2 : 0);
          return `t${b36(flags, 1)}${b36(e.centre, 1)}${triad}${x}${y}`;
        }
        if (e.kind === 'roads') {
          return `r${b36(NOTE_NAMES.indexOf(e.centerKey), 1)}${ROADS_SHOW.indexOf(e.show)}${x}${y}`;
        }
        if (e.kind === 'wayshome') {
          const key = e.key ? b36(NOTE_NAMES.indexOf(e.key), 1) : 'c';
          const steps = e.walk
            .slice(0, MAX_WALK)
            .map((st) => b36((st.dir === 'out' ? 4 : 0) + CADENCE_TYPES.indexOf(st.type), 1))
            .join('');
          const flags = (e.dir === 'out' ? 1 : 0) + (e.showLegend ? 0 : 2);
          return `w${flags}${key}${x}${y}${steps}`;
        }
        if (e.kind === 'scale') {
          return `s${pcCode(e.root)}${b36(SCALE_REGISTRY.indexOf(e.scaleId), 1)}${x}${y}`;
        }
        if (e.kind === 'harmony') {
          const sevenths = e.showSevenths ? '1' : '';
          return `h${pcCode(e.root)}${b36(SCALE_REGISTRY.indexOf(e.scaleId), 1)}${x}${y}${sevenths}`;
        }
        const pack = b36(e.inversion * 2 + (e.seventh ? 1 : 0), 1);
        return `c${pcCode(e.root)}${b36(CHORD_REGISTRY.indexOf(e.quality), 1)}${pack}${x}${y}`;
      });
    return `${escapeName(page.name)}~${els.join('-')}`;
  });
  return `${V2}${activeIdx.toString(36)};${pages.join(';')}`;
}

let decodeSeq = 0;
const freshId = () => `u${(++decodeSeq).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function decodeDoc(encoded: string): DecodedDoc | null {
  if (encoded.startsWith(V2)) return decodeV2(encoded.slice(V2.length));
  if (encoded.startsWith(V1)) return decodeV1(encoded.slice(V1.length));
  return null;
}

function decodeV2(body: string): DecodedDoc | null {
  try {
    const [activeRaw, ...pageRaws] = body.split(';');
    if (pageRaws.length === 0) return null;
    const activeIdx = parseInt(activeRaw, 36);
    if (Number.isNaN(activeIdx)) return null;

    const pages: Page[] = pageRaws.map((raw) => {
      const tilde = raw.indexOf('~');
      if (tilde < 0) throw new Error('missing page separator');
      const name = decodeURIComponent(raw.slice(0, tilde));
      const elsRaw = raw.slice(tilde + 1);
      const px = (s: string) => parseInt(s, 36) * BUCKET_V2;
      const elements: CanvasElement[] = (elsRaw === '' ? [] : elsRaw.split('-')).map((code, i) => {
        const kind = code[0];
        if (kind === 'f' && code.length >= 9) {
          return {
            id: freshId(), kind: 'section', z: i + 1,
            name: decodeURIComponent(code.slice(9)),
            x: px(code.slice(1, 3)), y: px(code.slice(3, 5)),
            width: px(code.slice(5, 7)), height: px(code.slice(7, 9)),
          };
        }
        if (kind === 'o' && code.length === 7) {
          const center = NOTE_NAMES[parseInt(code[1], 36)];
          const flags = parseInt(code[2], 36);
          if (!center || Number.isNaN(flags)) throw new Error(`bad circle: ${code}`);
          return {
            id: freshId(), kind: 'circle', z: i + 1, centerKey: center,
            showSignatures: (flags & 1) === 1,
            showRelativeMinor: (flags & 2) === 2,
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 'p' && code.length === 6) {
          const center = NOTE_NAMES[parseInt(code[1], 36)];
          if (!center) throw new Error(`bad pitch axis: ${code}`);
          return {
            id: freshId(), kind: 'pitchaxis', z: i + 1, centerKey: center,
            x: px(code.slice(2, 4)), y: px(code.slice(4, 6)),
          };
        }
        if (kind === 'r' && code.length === 7) {
          const center = parsePc(code[1]);
          const show = ROADS_SHOW[parseInt(code[2], 36)];
          if (!center || !show) throw new Error(`bad roads: ${code}`);
          return {
            id: freshId(), kind: 'roads', z: i + 1, centerKey: center, show,
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 't' && code.length === 8) {
          const flags = parseInt(code[1], 36);
          const centre = parseInt(code[2], 36);
          const tri = code[3] === 'z' ? null : parseInt(code[3], 36);
          if (Number.isNaN(flags) || !(centre >= 0 && centre < 12) || (tri !== null && !(tri >= 0 && tri < 24))) {
            throw new Error(`bad tonnetz: ${code}`);
          }
          return {
            id: freshId(), kind: 'tonnetz', z: i + 1, centre,
            triad: tri === null ? null : { root: tri >> 1, minor: (tri & 1) === 1 },
            showChords: (flags & 1) === 1,
            showLegend: (flags & 2) === 2,
            x: px(code.slice(4, 6)), y: px(code.slice(6, 8)),
          };
        }
        if (kind === 'w' && code.length >= 7 && code.length <= 7 + MAX_WALK) {
          const walk: WalkStep[] = [...code.slice(7)].map((ch) => {
            const v = parseInt(ch, 36);
            const type = CADENCE_TYPES[v % 4];
            if (Number.isNaN(v) || v > 7 || !type) throw new Error(`bad walk: ${code}`);
            return { dir: v >= 4 ? 'out' : 'in', type };
          });
          return {
            id: freshId(), kind: 'wayshome', z: i + 1, walk,
            dir: (parseInt(code[1], 36) & 1) === 1 ? 'out' : 'in',
            showLegend: (parseInt(code[1], 36) & 2) === 0,
            key: code[2] === 'c' ? null : parsePc(code[2]),
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 's' && code.length === 7) {
          const root = parsePc(code[1]);
          const scaleId = SCALE_REGISTRY[parseInt(code[2], 36)];
          if (!root || !scaleId) throw new Error(`bad scale: ${code}`);
          return {
            id: freshId(), kind: 'scale', z: i + 1, root, octave: DEFAULT_OCTAVE, scaleId,
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 'h' && (code.length === 7 || code.length === 8)) {
          const root = parsePc(code[1]);
          const scaleId = SCALE_REGISTRY[parseInt(code[2], 36)];
          if (!root || !scaleId) throw new Error(`bad harmony: ${code}`);
          return {
            id: freshId(), kind: 'harmony', z: i + 1, root, octave: DEFAULT_OCTAVE, scaleId,
            showSevenths: code[7] === '1',
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 'c' && code.length === 8) {
          const root = parsePc(code[1]);
          const quality = CHORD_REGISTRY[parseInt(code[2], 36)];
          if (!root || !quality) throw new Error(`bad chord: ${code}`);
          const pack = parseInt(code[3], 36);
          return {
            id: freshId(), kind: 'chord', z: i + 1, root, octave: DEFAULT_OCTAVE, quality,
            inversion: Math.floor(pack / 2), seventh: pack % 2 === 1,
            x: px(code.slice(4, 6)), y: px(code.slice(6, 8)),
          };
        }
        throw new Error(`bad element: ${code}`);
      });
      return { id: freshId(), name, elements };
    });

    return { pages, activePageId: pages[Math.min(activeIdx, pages.length - 1)].id };
  } catch {
    return null;
  }
}

/** Legacy v1 decoder — frozen so links shared before v2 keep resolving. */
function decodeV1(body: string): DecodedDoc | null {
  try {
    const [activeRaw, ...pageRaws] = body.split(';');
    if (pageRaws.length === 0) return null;
    const activeIdx = parseInt(activeRaw, 36);
    if (Number.isNaN(activeIdx)) return null;

    const pages: Page[] = pageRaws.map((raw) => {
      const tilde = raw.indexOf('~');
      if (tilde < 0) throw new Error('missing page separator');
      const name = decodeURIComponent(raw.slice(0, tilde));
      const elsRaw = raw.slice(tilde + 1);
      const px = (s: string) => parseInt(s, 36) * BUCKET_V1;
      const elements: CanvasElement[] = (elsRaw === '' ? [] : elsRaw.split(',')).map((code, i) => {
        const kind = code[0];
        if (kind === 'f' && code.length >= 9) {
          return {
            id: freshId(), kind: 'section', z: i + 1,
            name: decodeURIComponent(code.slice(9)),
            x: px(code.slice(1, 3)), y: px(code.slice(3, 5)),
            width: px(code.slice(5, 7)), height: px(code.slice(7, 9)),
          };
        }
        if (kind === 'o' && code.length === 7) {
          const center = NOTE_NAMES[parseInt(code[1], 36)];
          const flags = parseInt(code[2], 36);
          if (!center || Number.isNaN(flags)) throw new Error(`bad circle: ${code}`);
          return {
            id: freshId(), kind: 'circle', z: i + 1, centerKey: center,
            showSignatures: (flags & 1) === 1,
            showRelativeMinor: (flags & 2) === 2,
            x: px(code.slice(3, 5)), y: px(code.slice(5, 7)),
          };
        }
        if (kind === 'p' && code.length === 6) {
          const center = NOTE_NAMES[parseInt(code[1], 36)];
          if (!center) throw new Error(`bad pitch axis: ${code}`);
          return {
            id: freshId(), kind: 'pitchaxis', z: i + 1, centerKey: center,
            x: px(code.slice(2, 4)), y: px(code.slice(4, 6)),
          };
        }
        const rootParsed = parseRootV1(code.slice(1, 3));
        if (!rootParsed) throw new Error(`bad root: ${code}`);
        const { root, octave } = rootParsed;
        if (kind === 's' && code.length === 8) {
          const scaleId = SCALE_REGISTRY[parseInt(code[3], 36)];
          if (!scaleId) throw new Error(`bad scale: ${code}`);
          return {
            id: freshId(), kind: 'scale', z: i + 1, root, octave, scaleId,
            x: px(code.slice(4, 6)), y: px(code.slice(6, 8)),
          };
        }
        if (kind === 'h' && (code.length === 8 || code.length === 9)) {
          const scaleId = SCALE_REGISTRY[parseInt(code[3], 36)];
          if (!scaleId) throw new Error(`bad harmony: ${code}`);
          return {
            id: freshId(), kind: 'harmony', z: i + 1, root, octave, scaleId,
            showSevenths: code[8] === '1',
            x: px(code.slice(4, 6)), y: px(code.slice(6, 8)),
          };
        }
        if (kind === 'c' && code.length === 9) {
          const quality = CHORD_REGISTRY[parseInt(code[3], 36)];
          if (!quality) throw new Error(`bad chord: ${code}`);
          const pack = parseInt(code[4], 36);
          return {
            id: freshId(), kind: 'chord', z: i + 1, root, octave, quality,
            inversion: Math.floor(pack / 2), seventh: pack % 2 === 1,
            x: px(code.slice(5, 7)), y: px(code.slice(7, 9)),
          };
        }
        throw new Error(`bad element: ${code}`);
      });
      return { id: freshId(), name, elements };
    });

    return { pages, activePageId: pages[Math.min(activeIdx, pages.length - 1)].id };
  } catch {
    return null;
  }
}
