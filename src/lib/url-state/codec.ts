import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import type { CanvasElement, Page } from '@/lib/canvas-store/types';

/**
 * v1 compact URL codec (check-in 4 approved format):
 *
 *   v1:<activeIdx>;<page>;<page>...
 *   page    = <escapedName>~<el>,<el>...
 *   scale   = s + root2 + type1 + x2 + y2            (8 chars)
 *   harmony = h + root2 + type1 + x2 + y2            (8 chars; type indexes SCALE_REGISTRY)
 *   chord   = c + root2 + type1 + pack1 + x2 + y2    (9 chars; pack = inv*2+seventh)
 *   circle  = o + center1 + flags1 + x2 + y2         (7 chars; flags = sig + minor*2)
 *   section = f + x2 + y2 + w2 + h2 + escapedName    (9+ chars; name may be empty)
 *
 * root2 encodes (octave-1)*12 + pitchClass in 2 base36 chars. Positions are
 * normalized per page (min → 0) and quantized to 16px buckets, 2 base36
 * chars each. Images and stubs are not URL-serializable and are skipped.
 *
 * REGISTRIES ARE APPEND-ONLY: existing indices must never change or old
 * links break. Add new scales/qualities at the end only.
 */
const SCALE_REGISTRY = [
  'major', 'minor', 'melodicMinor', 'harmonicMinor', 'harmonicMajor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian',
  'pentatonicMajor', 'pentatonicMinor', 'bluesMajor', 'bluesMinor',
  'phrygianDominant', 'halfWholeDiminished', 'altered', 'mixolydianFlat6',
  'dominantBebop', 'majorBebop', 'minorBebop', 'chromatic',
];

const CHORD_REGISTRY = [
  'maj', 'min', 'dim', 'aug', 'sus2', 'sus4',
  'maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6',
  '9', 'm9', '11', '13',
  'maj7s11', '7b9', '7s9', '7s11', '7b13',
];

const VERSION = 'v1:';
const BUCKET = 16;

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

const escapeName = (name: string) =>
  encodeURIComponent(name).replace(/~/g, '%7E'); // encodeURIComponent leaves ~ alone

const rootCode = (root: NoteName, octave: number) =>
  b36((octave - 1) * 12 + NOTE_NAMES.indexOf(root), 2);

const parseRoot = (code: string): { root: NoteName; octave: number } | null => {
  const v = parseInt(code, 36);
  if (Number.isNaN(v) || v < 0 || v >= 96) return null;
  return { root: NOTE_NAMES[v % 12], octave: Math.floor(v / 12) + 1 };
};

export function encodeDoc(doc: DocSnapshot): string {
  const activeIdx = Math.max(0, doc.pages.findIndex((p) => p.id === doc.activePageId));
  const pages = doc.pages.map((page) => {
    const serializable = page.elements.filter(
      (e): e is Extract<CanvasElement, { kind: 'scale' | 'chord' | 'harmony' | 'circle' | 'section' }> =>
        e.kind === 'scale' ||
        e.kind === 'chord' ||
        e.kind === 'harmony' ||
        e.kind === 'circle' ||
        e.kind === 'section',
    );
    const minX = Math.min(...serializable.map((e) => e.x), 0);
    const minY = Math.min(...serializable.map((e) => e.y), 0);
    const els = [...serializable]
      .sort((a, b) => a.y - b.y || a.x - b.x) // top-to-bottom, then left-to-right
      .map((e) => {
        const x = b36(Math.min(1295, (e.x - minX) / BUCKET), 2);
        const y = b36(Math.min(1295, (e.y - minY) / BUCKET), 2);
        if (e.kind === 'section') {
          const w = b36(Math.min(1295, e.width / BUCKET), 2);
          const h = b36(Math.min(1295, e.height / BUCKET), 2);
          return `f${x}${y}${w}${h}${escapeName(e.name)}`;
        }
        if (e.kind === 'circle') {
          const flags = (e.showSignatures ? 1 : 0) + (e.showRelativeMinor ? 2 : 0);
          return `o${b36(NOTE_NAMES.indexOf(e.centerKey), 1)}${b36(flags, 1)}${x}${y}`;
        }
        if (e.kind === 'scale' || e.kind === 'harmony') {
          const kindChar = e.kind === 'scale' ? 's' : 'h';
          return `${kindChar}${rootCode(e.root, e.octave)}${b36(SCALE_REGISTRY.indexOf(e.scaleId), 1)}${x}${y}`;
        }
        const pack = b36(e.inversion * 2 + (e.seventh ? 1 : 0), 1);
        return `c${rootCode(e.root, e.octave)}${b36(CHORD_REGISTRY.indexOf(e.quality), 1)}${pack}${x}${y}`;
      });
    return `${escapeName(page.name)}~${els.join(',')}`;
  });
  return `${VERSION}${activeIdx.toString(36)};${pages.join(';')}`;
}

