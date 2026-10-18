/**
 * Camera for the infinite canvas. Lives outside React state — pan/zoom write
 * straight to the DOM (transform + dot-grid background) so gestures never
 * trigger a React render. Components that need camera values subscribe.
 */
import { gsap } from 'gsap';

export interface Camera {
  x: number;
  y: number;
  k: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 3;
const GRID_SIZE = 28;

export class CameraController {
  camera: Camera = { x: 0, y: 0, k: 1 };
  private content: HTMLElement | null = null;
  private surface: HTMLElement | null = null;
  private listeners = new Set<(c: Camera) => void>();
  private raf = 0;
  private tween: gsap.core.Tween | null = null;

  attach(surface: HTMLElement, content: HTMLElement) {
    this.surface = surface;
    this.content = content;
    this.applyNow();
  }

  detach() {
    this.surface = null;
    this.content = null;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  subscribe(fn: (c: Camera) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  pan(dx: number, dy: number) {
    this.stopTween();
    this.camera.x += dx;
    this.camera.y += dy;
    this.schedule();
  }

  /** Zoom by `factor` keeping the screen point (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    this.stopTween();
    const { x, y, k } = this.camera;
    const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    const scale = nk / k;
    this.camera.k = nk;
    this.camera.x = sx - (sx - x) * scale;
    this.camera.y = sy - (sy - y) * scale;
    this.schedule();
  }

  /**
   * Smallest pan/zoom that shows a canvas rect inside a screen box, never
   * zooming past 1. Eases there over `duration` seconds.
   */
  reveal(
    rect: { x: number; y: number; w: number; h: number },
    box: { left: number; top: number; right: number; bottom: number },
    duration = 0.45,
  ) {
    const bw = box.right - box.left;
    const bh = box.bottom - box.top;
    const k = Math.max(MIN_ZOOM, Math.min(1, bw / rect.w, bh / rect.h));
    const x = box.left + (bw - rect.w * k) / 2 - rect.x * k;
    const y = box.top - rect.y * k;
    this.stopTween();
    this.tween = gsap.to(this.camera, {
      x,
      y,
      k,
      duration,
      ease: 'power3.out',
      onUpdate: () => this.schedule(),
      onComplete: () => {
        this.tween = null;
      },
    });
  }

  /** User input always wins over an easing reveal. */
  private stopTween() {
    this.tween?.kill();
    this.tween = null;
  }

  screenToCanvas(sx: number, sy: number): { x: number; y: number } {
    const { x, y, k } = this.camera;
    return { x: (sx - x) / k, y: (sy - y) / k };
  }

  private schedule() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.applyNow();
    });
  }

  private applyNow() {
    const { x, y, k } = this.camera;
    if (this.content) {
      this.content.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    }
    if (this.surface) {
      const size = GRID_SIZE * k;
      this.surface.style.backgroundSize = `${size}px ${size}px`;
      this.surface.style.backgroundPosition = `${x}px ${y}px`;
    }
    this.listeners.forEach((fn) => fn(this.camera));
  }
}
