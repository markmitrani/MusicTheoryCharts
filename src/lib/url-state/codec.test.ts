import { describe, it, expect } from 'vitest';
import { encodeDoc, decodeDoc } from './codec';
import type { Page } from '@/lib/canvas-store/types';

const page = (name: string, elements: Page['elements']): Page => ({
  id: `p-${name || 'untitled'}`,
  name,
  elements,
});

describe('url codec', () => {
  it('round-trips pages, names, chords, and scales', () => {
    const doc = {
      activePageId: 'p-Voicings',
      pages: [
        page('Voicings', [
          { id: 'a', kind: 'chord', x: 100, y: 200, z: 1, root: 'G', octave: 3, quality: 'maj7', inversion: 1, seventh: false },
          { id: 'b', kind: 'scale', x: 500, y: 200, z: 2, root: 'F', octave: 3, scaleId: 'lydian' },
        ]),
        page('', [
          { id: 'c', kind: 'chord', x: 0, y: 0, z: 1, root: 'C', octave: 4, quality: '7b9', inversion: 0, seventh: true },
        ]),
      ],
    } as const;

    const encoded = encodeDoc(doc);
    expect(encoded.startsWith('v1:')).toBe(true);

    const decoded = decodeDoc(encoded)!;
    expect(decoded.pages.length).toBe(2);
    expect(decoded.pages[0].name).toBe('Voicings');
    expect(decoded.activePageId).toBe(decoded.pages[0].id);

    const [chord, scale] = decoded.pages[0].elements;
    expect(chord).toMatchObject({ kind: 'chord', root: 'G', octave: 3, quality: 'maj7', inversion: 1, seventh: false });
    expect(scale).toMatchObject({ kind: 'scale', root: 'F', octave: 3, scaleId: 'lydian' });
    expect(decoded.pages[1].elements[0]).toMatchObject({ kind: 'chord', quality: '7b9', seventh: true });
  });

  it('preserves relative position within a 16px bucket', () => {
    const doc = {
      activePageId: 'p-x',
      pages: [
        page('x', [
          { id: 'a', kind: 'scale', x: 320, y: 64, z: 1, root: 'C', octave: 3, scaleId: 'major' },
          { id: 'b', kind: 'scale', x: 800, y: 480, z: 2, root: 'D', octave: 3, scaleId: 'dorian' },
        ]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    const [a, b] = decoded.pages[0].elements;
    // offsets are normalized per page; deltas survive within bucket precision
    expect(Math.abs(b.x - a.x - 480)).toBeLessThanOrEqual(16);
    expect(Math.abs(b.y - a.y - 416)).toBeLessThanOrEqual(16);
  });

  it('escapes separator characters in page names', () => {
    const doc = {
      activePageId: 'p-weird',
      pages: [page('a~b;c,d:e', [])],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    expect(decoded.pages[0].name).toBe('a~b;c,d:e');
  });

  it('round-trips harmony elements', () => {
    const doc = {
      activePageId: 'p-h',
      pages: [
        page('h', [
          { id: 'a', kind: 'harmony', x: 32, y: 32, z: 1, root: 'D', octave: 3, scaleId: 'dorian' },
        ]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    expect(decoded.pages[0].elements[0]).toMatchObject({
      kind: 'harmony', root: 'D', octave: 3, scaleId: 'dorian',
    });
  });

  it('round-trips circle of fifths with center and flags', () => {
    const doc = {
      activePageId: 'p-c',
      pages: [
        page('c', [
          { id: 'a', kind: 'circle', x: 16, y: 16, z: 1, centerKey: 'A#', showSignatures: true, showRelativeMinor: false },
        ]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    expect(decoded.pages[0].elements[0]).toMatchObject({
      kind: 'circle', centerKey: 'A#', showSignatures: true, showRelativeMinor: false,
    });
  });

  it('round-trips a pitch axis with its center key', () => {
    const doc = {
      activePageId: 'p-pa',
      pages: [
        page('pa', [{ id: 'a', kind: 'pitchaxis', x: 48, y: 16, z: 1, centerKey: 'C' }]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    expect(decoded.pages[0].elements[0]).toMatchObject({ kind: 'pitchaxis', centerKey: 'C' });
  });

  it('round-trips sections with names and dimensions', () => {
    const doc = {
      activePageId: 'p-s',
      pages: [
        page('s', [
          { id: 'a', kind: 'section', x: 64, y: 32, z: 1, name: 'ii–V–I drills', width: 800, height: 480 },
          { id: 'b', kind: 'scale', x: 100, y: 100, z: 2, root: 'C', octave: 3, scaleId: 'major' },
        ]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    const section = decoded.pages[0].elements.find((e) => e.kind === 'section')!;
    expect(section).toMatchObject({ kind: 'section', name: 'ii–V–I drills', width: 800, height: 480 });
  });

  it('skips images and stubs', () => {
    const doc = {
      activePageId: 'p-m',
      pages: [
        page('m', [
          { id: 'a', kind: 'image', x: 0, y: 0, z: 1, src: 'blob:x', width: 300, aspectRatio: 1.5 },
          { id: 'b', kind: 'stub', x: 0, y: 0, z: 2, root: null, typeId: null },
          { id: 'c', kind: 'scale', x: 0, y: 0, z: 3, root: 'A', octave: 3, scaleId: 'minorBebop' },
        ]),
      ],
    } as const;
    const decoded = decodeDoc(encodeDoc(doc))!;
    expect(decoded.pages[0].elements.length).toBe(1);
    expect(decoded.pages[0].elements[0]).toMatchObject({ kind: 'scale', scaleId: 'minorBebop' });
  });

  it('rejects unknown versions and garbage', () => {
    expect(decodeDoc('v9:whatever')).toBeNull();
    expect(decodeDoc('not-a-doc')).toBeNull();
    expect(decodeDoc('v1:!!;;~~corrupt,,xx')).toBeNull();
  });
});