let decodeSeq = 0;
const freshId = () => `u${(++decodeSeq).toString(36)}${Date.now().toString(36).slice(-3)}`;

export function decodeDoc(encoded: string): DecodedDoc | null {
  if (!encoded.startsWith(VERSION)) return null;
  try {
    const [activeRaw, ...pageRaws] = encoded.slice(VERSION.length).split(';');
    if (pageRaws.length === 0) return null;
    const activeIdx = parseInt(activeRaw, 36);
    if (Number.isNaN(activeIdx)) return null;

    const pages: Page[] = pageRaws.map((raw) => {
      const tilde = raw.indexOf('~');
      if (tilde < 0) throw new Error('missing page separator');
      const name = decodeURIComponent(raw.slice(0, tilde));
      const elsRaw = raw.slice(tilde + 1);
      const elements: CanvasElement[] = (elsRaw === '' ? [] : elsRaw.split(',')).map((code, i) => {
        const kind = code[0];
        if (kind === 'f' && code.length >= 9) {
          return {
            id: freshId(), kind: 'section', z: i + 1,
            name: decodeURIComponent(code.slice(9)),
            x: parseInt(code.slice(1, 3), 36) * BUCKET,
            y: parseInt(code.slice(3, 5), 36) * BUCKET,
            width: parseInt(code.slice(5, 7), 36) * BUCKET,
            height: parseInt(code.slice(7, 9), 36) * BUCKET,
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
            x: parseInt(code.slice(3, 5), 36) * BUCKET,
            y: parseInt(code.slice(5, 7), 36) * BUCKET,
          };
        }
        const rootParsed = parseRoot(code.slice(1, 3));
        if (!rootParsed) throw new Error(`bad root: ${code}`);
        const { root, octave } = rootParsed;
        if ((kind === 's' || kind === 'h') && code.length === 8) {
          const scaleId = SCALE_REGISTRY[parseInt(code[3], 36)];
          if (!scaleId) throw new Error(`bad scale: ${code}`);
          return {
            id: freshId(), kind: kind === 's' ? 'scale' : 'harmony', z: i + 1, root, octave, scaleId,
            x: parseInt(code.slice(4, 6), 36) * BUCKET,
            y: parseInt(code.slice(6, 8), 36) * BUCKET,
          };
        }
        if (kind === 'c' && code.length === 9) {
          const quality = CHORD_REGISTRY[parseInt(code[3], 36)];
          if (!quality) throw new Error(`bad chord: ${code}`);
          const pack = parseInt(code[4], 36);
          return {
            id: freshId(), kind: 'chord', z: i + 1, root, octave, quality,
            inversion: Math.floor(pack / 2), seventh: pack % 2 === 1,
            x: parseInt(code.slice(5, 7), 36) * BUCKET,
            y: parseInt(code.slice(7, 9), 36) * BUCKET,
          };
        }
        throw new Error(`bad element: ${code}`);
      });
      return { id: freshId(), name, elements };
    });

    return {
      pages,
      activePageId: pages[Math.min(activeIdx, pages.length - 1)].id,
    };
  } catch {
    return null;
  }
}
