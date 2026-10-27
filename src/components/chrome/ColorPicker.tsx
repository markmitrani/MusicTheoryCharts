'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ColorPicker.module.scss';

/** HSV is the picker's master state: it keeps the hue of greys and blacks. */
type HSV = { h: number; s: number; v: number };
type Mode = 'wheel' | 'square' | 'hsb' | 'hsl' | 'rgb';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'wheel', label: 'Wheel' },
  { mode: 'square', label: 'Square' },
  { mode: 'hsb', label: 'HSB' },
  { mode: 'hsl', label: 'HSL' },
  { mode: 'rgb', label: 'RGB' },
];

const MODE_KEY = 'mtp-picker-mode';
const SIZE = 152;
const RAINBOW = 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)';

function hsvToRgb({ h, s, v }: HSV): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5) * 255, f(3) * 255, f(1) * 255];
}

const toHex = (rgb: number[]) =>
  '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
const hsvHex = (c: HSV) => toHex(hsvToRgb(c));

function rgbToHsv([r, g, b]: number[], keepH = 0): HSV {
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = keepH / 60;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHsl = ({ h, s, v }: HSV) => {
  const l = v * (1 - s / 2);
  const m = Math.min(l, 1 - l);
  return { h, s: m ? (v - l) / m : 0, l };
};

const fromHsl = (h: number, s: number, l: number): HSV => {
  const v = l + s * Math.min(l, 1 - l);
  return { h, s: v ? 2 * (1 - l / v) : 0, v };
};

/** One channel: a gradient track showing the colours it reaches, plus an exact number. */
function Channel(props: {
  label: string;
  value: number;
  max: number;
  track: string;
  onChange: (n: number) => void;
}) {
  const { label, value, max, track, onChange } = props;
  const set = (n: number) => onChange(Math.max(0, Math.min(max, Number.isFinite(n) ? n : 0)));
  return (
    <div className={styles.channel}>
      <span className={styles.channelLabel}>{label}</span>
      <input
        className={styles.track}
        type="range"
        min={0}
        max={max}
        value={Math.round(value)}
        aria-label={label}
        style={{ background: track }}
        onChange={(e) => set(Number(e.target.value))}
      />
      <input
        className={styles.number}
        type="number"
        min={0}
        max={max}
        value={Math.round(value)}
        aria-label={`${label} value`}
        onChange={(e) => set(Number(e.target.value))}
      />
    </div>
  );
}

/** Pointer drag on a 2D surface, reported as 0..1 fractions of its box. */
function usePad(onPick: (fx: number, fy: number) => void) {
  const pick = (e: React.PointerEvent<HTMLElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    onPick((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height);
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pick(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      if (e.buttons) pick(e);
    },
  };
}

function Wheel({ hsv, onChange }: { hsv: HSV; onChange: (c: HSV) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const px = Math.round(SIZE * Math.min(2, window.devicePixelRatio || 1));
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(px, px);
    const R = px / 2;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x + 0.5 - R;
        const dy = y + 0.5 - R;
        const r = Math.hypot(dx, dy) / R;
        if (r > 1) continue;
        const [cr, cg, cb] = hsvToRgb({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: r, v: 1 });
        const i = (y * px + x) * 4;
        img.data[i] = cr;
        img.data[i + 1] = cg;
        img.data[i + 2] = cb;
        img.data[i + 3] = Math.round(255 * Math.min(1, (1 - r) * R)); // soft rim
      }
    }
    ctx.putImageData(img, 0, 0);
  }, []);

  const pad = usePad((fx, fy) => {
    const dx = fx - 0.5;
    const dy = fy - 0.5;
    onChange({ h: ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360, s: Math.min(1, Math.hypot(dx, dy) * 2), v: hsv.v });
  });
  const a = (hsv.h * Math.PI) / 180;

  return (
    <>
      <div className={styles.wheel} style={{ width: SIZE, height: SIZE }} {...pad}>
        <canvas ref={canvasRef} className={styles.canvas} />
        <div className={styles.shade} style={{ opacity: 1 - hsv.v }} />
        <span
          className={styles.marker}
          style={{ left: `${50 + 50 * hsv.s * Math.cos(a)}%`, top: `${50 + 50 * hsv.s * Math.sin(a)}%`, background: hsvHex(hsv) }}
        />
      </div>
      <input
        className={styles.track}
        type="range"
        min={0}
        max={100}
        value={Math.round(hsv.v * 100)}
        aria-label="Brightness"
        style={{ background: `linear-gradient(to right, #000, ${hsvHex({ ...hsv, v: 1 })})` }}
        onChange={(e) => onChange({ ...hsv, v: Number(e.target.value) / 100 })}
      />
    </>
  );
}

