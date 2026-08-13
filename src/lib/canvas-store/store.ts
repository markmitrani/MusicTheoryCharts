import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { NOTE_NAMES, type NoteName } from '@/lib/theory/note';
import type { CanvasElement, Page, Tool } from './types';

/** Omit that distributes over union members (plain Omit collapses the union). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Playback voice. 'pad' = the warm detuned-saw pad; 'piano' = flanged piano. */
export type SoundId = 'pad' | 'piano';

/**
 * Experimental gradient backdrop style. 'off' = none; 'perlin' = domain-warped
 * fractal-noise blobs; 'mesh' = vertical blue→gold→black ramp whose gold ridge
 * follows an equation curve across x.
 */
export type GradientMode = 'off' | 'perlin' | 'mesh';

let nextId = 0;
const newId = () => `e${(++nextId).toString(36)}${Date.now().toString(36).slice(-4)}`;

/** Session clipboard for copy/cut/paste — outside the doc, so never serialized. */
let clipboard: CanvasElement[] = [];

/** Deep-cloneable document slice that undo/redo snapshots. */
interface DocState {
  pages: Page[];
  activePageId: string;
}

export interface CanvasState extends DocState {
  selection: Set<string>;
  tool: Tool;
  /** Holding space temporarily pans; mirrors the move tool's hover suppression. */
  spacePanning: boolean;
  /** Audio + settings (panel state lives with the doc store for URL encoding later). */
  muted: boolean;
  tempoMs: number;
  sound: SoundId;
  /** Experimental: gradient backdrop style behind the canvas. */
  gradientMode: GradientMode;
  /** Experimental: harmonics wave that surges behind the canvas on playback. */
  harmonicsViz: boolean;

  activePage(): Page;
  setSpacePanning(on: boolean): void;
  setTool(tool: Tool): void;
  setMuted(muted: boolean): void;
  setTempoMs(ms: number): void;
  setSound(sound: SoundId): void;
  setGradientMode(mode: GradientMode): void;
  setHarmonicsViz(on: boolean): void;

  addElement(el: DistributiveOmit<CanvasElement, 'id' | 'z'>): string;
  /** Convert a filled-in stub to a real element in place (one undo step). */
  confirmStub(id: string): void;
  /** Drop unconfirmed stubs (click-away). Transient UI — not undoable. */
  removeUnconfirmedStubs(): void;
  updateElement(id: string, patch: Partial<CanvasElement>, opts?: { commit?: boolean }): void;
  /** Reposition several elements in one store update (section group drag). */
  moveElements(positions: Array<{ id: string; x: number; y: number }>): void;
  /** Transpose pitched elements (scale/chord/harmony) by N semitones. */
  transposeElements(ids: string[], semitones: number): void;
  removeElements(ids: string[]): void;
  duplicateSelection(): void;

  select(ids: string[]): void;
  toggleSelect(id: string): void;
  clearSelection(): void;
  selectAll(): void;

  /** Session clipboard (copy/cut/paste); not part of the doc or URL state. */
  copySelection(): void;
  cutSelection(): void;
  pasteClipboard(): void;

  bringForward(id: string): void;
  sendBackward(id: string): void;
  bringToFront(id: string): void;
  sendToBack(id: string): void;

  addPage(): string;
  removePage(id: string): void;
  renamePage(id: string, name: string): void;
  reorderPage(id: string, toIndex: number): void;
  setActivePage(id: string): void;
  clearActivePage(): void;

  undo(): void;
  redo(): void;
  /** Snapshot current doc state onto the undo stack (call before a mutation batch). */
  commit(): void;

  /** Replace the whole document (URL decode / reset). */
  loadDoc(doc: DocState): void;
}

const cloneDoc = (s: DocState): DocState => ({
  activePageId: s.activePageId,
  pages: s.pages.map((p) => ({ ...p, elements: p.elements.map((e) => ({ ...e })) })),
});

const MAX_HISTORY = 100;

