/**
 * Camera for the infinite canvas. Lives outside React state — pan/zoom write
 * straight to the DOM (transform + dot-grid background) so gestures never
 * trigger a React render. Components that need camera values subscribe.
 */
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
    this.camera.x += dx;
    this.camera.y += dy;
    this.schedule();
  }

  /** Zoom by `factor` keeping the screen point (sx, sy) fixed. */
  zoomAt(sx: number, sy: number, factor: number) {
    const { x, y, k } = this.camera;
    const nk = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k * factor));
    const scale = nk / k;
    this.camera.k = nk;
    this.camera.x = sx - (sx - x) * scale;
    this.camera.y = sy - (sy - y) * scale;
    this.schedule();
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