/** Saturation across, brightness down, hue on the strip below. */
function Square({ hsv, onChange }: { hsv: HSV; onChange: (c: HSV) => void }) {
  const pad = usePad((fx, fy) =>
    onChange({ h: hsv.h, s: Math.max(0, Math.min(1, fx)), v: 1 - Math.max(0, Math.min(1, fy)) }),
  );
  return (
    <>
      <div
        className={styles.square}
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvHex({ h: hsv.h, s: 1, v: 1 })})`,
        }}
        {...pad}
      >
        <span
          className={styles.marker}
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvHex(hsv) }}
        />
      </div>
      <input
        className={styles.track}
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        style={{ background: RAINBOW }}
        onChange={(e) => onChange({ ...hsv, h: Number(e.target.value) % 360 })}
      />
    </>
  );
}

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(value)));
  const [draft, setDraft] = useState(value);
  const [mode, setMode] = useState<Mode>('wheel');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY) as Mode | null;
      if (saved && MODES.some((m) => m.mode === saved)) setMode(saved);
    } catch {
      // storage disabled — default mode
    }
  }, []);

  // Follow outside changes without losing the hue of a grey.
  useEffect(() => {
    if (hsvHex(hsv) !== value) setHsv((c) => rgbToHsv(hexToRgb(value), c.h));
    setDraft(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (next: HSV) => {
    setHsv(next);
    onChange(hsvHex(next));
  };

  const chooseMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // storage disabled — mode still applies for this session
    }
  };

  const hsl = toHsl(hsv);
  const [r, g, b] = hsvToRgb(hsv);
  const rgb = (rr: number, gg: number, bb: number) => commit(rgbToHsv([rr, gg, bb], hsv.h));

  return (
    <div className={styles.picker}>
      <div className={styles.modes} role="tablist" aria-label="Colour picker mode">
        {MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={styles.mode}
            data-active={mode === m || undefined}
            onClick={() => chooseMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'wheel' && <Wheel hsv={hsv} onChange={commit} />}
      {mode === 'square' && <Square hsv={hsv} onChange={commit} />}

      {mode === 'hsb' && (
        <div className={styles.channels}>
          <Channel label="H" value={hsv.h} max={359} track={RAINBOW} onChange={(n) => commit({ ...hsv, h: n })} />
          <Channel
            label="S"
            value={hsv.s * 100}
            max={100}
            track={`linear-gradient(to right, ${hsvHex({ ...hsv, s: 0 })}, ${hsvHex({ ...hsv, s: 1 })})`}
            onChange={(n) => commit({ ...hsv, s: n / 100 })}
          />
          <Channel
            label="B"
            value={hsv.v * 100}
            max={100}
            track={`linear-gradient(to right, #000, ${hsvHex({ ...hsv, v: 1 })})`}
            onChange={(n) => commit({ ...hsv, v: n / 100 })}
          />
        </div>
      )}

      {mode === 'hsl' && (
        <div className={styles.channels}>
          <Channel label="H" value={hsl.h} max={359} track={RAINBOW} onChange={(n) => commit(fromHsl(n, hsl.s, hsl.l))} />
          <Channel
            label="S"
            value={hsl.s * 100}
            max={100}
            track={`linear-gradient(to right, hsl(${hsl.h} 0% ${hsl.l * 100}%), hsl(${hsl.h} 100% ${hsl.l * 100}%))`}
            onChange={(n) => commit(fromHsl(hsl.h, n / 100, hsl.l))}
          />
          <Channel
            label="L"
            value={hsl.l * 100}
            max={100}
            track={`linear-gradient(to right, #000, hsl(${hsl.h} ${hsl.s * 100}% 50%), #fff)`}
            onChange={(n) => commit(fromHsl(hsl.h, hsl.s, n / 100))}
          />
        </div>
      )}

      {mode === 'rgb' && (
        <div className={styles.channels}>
          <Channel
            label="R"
            value={r}
            max={255}
            track={`linear-gradient(to right, ${toHex([0, g, b])}, ${toHex([255, g, b])})`}
            onChange={(n) => rgb(n, g, b)}
          />
          <Channel
            label="G"
            value={g}
            max={255}
            track={`linear-gradient(to right, ${toHex([r, 0, b])}, ${toHex([r, 255, b])})`}
            onChange={(n) => rgb(r, n, b)}
          />
          <Channel
            label="B"
            value={b}
            max={255}
            track={`linear-gradient(to right, ${toHex([r, g, 0])}, ${toHex([r, g, 255])})`}
            onChange={(n) => rgb(r, g, n)}
          />
        </div>
      )}

      <div className={styles.hexRow}>
        <span className={styles.preview} style={{ background: value }} />
        <input
          className={styles.hex}
          value={draft}
          spellCheck={false}
          aria-label="Hex colour"
          onChange={(e) => {
            const t = e.target.value.trim();
            setDraft(t);
            const hex = (t.startsWith('#') ? t : '#' + t).toLowerCase();
            if (/^#[0-9a-f]{6}$/.test(hex)) {
              setHsv((c) => rgbToHsv(hexToRgb(hex), c.h));
              onChange(hex);
            }
          }}
          onBlur={() => setDraft(value)}
        />
      </div>
    </div>
  );
}