export function createCanvasStore() {
  const firstPage: Page = { id: newId(), name: '', elements: [] };
  const undoStack: DocState[] = [];
  const redoStack: DocState[] = [];

  return createStore<CanvasState>((set, get) => {
    const snapshot = () => {
      undoStack.push(cloneDoc(get()));
      if (undoStack.length > MAX_HISTORY) undoStack.shift();
      redoStack.length = 0;
    };

    const mutatePage = (fn: (page: Page) => Page) =>
      set((s) => ({
        pages: s.pages.map((p) => (p.id === s.activePageId ? fn(p) : p)),
      }));

    const maxZ = (page: Page) => page.elements.reduce((m, e) => Math.max(m, e.z), 0);

    return {
      pages: [firstPage],
      activePageId: firstPage.id,
      selection: new Set<string>(),
      tool: 'select',
      spacePanning: false,
      muted: false,
      tempoMs: 180,
      sound: 'pad',
      gradientMode: 'off',
      harmonicsViz: false,

      activePage() {
        const s = get();
        return s.pages.find((p) => p.id === s.activePageId)!;
      },

      setSpacePanning: (on) => set((s) => (s.spacePanning === on ? s : { spacePanning: on })),
      setTool: (tool) => set({ tool }),
      setMuted: (muted) => set({ muted }),
      setTempoMs: (tempoMs) => set({ tempoMs }),
      setSound: (sound) => set({ sound }),
      setGradientMode: (gradientMode) => set({ gradientMode }),
      setHarmonicsViz: (harmonicsViz) => set({ harmonicsViz }),

      addElement(el) {
        snapshot();
        const id = newId();
        mutatePage((p) => ({
          ...p,
          elements: [...p.elements, { ...el, id, z: maxZ(p) + 1 } as CanvasElement],
        }));
        return id;
      },

      confirmStub(id) {
        const stub = get().activePage().elements.find((e) => e.id === id);
        if (!stub || stub.kind !== 'stub' || !stub.typeId) return;
        const [kind, typeId] = stub.typeId.split(':');
        const rootless = kind === 'circle' || kind === 'pitchaxis';
        if (!rootless && !stub.root) return; // circle / pitch axis need no root
        snapshot();
        const pos = { id: stub.id, x: stub.x, y: stub.y, z: stub.z };
        const base = { ...pos, root: stub.root!, octave: 3 };
        const real: CanvasElement =
          kind === 'circle'
            ? { ...pos, kind: 'circle', centerKey: 'C', showSignatures: false, showRelativeMinor: false }
            : kind === 'pitchaxis'
              ? { ...pos, kind: 'pitchaxis', centerKey: 'C' }
              : kind === 'chord'
                ? { ...base, kind: 'chord', quality: typeId, inversion: 0, seventh: false }
                : kind === 'harmony'
                  ? { ...base, kind: 'harmony', scaleId: typeId }
                  : { ...base, kind: 'scale', scaleId: typeId };
        mutatePage((p) => ({
          ...p,
          elements: p.elements.map((e) => (e.id === id ? real : e)),
        }));
        set({ selection: new Set([id]) });
      },

      removeUnconfirmedStubs() {
        if (!get().activePage().elements.some((e) => e.kind === 'stub')) return;
        mutatePage((p) => ({ ...p, elements: p.elements.filter((e) => e.kind !== 'stub') }));
      },

      updateElement(id, patch, opts) {
        if (opts?.commit) snapshot();
        mutatePage((p) => ({
          ...p,
          elements: p.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)),
        }));
      },

      moveElements(positions) {
        const byId = new Map(positions.map((p) => [p.id, p]));
        mutatePage((p) => ({
          ...p,
          elements: p.elements.map((e) => {
            const m = byId.get(e.id);
            return m ? { ...e, x: m.x, y: m.y } : e;
          }),
        }));
      },

      transposeElements(ids, semitones) {
        const set = new Set(ids);
        const pitched = (e: CanvasElement) =>
          e.kind === 'scale' || e.kind === 'chord' || e.kind === 'harmony';
        const targets = get().activePage().elements.filter((e) => set.has(e.id) && pitched(e));
        if (targets.length === 0) return;
        snapshot();
        // Pitch-class transpose: only the root note name changes; the octave
        // (the register where notes are drawn AND sounded) stays fixed, so a
        // chord can never climb out of the displayable / audible band.
        mutatePage((p) => ({
          ...p,
          elements: p.elements.map((e) => {
            if (!set.has(e.id) || !pitched(e)) return e;
            const i = NOTE_NAMES.indexOf((e as { root: NoteName }).root);
            const next = NOTE_NAMES[(((i + semitones) % 12) + 12) % 12];
            return { ...e, root: next };
          }),
        }));
      },

      removeElements(ids) {
        if (ids.length === 0) return;
        snapshot();
        const drop = new Set(ids);
        mutatePage((p) => ({ ...p, elements: p.elements.filter((e) => !drop.has(e.id)) }));
        set((s) => ({ selection: new Set([...s.selection].filter((x) => !drop.has(x))) }));
      },

      duplicateSelection() {
        const s = get();
        if (s.selection.size === 0) return;
        snapshot();
        const fresh: string[] = [];
        mutatePage((p) => {
          let z = maxZ(p);
          const copies = p.elements
            .filter((e) => s.selection.has(e.id))
            .map((e) => {
              const id = newId();
              fresh.push(id);
              return { ...e, id, x: e.x + 24, y: e.y + 24, z: ++z };
            });
          return { ...p, elements: [...p.elements, ...copies] };
        });
        set({ selection: new Set(fresh) });
      },

      select: (ids) => set({ selection: new Set(ids) }),
      toggleSelect(id) {
        set((s) => {
          const selection = new Set(s.selection);
          if (selection.has(id)) selection.delete(id);
          else selection.add(id);
          return { selection };
        });
      },
      clearSelection: () => set({ selection: new Set() }),
      selectAll() {
        const ids = get()
          .activePage()
          .elements.filter((e) => e.kind !== 'stub')
          .map((e) => e.id);
        set({ selection: new Set(ids) });
      },

      copySelection() {
        const s = get();
        clipboard = s
          .activePage()
          .elements.filter((e) => s.selection.has(e.id) && e.kind !== 'stub')
          .map((e) => structuredClone(e));
      },

      cutSelection() {
        const s = get();
        if (s.selection.size === 0) return;
        s.copySelection();
        s.removeElements([...s.selection]);
      },

      pasteClipboard() {
        if (clipboard.length === 0) return;
        snapshot();
        const fresh: string[] = [];
        mutatePage((p) => {
          let z = maxZ(p);
          const copies = clipboard.map((e) => {
            const id = newId();
            fresh.push(id);
            return { ...structuredClone(e), id, x: e.x + 28, y: e.y + 28, z: ++z };
          });
          return { ...p, elements: [...p.elements, ...copies] };
        });
        // Cascade subsequent pastes so they don't stack on each other.
        clipboard = clipboard.map((e) => ({ ...e, x: e.x + 28, y: e.y + 28 }));
        set({ selection: new Set(fresh) });
      },

      bringForward(id) {
        snapshot();
        mutatePage((p) => {
          const sorted = [...p.elements].sort((a, b) => a.z - b.z);
          const i = sorted.findIndex((e) => e.id === id);
          if (i < 0 || i === sorted.length - 1) return p;
          const a = sorted[i].z;
          sorted[i] = { ...sorted[i], z: sorted[i + 1].z };
          sorted[i + 1] = { ...sorted[i + 1], z: a };
          return { ...p, elements: sorted };
        });
      },

      sendBackward(id) {
        snapshot();
        mutatePage((p) => {
          const sorted = [...p.elements].sort((a, b) => a.z - b.z);
          const i = sorted.findIndex((e) => e.id === id);
          if (i <= 0) return p;
          const a = sorted[i].z;
          sorted[i] = { ...sorted[i], z: sorted[i - 1].z };
          sorted[i - 1] = { ...sorted[i - 1], z: a };
          return { ...p, elements: sorted };
        });
      },

      bringToFront(id) {
        snapshot();
        mutatePage((p) => {
          const max = p.elements.reduce((m, e) => Math.max(m, e.z), 0);
          const target = p.elements.find((e) => e.id === id);
          if (!target || target.z === max) return p;
          return { ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, z: max + 1 } : e)) };
        });
      },

      sendToBack(id) {
        snapshot();
        mutatePage((p) => {
          const min = p.elements.reduce((m, e) => Math.min(m, e.z), 0);
          const target = p.elements.find((e) => e.id === id);
          if (!target || target.z === min) return p;
          return { ...p, elements: p.elements.map((e) => (e.id === id ? { ...e, z: min - 1 } : e)) };
        });
      },

      addPage() {
        snapshot();
        const page: Page = { id: newId(), name: '', elements: [] };
        set((s) => ({ pages: [...s.pages, page], activePageId: page.id, selection: new Set() }));
        return page.id;
      },

      removePage(id) {
        const s = get();
        if (s.pages.length <= 1) return;
        snapshot();
        const idx = s.pages.findIndex((p) => p.id === id);
        const pages = s.pages.filter((p) => p.id !== id);
        const activePageId =
          s.activePageId === id ? pages[Math.max(0, idx - 1)].id : s.activePageId;
        set({ pages, activePageId, selection: new Set() });
      },

      renamePage(id, name) {
        snapshot();
        set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, name } : p)) }));
      },

      reorderPage(id, toIndex) {
        snapshot();
        set((s) => {
          const pages = [...s.pages];
          const from = pages.findIndex((p) => p.id === id);
          if (from < 0) return s;
          const [page] = pages.splice(from, 1);
          pages.splice(Math.max(0, Math.min(toIndex, pages.length)), 0, page);
          return { pages };
        });
      },

      setActivePage: (id) => set({ activePageId: id, selection: new Set() }),

      clearActivePage() {
        snapshot();
        mutatePage((p) => ({ ...p, elements: [] }));
        set({ selection: new Set() });
      },

      undo() {
        const prev = undoStack.pop();
        if (!prev) return;
        redoStack.push(cloneDoc(get()));
        set({ ...prev, selection: new Set() });
      },

      redo() {
        const next = redoStack.pop();
        if (!next) return;
        undoStack.push(cloneDoc(get()));
        set({ ...next, selection: new Set() });
      },

      commit: snapshot,

      loadDoc(doc) {
        undoStack.length = 0;
        redoStack.length = 0;
        set({ ...cloneDoc(doc), selection: new Set() });
      },
    };
  });
}

/** Singleton store for the app (tests create their own via createCanvasStore). */
export const canvasStore = createCanvasStore();

declare global {
  interface Window {
    __canvasStore?: typeof canvasStore;
  }
}
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.__canvasStore = canvasStore;
}

export function useCanvas<T>(selector: (s: CanvasState) => T): T {
  return useStore(canvasStore, selector);
}
