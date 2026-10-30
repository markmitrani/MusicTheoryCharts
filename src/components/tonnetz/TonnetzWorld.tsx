'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { NOTE_NAMES } from '@/lib/theory/note';
import { MOVES, moveLabel, sameTriad, triadName, type ArrowDir, type Move } from '@/lib/theory/tonnetz';
import { canvasStore } from '@/lib/canvas-store/store';
import type { TonnetzElement } from '@/lib/canvas-store/types';
import { worldStore, type OriginRect } from '@/lib/tonnetz/world-store';
import { CloseIcon } from '@/components/chrome/icons';
import { uiTick } from '@/lib/playback/playback';
import { WorldController, type WorldUiState } from './controller';
import { LatticeView } from './LatticeView';
import { LegendKey, LegendMoves } from './TonnetzLegend';
import styles from './TonnetzWorld.module.scss';

const ARROWS: Record<string, ArrowDir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const MOVE_KEYS: Record<string, Move> = { p: 'P', l: 'L', r: 'R', n: 'N', s: 'S', h: 'H' };

const clipFrom = (r: OriginRect | null) =>
  r
    ? `inset(${r.top}px ${Math.max(0, window.innerWidth - r.left - r.width)}px ${Math.max(0, window.innerHeight - r.top - r.height)}px ${r.left}px round 14px)`
    : 'inset(45% 45% 45% 45% round 14px)';
const CLIP_OPEN = 'inset(0px 0px 0px 0px round 0px)';

/**
 * The 3D Tonnetz: an endless curved plane of the lattice (the torus unrolled),
 * dragged like phantom.land's grid, with momentum. Arrows step between chords,
 * letters perform the moves, scroll or pinch zooms out to a wide field. Opens
 * out of the card that launched it and writes the focused triad back when it
 * closes.
 */
