'use client';

import { memo } from 'react';
import styles from './PianoKeys.module.scss';

/**
 * Piano keyboard SVG in the reference style: cream whites, dark blacks,
 * copper highlights for chord/scale tones, orange "lit" keys during playback.
 * Pitches are absolute semitone totals (Note.totalSemitones); the keyboard
 * starts at `baseC` (must be a C) and spans `octaves`.
 */
interface PianoKeysProps {
  baseC: number;
  octaves: number;
  highlighted: ReadonlySet<number>;
  lit?: ReadonlySet<number>;
}

const WHITE_W = 22;
const WHITE_H = 78;
const BLACK_W = 13.2;
const BLACK_H = 48;
const OCTAVE_W = WHITE_W * 7;

// semitone-in-octave → white key index (for whites) / x-center (for blacks)
const WHITE_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const BLACK_SEMIS = [1, 3, 6, 8, 10];
const BLACK_X: Record<number, number> = {
  1: WHITE_W * 1 - BLACK_W / 2 - 1.5,
  3: WHITE_W * 2 - BLACK_W / 2 + 1.5,
  6: WHITE_W * 4 - BLACK_W / 2 - 1.5,
  8: WHITE_W * 5 - BLACK_W / 2,
  10: WHITE_W * 6 - BLACK_W / 2 + 1.5,
};

export const PianoKeys = memo(function PianoKeys({ baseC, octaves, highlighted, lit }: PianoKeysProps) {
  const whites: { x: number; pitch: number }[] = [];
  const blacks: { x: number; pitch: number }[] = [];

  for (let oct = 0; oct < octaves; oct++) {
    const octX = oct * OCTAVE_W;
    const octBase = baseC + oct * 12;
    WHITE_SEMIS.forEach((semi, i) => {
      whites.push({ x: octX + i * WHITE_W, pitch: octBase + semi });
    });
    BLACK_SEMIS.forEach((semi) => {
      blacks.push({ x: octX + BLACK_X[semi], pitch: octBase + semi });
    });
  }

  const width = octaves * OCTAVE_W;
  const classFor = (pitch: number, isBlack: boolean) => {
    if (lit?.has(pitch)) return styles.lit;
    if (highlighted.has(pitch)) return styles.hi;
    return isBlack ? styles.black : styles.white;
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${WHITE_H}`}
      width="100%"
      role="img"
      aria-label="Piano keyboard"
      style={{ display: 'block' }}
    >
      {whites.map(({ x, pitch }) => (
        <rect
          key={pitch}
          x={x + 0.75}
          y={0}
          width={WHITE_W - 1.5}
          height={WHITE_H}
          rx={2.5}
          className={classFor(pitch, false)}
          style={{ transition: 'fill 120ms ease-out' }}
        />
      ))}
      {blacks.map(({ x, pitch }) => (
        <rect
          key={pitch}
          x={x}
          y={-3}
          width={BLACK_W}
          height={BLACK_H}
          rx={2.5}
          className={classFor(pitch, true)}
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={0.5}
          style={{ transition: 'fill 120ms ease-out' }}
        />
      ))}
    </svg>
  );
});
