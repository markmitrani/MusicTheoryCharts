import { NOTE_NAMES, type NoteName } from './note';

/**
 * Bartók / Lendvai pitch-axis system. The 12 chromatic pitch classes split
 * into three functional axes — tonic, dominant, subdominant — each a
 * diminished-seventh chord (four notes a minor third apart). Counting up by
 * semitone from the key centre the functions cycle T, D, S, T, D, S…, so the
 * axis of a note is simply its distance from the centre, mod 3.
 *
 * Crucially this grouping is set by the key CENTRE alone; it does not depend on
 * the mode (major, minor, dorian, …). C, E♭, F♯ and A all carry tonic function
 * in C whatever the mode.
 */
export type AxisFn = 'tonic' | 'subdominant' | 'dominant';

const FN_BY_OFFSET: AxisFn[] = ['tonic', 'dominant', 'subdominant'];

export const AXES: Array<{ fn: AxisFn; label: string; colorVar: string }> = [
  { fn: 'tonic', label: 'Tonic', colorVar: 'var(--axis-tonic)' },
  { fn: 'subdominant', label: 'Subdominant', colorVar: 'var(--axis-subdominant)' },
  { fn: 'dominant', label: 'Dominant', colorVar: 'var(--axis-dominant)' },
];

export const AXIS_COLOR: Record<AxisFn, string> = {
  tonic: 'var(--axis-tonic)',
  subdominant: 'var(--axis-subdominant)',
  dominant: 'var(--axis-dominant)',
};

/** Conventional chromatic spellings, flats where idiomatic (C on index 0). */
export const CHROMATIC_LABELS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

/** Functional axis of chromatic index `i` relative to the centre note. */
export function axisOf(i: number, center: NoteName): AxisFn {
  const centerIdx = NOTE_NAMES.indexOf(center);
  const offset = ((i - centerIdx) % 3 + 3) % 3;
  return FN_BY_OFFSET[offset];
}
