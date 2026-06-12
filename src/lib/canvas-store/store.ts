import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { CanvasElement, Page, Tool } from './types';

/** Omit that distributes over union members (plain Omit collapses the union). */
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

let nextId = 0;
const newId = () => `e${(++nextId).toString(36)}${Date.now().toString(36).slice(-4)}`;

/** Deep-cloneable document slice that undo/redo snapshots. */
interface DocState {
  pages: Page[];
  activePageId: string;
}

export interface CanvasState extends DocState {
  selection: Set<string>;
  tool: Tool;
  /** Audio + settings (panel state lives with the doc store for URL encoding later). */
  muted: boolean;
  tempoMs: number;

  activePage(): Page;
  setTool(tool: Tool): void;
  setMuted(muted: boolean): void;
  setTempoMs(ms: number): void;

  addElement(el: DistributiveOmit<CanvasElement, 'id' | 'z'>): string;
  updateElement(id: string, patch: Partial<CanvasElement>, opts?: { commit?: boolean }): void;
  removeElements(ids: string[]): void;
  duplicateSelection(): void;

  select(ids: string[]): void;
  toggleSelect(id: string): void;
  clearSelection(): void;

  bringForward(id: string): void;
  sendBackward(id: string): void;

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
      muted: false,
      tempoMs: 180,

      activePage() {
        const s = get();
        return s.pages.find((p) => p.id === s.activePageId)!;
      },

      setTool: (tool) => set({ tool }),
      setMuted: (muted) => set({ muted }),
      setTempoMs: (tempoMs) => set({ tempoMs }),

      addElement(el) {
        snapshot();
        const id = newId();
        mutatePage((p) => ({
          ...p,
          elements: [...p.elements, { ...el, id, z: maxZ(p) + 1 } as CanvasElement],
        }));
        return id;
      },

      updateElement(id, patch, opts) {
        if (opts?.commit) snapshot();
        mutatePage((p) => ({
          ...p,
          elements: p.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as CanvasElement) : e)),
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

export function useCanvas<T>(selector: (s: CanvasState) => T): T {
  return useStore(canvasStore, selector);
}
