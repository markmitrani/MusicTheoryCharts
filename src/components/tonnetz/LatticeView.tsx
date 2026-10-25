'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { latticeVertex, latticeFragment, COPY_ORIGIN, PERIOD_A, PERIOD_B } from '@/lib/tonnetz/lattice-shader';
import { drawAtlas } from '@/lib/tonnetz/atlas';
import { readWorldColors, onThemeChange, type WorldColors } from '@/lib/tonnetz/theme-colors';
import { FOV, type WorldController } from './controller';

const SEG_A = 28; // subdivisions along the minor-third side (4 steps)
const SEG_B = 21; // along the major-third side (3 steps)
const SPAN = 8; // copies each side of the camera's copy (covers the widest zoom)

/** One torus copy as a subdivided parallelogram, instanced (2·SPAN+1)² times. */
function buildGeometry() {
  const g = new THREE.InstancedBufferGeometry();
  const lat: number[] = [];
  for (let b = 0; b <= SEG_B; b++) {
    for (let a = 0; a <= SEG_A; a++) {
      const s = a / SEG_A;
      const t = b / SEG_B;
      lat.push(COPY_ORIGIN.i + s * PERIOD_A.i + t * PERIOD_B.i, COPY_ORIGIN.j + s * PERIOD_A.j + t * PERIOD_B.j);
    }
  }
  const idx: number[] = [];
  const row = SEG_A + 1;
  for (let b = 0; b < SEG_B; b++) {
    for (let a = 0; a < SEG_A; a++) {
      const p = b * row + a;
      idx.push(p, p + 1, p + row, p + 1, p + row + 1, p + row);
    }
  }
  g.setIndex(idx);
  g.setAttribute('aLat', new THREE.Float32BufferAttribute(lat, 2));
  // Unused by the shader, but three needs a position attribute for its bookkeeping.
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((lat.length / 2) * 3), 3));
  const copies: number[] = [];
  for (let a = -SPAN; a <= SPAN; a++) for (let b = -SPAN; b <= SPAN; b++) copies.push(a, b);
  g.setAttribute('aCopy', new THREE.InstancedBufferAttribute(new Float32Array(copies), 2));
  g.instanceCount = copies.length / 2;
  return g;
}

// Theme colours stay raw sRGB (tagged linear so three leaves them alone); the
// shader mixes and writes them as-is, matching the card's CSS colour blends.
const raw = (css: string) => new THREE.Color().setStyle(css, THREE.LinearSRGBColorSpace);

function applyColors(u: Record<string, THREE.IUniform>, c: WorldColors) {
  u.uBg.value = raw(c.bg);
  u.uFill.value = raw(c.fill);
  u.uRim.value = raw(c.rim);
  u.uHair.value = raw(c.hairline);
  u.uSeam.value = raw(c.seam);
  u.uText.value = raw(c.text);
  u.uTextStrong.value = raw(c.textStrong);
  u.uAccent.value = raw(c.accent);
  u.uTint.value = raw(c.accentWarm);
  u.uMajor.value = raw(c.major);
  u.uMinor.value = raw(c.minor);
}

/**
 * The lattice, drawn with plain three.js: one renderer, one camera, one
 * instanced mesh, driven by THREE.Timer on the renderer's animation loop. Each
 * frame advances the controller and copies its state into uniforms; nothing
 * here causes a React render.
 */
export function LatticeView({ ctrl, onFirstFrame }: { ctrl: WorldController; onFirstFrame: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const firstFrameRef = useRef(onFirstFrame);
  firstFrameRef.current = onFirstFrame;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // ---- renderer: MSAA plus supersampling, sRGB output, no tone mapping (flat UI colours) ----
    // Rendered above the screen's own resolution (at least 2×, up to 3×) and
    // downsampled by the browser, so edges and text stay crisp on any display.
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const pixelRatio = () => Math.min(3, Math.max(2, window.devicePixelRatio * 1.5));
    renderer.setPixelRatio(pixelRatio());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);

    const atlasCanvas = drawAtlas(document.createElement('canvas'));
    const atlas = new THREE.CanvasTexture(atlasCanvas);
    atlas.generateMipmaps = true;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const u: Record<string, THREE.IUniform> = {
      uCam: { value: new THREE.Vector2() },
      uCopyBase: { value: new THREE.Vector2() },
      uCurve: { value: 0 },
      uTime: { value: 0 },
      uCentre: { value: ctrl.centre },
      uShowChords: { value: ctrl.showChords ? 1 : 0 },
      uFadeR: { value: 10 },
      uLit: { value: new Array(24).fill(0) },
      uPlay: { value: new Array(24).fill(0) },
      uFocus: { value: new THREE.Vector3() },
      uAtlas: { value: atlas },
      uBg: { value: new THREE.Color() },
      uFill: { value: new THREE.Color() },
      uRim: { value: new THREE.Color() },
      uHair: { value: new THREE.Color() },
      uSeam: { value: new THREE.Color() },
      uText: { value: new THREE.Color() },
      uTextStrong: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uTint: { value: new THREE.Color() },
      uMajor: { value: new THREE.Color() },
      uMinor: { value: new THREE.Color() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: latticeVertex,
      fragmentShader: latticeFragment,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const geometry = buildGeometry();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // the vertex shader places everything
    scene.add(mesh);

    // ---- theme: re-read tokens on change; redraw the atlas once fonts settle ----
    const refresh = () => {
      const c = readWorldColors();
      applyColors(u, c);
      scene.background = new THREE.Color().setStyle(c.bg);
    };
    refresh();
    const offTheme = onThemeChange(refresh);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      drawAtlas(atlasCanvas);
      atlas.needsUpdate = true;
    });

    // ---- size ----
    const resize = () => {
      const w = Math.max(host.clientWidth, 1);
      const h = Math.max(host.clientHeight, 1);
      // Follows a move to another display; capped at ~16 MP so very large
      // screens stay within GPU drawing-buffer limits.
      renderer.setPixelRatio(Math.min(pixelRatio(), Math.sqrt(16e6 / (w * h))));
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      ctrl.aspect = camera.aspect;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // Compile up front so the first frame never stutters.
    renderer.compile(scene, camera);

    // ---- frame loop ----
    const timer = new THREE.Timer();
    timer.connect(document); // zero delta while the tab is hidden
    let first = true;
    renderer.setAnimationLoop((time: number) => {
      timer.update(time);
      ctrl.update(timer.getDelta());
      const f = ctrl.frameUniforms();
      (u.uCam.value as THREE.Vector2).set(f.cam.i, f.cam.j);
      (u.uCopyBase.value as THREE.Vector2).set(f.copyBase.a, f.copyBase.b);
      (u.uFocus.value as THREE.Vector3).set(f.focus.i, f.focus.j, 1);
      u.uCurve.value = ctrl.curve;
      u.uTime.value = ctrl.time;
      u.uShowChords.value = ctrl.showChords ? 1 : 0;
      u.uFadeR.value = ctrl.fadeRadius;
      const lit = u.uLit.value as number[];
      const play = u.uPlay.value as number[];
      for (let n = 0; n < 24; n++) {
        lit[n] = ctrl.lit[n];
        play[n] = ctrl.play[n];
      }
      camera.position.set(0, 0, ctrl.h);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      if (first) {
        first = false;
        requestAnimationFrame(() => firstFrameRef.current());
      }
    });

    return () => {
      alive = false;
      renderer.setAnimationLoop(null);
      timer.dispose();
      ro.disconnect();
      offTheme();
      geometry.dispose();
      material.dispose();
      atlas.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [ctrl]);

  return <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />;
}
