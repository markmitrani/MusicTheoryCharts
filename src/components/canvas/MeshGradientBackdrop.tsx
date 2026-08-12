'use client';

import { useEffect, useRef } from 'react';
import styles from './Backdrops.module.scss';

/**
 * Experimental "mesh" gradient: a vertical blue→gold→black ramp whose gold
 * ridge line rides an equation curve across the screen —
 *   f(x) = 1/x + log(x) + (1/3)·sin(x)   over x ∈ [0.30, 10]
 * mapped left→right. So the middle (gold) colour stop's vertical position
 * varies per column, giving a wavy, natural-looking band that spikes at the
 * left (the 1/x term) and gently undulates (the dip near 4.6, bump near 8),
 * echoing the reference. Fine grain on top for a grungy feel. The curve drifts
 * slowly; `prefers-reduced-motion` freezes it. Colours sampled from the
 * reference: petrol blue, gold, light gold, near-black.
 */
const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

// Dave-Hoskins hash12 — stays well-distributed even at large pixel coords,
// so the grain doesn't form moiré/repeats at high resolution.
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float eq(float x){ return 1.0 / x + log(x) + 0.3333 * sin(x); }

void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;       // x:0..1 L→R, y:0..1 bottom→top
  float yTop = 1.0 - uv.y;                    // 0 at top, 1 at bottom

  // Map screen x to the curve's domain. A very slow, one-sided drift eases the
  // curve to the right and back. It's cosine-shaped so it's always >= 0 — the
  // left edge never crosses below 0.30 into the 1/x singularity (that was the
  // hard seam) — and the period is ~3h, so it only reverses every ~90 minutes:
  // at that pace it reads like a smooth continuous drift, just bounded.
  float drift = (0.5 - 0.5 * cos(uTime * 0.000582)) * 3.5;
  float X = 0.30 + uv.x * (10.0 - 0.30) + drift;
  float v = eq(X);
  // Centre the undulating part (~0.55..1.35) near mid-screen; the 1/x spike
  // pushes the ridge up and off the top at the far left.
  float ridge = 0.52 - (v - 1.0) * 0.22;

  float d = yTop - ridge;                     // <0 above the ridge, >0 below

  vec3 cBlue  = vec3(0.31, 0.43, 0.43);       // petrol/gasoline blue
  vec3 cGold  = vec3(0.71, 0.55, 0.31);       // gold
  vec3 cLight = vec3(0.87, 0.78, 0.58);       // lighter gold highlight
  vec3 cBlack = vec3(0.025, 0.035, 0.030);    // near-black

  vec3 col;
  if (d < 0.0) {
    // above the ridge: petrol blue (far up) easing into gold near the ridge
    float t = clamp((d + 0.6) / 0.6, 0.0, 1.0);
    col = mix(cBlue, cGold, smoothstep(0.0, 1.0, t));
  } else {
    // below the ridge: a light-gold lip just under the crest, then down to black
    float t = clamp(d / 0.7, 0.0, 1.0);
    col = mix(cLight, cBlack, smoothstep(0.0, 1.0, t));
    col = mix(cGold, col, smoothstep(0.0, 0.13, d));
  }

  // static fine grain — the gradient itself drifts, so animating the grain too
  // reads as stop-motion. Locked to device pixels for a fixed filmic overlay.
  float g = hash12(gl_FragCoord.xy);
  col += (g - 0.5) * 0.05;

  float vig = smoothstep(1.3, 0.3, length(uv - 0.5));
  col *= mix(0.55, 1.0, vig);
  gl_FragColor = vec4(col, 1.0);
}
`;

export function MeshGradientBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uRes = gl.getUniformLocation(prog, 'uRes');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * d));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * d));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const start = performance.now();
    const draw = (t: number) => {
      gl.uniform1f(uTime, t);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    if (reduce) {
      draw(0);
    } else {
      const loop = () => {
        draw((performance.now() - start) / 1000);
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      // Don't loseContext() — React StrictMode remounts and a lost context
      // can't be revived on the same canvas; GC frees it on real unmount.
    };
  }, []);

  return <canvas ref={ref} className={`${styles.layer} ${styles.gradient}`} aria-hidden />;
}
