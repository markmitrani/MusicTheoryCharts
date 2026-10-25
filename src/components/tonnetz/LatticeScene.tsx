'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { latticeVertex, latticeFragment, COPY_ORIGIN, PERIOD_A, PERIOD_B } from '@/lib/tonnetz/lattice-shader';
import { drawAtlas } from '@/lib/tonnetz/atlas';
import { readWorldColors, onThemeChange, type WorldColors } from '@/lib/tonnetz/theme-colors';
import type { WorldController } from './controller';

const SEG_A = 40; // subdivisions along the minor-third side (4 steps)
const SEG_B = 30; // along the major-third side (3 steps)
const SPAN = 4; // copies each side of the camera's copy

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
  // Unused by the shader, but three needs a position attribute for bounds.
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((lat.length / 2) * 3), 3));
  const copies: number[] = [];
  for (let a = -SPAN; a <= SPAN; a++) for (let b = -SPAN; b <= SPAN; b++) copies.push(a, b);
  g.setAttribute('aCopy', new THREE.InstancedBufferAttribute(new Float32Array(copies), 2));
  g.instanceCount = copies.length / 2;
  return g;
}

// Theme colours stay in sRGB (no linear conversion) and the shader mixes and
// outputs them as-is, so every blend matches the card's CSS color-mix in srgb.
const color = (css: string) => new THREE.Color().setStyle(css, THREE.LinearSRGBColorSpace);

function applyColors(u: Record<string, THREE.IUniform>, c: WorldColors) {
  u.uBg.value = color(c.bg);
  u.uFill.value = color(c.fill);
  u.uRim.value = color(c.rim);
  u.uHair.value = color(c.hairline);
  u.uSeam.value = color(c.seam);
  u.uText.value = color(c.text);
  u.uTextStrong.value = color(c.textStrong);
  u.uAccent.value = color(c.accent);
  u.uTint.value = color(c.accentWarm);
  u.uMajor.value = color(c.major);
  u.uMinor.value = color(c.minor);
}

/**
 * The lattice mesh and the frame loop. Each frame advances the controller and
 * copies its state into uniforms; nothing here causes a React render.
 */
export function LatticeScene({ ctrl, onFirstFrame }: { ctrl: WorldController; onFirstFrame: () => void }) {
  const { gl, scene, camera, size } = useThree();
  const first = useRef(true);

  const geometry = useMemo(buildGeometry, []);
  const atlas = useMemo(() => {
    const tex = new THREE.CanvasTexture(drawAtlas(document.createElement('canvas')));
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 8;
    return tex;
  }, []);

  const material = useMemo(() => {
    const u: Record<string, THREE.IUniform> = {
      uCam: { value: new THREE.Vector2() },
      uCopyBase: { value: new THREE.Vector2() },
      uCurve: { value: 0 },
      uRoll: { value: 0 },
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
    applyColors(u, readWorldColors());
    return new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: latticeVertex,
      fragmentShader: latticeFragment,
      side: THREE.DoubleSide,
    });
  }, [atlas, ctrl]);

  // Theme: re-read tokens (and redraw the atlas once fonts settle) on change.
  useEffect(() => {
    const refresh = () => {
      const c = readWorldColors();
      applyColors(material.uniforms, c);
      scene.background = new THREE.Color().setStyle(c.bg);
    };
    refresh();
    const off = onThemeChange(refresh);
    document.fonts?.ready.then(() => {
      drawAtlas(atlas.image as HTMLCanvasElement);
      atlas.needsUpdate = true;
    });
    return () => {
      off();
    };
  }, [material, atlas, scene]);

  // Compile before the first frame so opening never stutters.
  useEffect(() => {
    gl.compile(scene, camera);
  }, [gl, scene, camera]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
      atlas.dispose();
    },
    [geometry, material, atlas],
  );

  useFrame((_, delta) => {
    ctrl.aspect = size.width / Math.max(size.height, 1);
    ctrl.viewportH = size.height;
    ctrl.update(delta);
    const u = material.uniforms;
    const cam = ctrl.camLattice;
    const bump = ctrl.bumpOffset;
    (u.uCam.value as THREE.Vector2).set(cam.i + bump, cam.j);
    const base = ctrl.copyBase();
    (u.uCopyBase.value as THREE.Vector2).set(base.a, base.b);
    u.uCurve.value = ctrl.curve;
    u.uRoll.value = ctrl.roll;
    u.uTime.value = ctrl.time;
    u.uShowChords.value = ctrl.showChords ? 1 : 0;
    u.uFadeR.value = ctrl.fadeRadius;
    const lit = u.uLit.value as number[];
    const play = u.uPlay.value as number[];
    for (let n = 0; n < 24; n++) {
      lit[n] = ctrl.lit[n];
      play[n] = ctrl.play[n];
    }
    const f = ctrl.focusPos();
    const fc = f.up ? { i: f.i + 1 / 3, j: f.j + 1 / 3 } : { i: f.i + 2 / 3, j: f.j + 2 / 3 };
    (u.uFocus.value as THREE.Vector3).set(fc.i, fc.j, 1);
    camera.position.set(0, 0, ctrl.h);
    camera.lookAt(0, 0, 0);
    if (first.current) {
      first.current = false;
      requestAnimationFrame(onFirstFrame);
    }
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}
