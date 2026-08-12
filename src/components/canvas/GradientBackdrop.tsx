'use client';

import { useEffect, useRef } from 'react';
import styles from './Backdrops.module.scss';

/**
 * Experimental WebGL backdrop: domain-warped fractal noise mapped onto an
 * olive/cream colour ramp, producing the flowing organic gradient blobs from
 * the reference. "Noise-parameterized" — layered fbm warps the sample field
 * twice, so the bands bend instead of reading as flat linear gradients. The
 * field drifts slowly over time; `prefers-reduced-motion` freezes it to a
 * single still frame. Screen-fixed, pointer-transparent, no dependencies.
 */
const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ p = fract(p * vec2(123.34, 345.45)); p += dot(p, p + 34.345); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y) * 2.6;
  float t = uTime * 0.06;

  // double domain warp -> bent, blobby iso-bands
  vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3 - t)));
  vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + t), fbm(p + 4.0 * q + vec2(8.3, 2.8) - t));
  float f = fbm(p + 4.0 * r);

  // olive / gold / cream ramp over a near-black green
  vec3 c0 = vec3(0.03, 0.05, 0.04);
  vec3 c1 = vec3(0.20, 0.22, 0.14);
  vec3 c2 = vec3(0.55, 0.50, 0.32);
  vec3 c3 = vec3(0.86, 0.80, 0.62);
  vec3 col = mix(c0, c1, smoothstep(0.0, 0.5, f));
  col = mix(col, c2, smoothstep(0.40, 0.82, f));
  col = mix(col, c3, smoothstep(0.78, 1.0, f) * 0.85);
  col += 0.05 * length(r);            // soft sheen along the warp ridges

  float vig = smoothstep(1.25, 0.25, length(uv - 0.5));
  col *= mix(0.45, 1.0, vig);         // cinematic vignette
  gl_FragColor = vec4(col, 1.0);
}
`;

export function GradientBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return; // no WebGL → silently skip (toggle simply has no effect)

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
      draw(0); // single still frame
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
      // NB: don't loseContext() here — under React's dev StrictMode the effect
      // is mounted/unmounted/remounted, and a lost context can't be revived on
      // the same canvas. The context is released by GC when the canvas unmounts.
    };
  }, []);

  return <canvas ref={ref} className={`${styles.layer} ${styles.gradient}`} aria-hidden />;
}
