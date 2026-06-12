import { describe, it, expect, beforeEach } from 'vitest';
import { createCanvasStore } from './store';
import type { ChordElement } from './types';

function chord(partial: Partial<ChordElement> = {}): Omit<ChordElement, 'id' | 'z'> {
  return {
    kind: 'chord',
    x: 100,
    y: 100,
    root: 'G',
    octave: 3,
    quality: 'maj7',
    inversion: 0,
    seventh: false,
    ...partial,
  };
}

describe('canvas store', () => {
  let store: ReturnType<typeof createCanvasStore>;
  beforeEach(() => {
    store = createCanvasStore();
  });

  it('starts with one untitled page', () => {
    const s = store.getState();
    expect(s.pages.length).toBe(1);
    expect(s.activePageId).toBe(s.pages[0].id);
  });

  it('adds and removes elements on the active page', () => {
    const id = store.getState().addElement(chord());
    expect(store.getState().activePage().elements.length).toBe(1);
    store.getState().removeElements([id]);
    expect(store.getState().activePage().elements.length).toBe(0);
  });

  it('selection: replace, toggle, clear', () => {
    const a = store.getState().addElement(chord());
    const b = store.getState().addElement(chord({ x: 300 }));
    store.getState().select([a]);
    store.getState().toggleSelect(b);
    expect(store.getState().selection).toEqual(new Set([a, b]));
    store.getState().toggleSelect(a);
    expect(store.getState().selection).toEqual(new Set([b]));
    store.getState().clearSelection();
    expect(store.getState().selection.size).toBe(0);
  });

  it('undo/redo round-trips element addition', () => {
    const id = store.getState().addElement(chord());
    store.getState().undo();
    expect(store.getState().activePage().elements.length).toBe(0);
    store.getState().redo();
    expect(store.getState().activePage().elements.length).toBe(1);
    expect(store.getState().activePage().elements[0].id).toBe(id);
  });

  it('updateElement is undoable when committed', () => {
    const id = store.getState().addElement(chord());
    store.getState().updateElement(id, { x: 500 }, { commit: true });
    store.getState().undo();
    expect(store.getState().activePage().elements[0].x).toBe(100);
  });

  it('pages: add, rename, never below one', () => {
    const p2 = store.getState().addPage();
    expect(store.getState().pages.length).toBe(2);
    expect(store.getState().activePageId).toBe(p2);
    store.getState().renamePage(p2, 'Voicings');
    expect(store.getState().pages[1].name).toBe('Voicings');
    store.getState().removePage(p2);
    expect(store.getState().pages.length).toBe(1);
    store.getState().removePage(store.getState().pages[0].id);
    expect(store.getState().pages.length).toBe(1); // refuses to delete the last page
  });

  it('z-order: bring forward / send backward swap neighbors', () => {
    const a = store.getState().addElement(chord());
    const b = store.getState().addElement(chord({ x: 300 }));
    const zOf = (id: string) => store.getState().activePage().elements.find((e) => e.id === id)!.z;
    expect(zOf(b)).toBeGreaterThan(zOf(a));
    store.getState().bringForward(a);
    expect(zOf(a)).toBeGreaterThan(zOf(b));
    store.getState().sendBackward(a);
    expect(zOf(a)).toBeLessThan(zOf(b));
  });

  it('duplicates selected elements with an offset', () => {
    const a = store.getState().addElement(chord());
    store.getState().select([a]);
    store.getState().duplicateSelection();
    const els = store.getState().activePage().elements;
    expect(els.length).toBe(2);
    expect(els[1].x).toBe(els[0].x + 24);
    expect(store.getState().selection.has(els[1].id)).toBe(true);
  });
});