export function TonnetzWorld({ elementId }: { elementId: string }) {
  const el = canvasStore
    .getState()
    .activePage()
    .elements.find((e): e is TonnetzElement => e.id === elementId && e.kind === 'tonnetz');
  const ctrlRef = useRef<WorldController | null>(null);
  if (!ctrlRef.current && el) ctrlRef.current = new WorldController(el.centre, el.triad, el.showChords);
  const ctrl = ctrlRef.current;

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const [ui, setUi] = useState<WorldUiState | null>(null);
  const [showChords, setShowChords] = useState(el?.showChords ?? false);
  const [showLegend, setShowLegend] = useState(el?.showLegend ?? true);
  const [ready, setReady] = useState(false);
  const [tucked, setTucked] = useState(false);
  const reduced = useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (!ctrl) return;
    ctrl.reducedMotion = reduced.current;
    ctrl.motion.reducedMotion = reduced.current;
    return ctrl.subscribe(setUi);
  }, [ctrl]);

  // ---- open / close ----

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const origin = worldStore.getState().origin;
    if (reduced.current) {
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    } else {
      gsap.fromTo(root, { clipPath: clipFrom(origin) }, { clipPath: CLIP_OPEN, duration: 0.75, ease: 'power3.inOut' });
    }
  }, []);

  useEffect(() => {
    if (!ready || !stageRef.current) return;
    gsap.fromTo(
      stageRef.current,
      { opacity: 0, scale: reduced.current ? 1 : 1.06 },
      { opacity: 1, scale: 1, duration: 0.9, ease: 'power2.out' },
    );
  }, [ready]);

  const close = () => {
    if (closingRef.current || !ctrl) return;
    closingRef.current = true;
    const s = canvasStore.getState();
    const cur = s.activePage().elements.find((e) => e.id === elementId);
    if (cur?.kind === 'tonnetz' && !sameTriad(cur.triad, ctrl.focus)) {
      s.updateElement(elementId, { triad: ctrl.focus }, { commit: true });
    }
    const node = document.querySelector<HTMLElement>(`[data-element-id="${elementId}"]`);
    const r = node?.getBoundingClientRect();
    const root = rootRef.current;
    const done = () => worldStore.getState().close();
    if (!root || reduced.current) {
      if (root) gsap.to(root, { opacity: 0, duration: 0.2, onComplete: done });
      else done();
      return;
    }
    gsap.to(root, {
      clipPath: clipFrom(r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null),
      duration: 0.6,
      ease: 'power3.inOut',
      onComplete: done,
    });
    gsap.to(root, { opacity: 0, duration: 0.25, delay: 0.38 });
  };

  // Close if the element disappears (deleted, page switch, undo).
  useEffect(
    () =>
      canvasStore.subscribe((s) => {
        if (!s.activePage().elements.some((e) => e.id === elementId)) worldStore.getState().close();
      }),
    [elementId],
  );

  // ---- keyboard: swallowed in the capture phase so canvas shortcuts sleep ----

  useEffect(() => {
    if (!ctrl) return;
    const onDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (ARROWS[key]) {
        e.preventDefault();
        ctrl.arrow(ARROWS[key], e.shiftKey);
        return;
      }
      if (key === ' ') {
        e.preventDefault();
        if (!e.repeat) ctrl.playSelection();
        return;
      }
      if (key === '=' || key === '+') return ctrl.zoomBy(0.85);
      if (key === '-' || key === '_') return ctrl.zoomBy(1 / 0.85);
      const move = MOVE_KEYS[key];
      if (move) {
        e.preventDefault();
        if (!e.repeat) {
          uiTick(MOVES.indexOf(move));
          ctrl.doMove(move);
        }
      }
    };
    const onUp = (e: KeyboardEvent) => e.stopPropagation();
    window.addEventListener('keydown', onDown, { capture: true });
    window.addEventListener('keyup', onUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onDown, { capture: true });
      window.removeEventListener('keyup', onUp, { capture: true });
    };
    // close is stable enough for the lifetime of the overlay
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctrl]);

  // ---- pointer: direct-manipulation drag, throw, click, pinch, wheel ----

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !ctrl) return;
    const pointers = new Map<number, { x: number; y: number }>();
    let grab: { x: number; y: number } | null = null;
    let down: { x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number } | null = null;
    let moved = 0;

    const norm = (x: number, y: number) => {
      const r = stage.getBoundingClientRect();
      return { nx: ((x - r.left) / r.width) * 2 - 1, ny: -(((y - r.top) / r.height) * 2 - 1) };
    };
    const now = () => performance.now() / 1000;
    const pinchDist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      try {
        stage.setPointerCapture(e.pointerId);
      } catch {
        // pointer already gone (or synthetic): drag still works while over the stage
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        grab = null;
        ctrl.motion.endDrag(now());
        ctrl.pinch(pinchDist(), true);
        return;
      }
      const { nx, ny } = norm(e.clientX, e.clientY);
      const rel = ctrl.screenToRel(nx, ny, ctrl.hZoom);
      grab = { x: ctrl.motion.pos.x + rel.x, y: ctrl.motion.pos.y + rel.y };
      down = { x: e.clientX, y: e.clientY, t: now() };
      last = { x: e.clientX, y: e.clientY };
      moved = 0;
      ctrl.motion.beginDrag(now());
      stage.dataset.dragging = '';
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        ctrl.pinch(pinchDist(), false);
        return;
      }
      if (!grab || !last) return;
      moved += Math.hypot(e.clientX - last.x, e.clientY - last.y);
      if (moved >= 6) ctrl.pulling = true;
      // Direct manipulation: the lattice point grabbed stays under the pointer.
      const { nx, ny } = norm(e.clientX, e.clientY);
      const rel = ctrl.screenToRel(nx, ny, ctrl.hZoom);
      ctrl.motion.dragTo({ x: grab.x - rel.x, y: grab.y - rel.y }, now());
      last = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size === 1) {
        ctrl.endPinch();
        ctrl.settle();
        return;
      }
      if (pointers.size > 0) return;
      delete stage.dataset.dragging;
      ctrl.pulling = false;
      if (!grab) {
        ctrl.endPinch();
        return;
      }
      grab = null;
      const quick = down && now() - down.t < 0.45;
      if (moved < 6 && quick && down) {
        ctrl.motion.endDrag(now());
        const { nx, ny } = norm(down.x, down.y);
        ctrl.clickAt(nx, ny, e.shiftKey);
      } else {
        ctrl.motion.endDrag(now());
      }
      down = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 16 : 1;
      ctrl.zoomBy(Math.exp(e.deltaY * scale * (e.ctrlKey ? 0.01 : 0.0015)));
    };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onUp);
      stage.removeEventListener('pointercancel', onUp);
      stage.removeEventListener('wheel', onWheel);
    };
  }, [ctrl]);

  if (!el || !ctrl) return null;

  const focus = ui?.focus ?? ctrl.focus;
  const history = ui?.history ?? [];
  const selCount = ui?.selection.length ?? 1;

  return createPortal(
    <div ref={rootRef} className={styles.root} data-world role="dialog" aria-modal="true" aria-label="Tonnetz in 3D">
      <div ref={stageRef} className={styles.stage} style={{ opacity: 0 }}>
        <LatticeView ctrl={ctrl} onFirstFrame={() => setReady(true)} />
      </div>

      <header className={styles.top}>
        <div className={styles.title}>
          <span className={styles.kicker}>Tonnetz – {NOTE_NAMES[el.centre]}</span>
          <span className={styles.chord}>{triadName(focus)}</span>
          {selCount > 1 && <span className={styles.selCount}>{selCount} selected</span>}
        </div>
        <div className={styles.actions} data-tucked={tucked || undefined}>
          <div className={styles.opts} inert={tucked}>
            <button
              type="button"
              className={styles.opt}
              aria-pressed={showChords}
              data-on={showChords || undefined}
              onClick={() => {
                const v = !showChords;
                setShowChords(v);
                ctrl.showChords = v;
                canvasStore.getState().updateElement(elementId, { showChords: v }, { commit: true });
              }}
            >
              Chord names
            </button>
            <button
              type="button"
              className={styles.opt}
              aria-pressed={showLegend}
              data-on={showLegend || undefined}
              onClick={() => {
                const v = !showLegend;
                setShowLegend(v);
                canvasStore.getState().updateElement(elementId, { showLegend: v }, { commit: true });
              }}
            >
              Legend
            </button>
          </div>
          <button
            type="button"
            className={styles.tuck}
            aria-label={tucked ? 'Show options' : 'Tuck options away'}
            title={tucked ? 'Show options' : 'Tuck away'}
            onClick={() => setTucked((t) => !t)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button className={styles.close} aria-label="Close 3D view" title="Close (Esc)" onClick={close}>
            <CloseIcon width={16} height={16} />
          </button>
        </div>
      </header>

      {showLegend && (
        <>
          <aside className={`${styles.legend} ${styles.legendKey}`}>
            <LegendKey />
          </aside>
          <aside className={`${styles.legend} ${styles.legendMoves}`}>
            <LegendMoves />
          </aside>
        </>
      )}

      <footer className={styles.bottom}>
        {history.length > 1 && (
          <ol className={styles.history} aria-label="History">
            {history.slice(-10).map((t, k, arr) => (
              <li key={`${k}-${t.root}-${t.minor}`}>
                {k > 0 && <span className={styles.sep}>›</span>}
                <button
                  className={styles.crumb}
                  data-current={k === arr.length - 1 || undefined}
                  onClick={() => ctrl.travelTo(t)}
                >
                  {triadName(t)}
                </button>
              </li>
            ))}
          </ol>
        )}
        <div className={styles.moves}>
          {MOVES.map((m) => (
            <button
              key={m}
              className={styles.move}
              title={moveLabel(focus, m)}
              aria-label={moveLabel(focus, m)}
              onClick={() => {
                uiTick(MOVES.indexOf(m));
                ctrl.doMove(m);
              }}
            >
              {m}
              <span className={styles.tip}>{moveLabel(focus, m)}</span>
            </button>
          ))}
        </div>
      </footer>

      <p className={styles.hint} data-hidden={!ready || undefined}>
        Drag to move · arrows step between chords (⇧ adds) · Space plays · P L R N S H move · scroll to zoom
      </p>
    </div>,
    document.body,
  );
}

export default TonnetzWorld;
