import { NOTE_NAMES, type NoteName } from './note';
import { getChordDef } from './chords';
import { CIRCLE_KEYS } from './circle';

/**
 * The four common ways home, each defined by the root motion from the
 * approach chord into its home. Pitch classes here are relative to the walk's
 * I (0 = I), so the same maths serves the functional and keyed views.
 *
 * Every chord X has four ways in (approachesOf: the chords that resolve to X)
 * and four homes (homesOf: where X goes if it plays each role). Dominant and
 * plagal are inverse moves, i.e. one road driven in opposite directions.
 */
export type CadenceType = 'dominant' | 'plagal' | 'backdoor' | 'tritone';
export type Direction = 'in' | 'out';
export type Corner = 'tr' | 'tl' | 'bl' | 'br';

/** Registry order. APPEND-ONLY: the URL codec stores indices into this list. */
export const CADENCE_TYPES: CadenceType[] = ['dominant', 'plagal', 'backdoor', 'tritone'];

export interface CadenceDef {
  type: CadenceType;
  label: string;
  /** The approach chord's numeral relative to its home. */
  numeral: string;
  /** Semitones from the approach root up to the home root. */
  interval: number;
  corner: Corner;
  colorVar: string;
  /** Chord quality the approach chord takes when it makes this move. */
  approachQuality: string;
}

export const CADENCES: Record<CadenceType, CadenceDef> = {
  dominant: { type: 'dominant', label: 'Dominant', numeral: 'V', interval: 5, corner: 'tr', colorVar: 'var(--cadence-dominant)', approachQuality: '7' },
  plagal: { type: 'plagal', label: 'Plagal', numeral: 'IV', interval: 7, corner: 'tl', colorVar: 'var(--cadence-plagal)', approachQuality: 'maj7' },
  backdoor: { type: 'backdoor', label: 'Backdoor', numeral: '♭VII', interval: 2, corner: 'bl', colorVar: 'var(--cadence-backdoor)', approachQuality: '7' },
  tritone: { type: 'tritone', label: 'Tritone sub', numeral: '♭II', interval: 11, corner: 'br', colorVar: 'var(--cadence-tritone)', approachQuality: '7' },
};

/** Unit diagonal per corner, screen coordinates (y grows downward). */
export const CORNER_VECTOR: Record<Corner, { x: 1 | -1; y: 1 | -1 }> = {
  tr: { x: 1, y: -1 },
  tl: { x: -1, y: -1 },
  bl: { x: -1, y: 1 },
  br: { x: 1, y: 1 },
};

const HOME_QUALITY = 'maj7';

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export const approachOf = (pc: number, type: CadenceType) => mod12(pc - CADENCES[type].interval);
export const homeOf = (pc: number, type: CadenceType) => mod12(pc + CADENCES[type].interval);
export const stepOf = (pc: number, dir: Direction, type: CadenceType) =>
  dir === 'in' ? approachOf(pc, type) : homeOf(pc, type);

const byType = (fn: (t: CadenceType) => number) =>
  Object.fromEntries(CADENCE_TYPES.map((t) => [t, fn(t)])) as Record<CadenceType, number>;

export const approachesOf = (pc: number) => byType((t) => approachOf(pc, t));
export const homesOf = (pc: number) => byType((t) => homeOf(pc, t));

const NUMERALS = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♭V', 'V', '♭VI', 'VI', '♭VII', 'VII'];

/** Roman numeral relative to I, one fixed spelling per semitone. */
export const numeral = (pc: number) => NUMERALS[mod12(pc)];

// ---- fractal ----

export interface FractalNode {
  pc: number;
  /** Moves from the focus to this node; its last entry is the node's corner. */
  path: CadenceType[];
  level: number;
}

/** Breadth-first nodes around `focusPc`, `depth` levels including the focus. */
export function fractal(focusPc: number, dir: Direction, depth: number): FractalNode[] {
  const nodes: FractalNode[] = [{ pc: mod12(focusPc), path: [], level: 0 }];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.level >= depth - 1) continue;
    for (const t of CADENCE_TYPES) {
      nodes.push({ pc: stepOf(node.pc, dir, t), path: [...node.path, t], level: node.level + 1 });
    }
  }
  return nodes;
}

// ---- walks ----

export interface WalkStep {
  dir: Direction;
  type: CadenceType;
}

export interface ChordSpec {
  /** Root, relative to I. */
  pc: number;
  /** Chord catalog id (see chords.ts). */
  quality: string;
}

/** Pitch classes visited by a walk, starting at I. */
export function walkPcs(walk: WalkStep[]): number[] {
  const out = [0];
  for (const s of walk) out.push(stepOf(out[out.length - 1], s.dir, s.type));
  return out;
}

/**
 * One same-direction run as a progression in musical time. A ways-in run is
 * heard from its furthest chord back to its start; a homes run is heard
 * forward. Each chord takes the quality of the move it makes into the next;
 * the arrival is a maj7.
 */
export function runToProgression(startPc: number, dir: Direction, types: CadenceType[]): ChordSpec[] {
  const pcs = [mod12(startPc)];
  for (const t of types) pcs.push(stepOf(pcs[pcs.length - 1], dir, t));
  if (dir === 'in') {
    const chords = types.map((t, i) => ({ pc: pcs[i + 1], quality: CADENCES[t].approachQuality })).reverse();
    return [...chords, { pc: pcs[0], quality: HOME_QUALITY }];
  }
  const chords = types.map((t, i) => ({ pc: pcs[i], quality: CADENCES[t].approachQuality }));
  return [...chords, { pc: pcs[pcs.length - 1], quality: HOME_QUALITY }];
}

/** The walk's progression: only the steps since the last flip of direction. */
export function walkToProgression(walk: WalkStep[]): ChordSpec[] {
  const pcs = walkPcs(walk);
  if (walk.length === 0) return [{ pc: 0, quality: HOME_QUALITY }];
  let start = walk.length - 1;
  while (start > 0 && walk[start - 1].dir === walk[walk.length - 1].dir) start--;
  const run = walk.slice(start);
  return runToProgression(pcs[start], run[0].dir, run.map((s) => s.type));
}

// ---- chains ----

export const MAP_CHAINS = Object.fromEntries(
  CADENCE_TYPES.map((t) => [t, runToProgression(0, 'in', [t, t, t])]),
) as Record<CadenceType, ChordSpec[]>;

export const JAZZ_CHAINS: Record<CadenceType, ChordSpec[]> = {
  dominant: [{ pc: 2, quality: 'm7' }, { pc: 7, quality: '7' }, { pc: 0, quality: 'maj7' }],
  plagal: [{ pc: 5, quality: 'maj7' }, { pc: 5, quality: 'm6' }, { pc: 0, quality: 'maj7' }],
  backdoor: [{ pc: 5, quality: 'm7' }, { pc: 10, quality: '7' }, { pc: 0, quality: 'maj7' }],
  tritone: [{ pc: 2, quality: 'm7' }, { pc: 1, quality: '7' }, { pc: 0, quality: 'maj7' }],
};

const MINOR_QUALITIES = new Set(['min', 'm7', 'm6', 'm7b5', 'm9']);
const NUMERAL_SUFFIX: Record<string, string> = { m7: '7', m6: '6', min: '', maj: '' };

/** Numeral with quality, minor chords in lower case: "ii7", "V7", "IVmaj7". */
export function chordLabel(spec: ChordSpec): string {
  const base = numeral(spec.pc);
  const minor = MINOR_QUALITIES.has(spec.quality);
  const suffix = NUMERAL_SUFFIX[spec.quality] ?? getChordDef(spec.quality).label;
  return `${minor ? base.toLowerCase() : base}${suffix}`;
}

// ---- spelling in a real key ----

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
/** Scale degree (1–7) each semitone above I is spelled on. */
const DEGREE_OF = [1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 7];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/** The key's conventional spelling (flat side shows flats), from the circle. */
export function keyLabel(key: NoteName): string {
  return CIRCLE_KEYS.find((k) => k.note === key)!.label;
}

/**
 * Root name of the chord `pc` semitones above I in `key`. Letters follow the
 * degree; double accidentals and C♭/F♭/E♯/B♯ collapse to the plain
 * enharmonic so learners read familiar names.
 */
export function rootName(pc: number, key: NoteName): string {
  const tonic = keyLabel(key);
  const tonicLetter = LETTERS.indexOf(tonic[0]);
  const rel = mod12(pc);
  const letterIdx = (tonicLetter + DEGREE_OF[rel] - 1) % 7;
  const target = mod12(NOTE_NAMES.indexOf(key) + rel);
  const offset = mod12(target - LETTER_PC[letterIdx]);
  const letter = LETTERS[letterIdx];
  if (offset === 0) return letter;
  if (offset === 1 && letter !== 'E' && letter !== 'B') return `${letter}♯`;
  if (offset === 11 && letter !== 'C' && letter !== 'F') return `${letter}♭`;
  // Collapse: a natural if one exists, else keep the direction of the original.
  return offset <= 6 ? SHARP_NAMES[target] : FLAT_NAMES[target];
}

export function chordName(spec: ChordSpec, key: NoteName): string {
  return `${rootName(spec.pc, key)}${getChordDef(spec.quality).label}`;
}

// ---- voicing ----

const BASS_LOW = 16; // E2
const RH_LOW = 28; // E3: right-hand voicings start at or above here
const RH_HIGH = 43; // G4: highest allowed bottom note of a right-hand voicing
const RH_CENTRE = 40; // E4: where the first voicing sits

function closeVoicings(pcs: number[]): number[][] {
  const out: number[][] = [];
  for (let k = 0; k < pcs.length; k++) {
    const order = [...pcs.slice(k), ...pcs.slice(0, k)];
    for (let low = RH_LOW; low <= RH_HIGH; low++) {
      if (mod12(low) !== order[0]) continue;
      const voicing = [low];
      for (const pc of order.slice(1)) {
        const prev = voicing[voicing.length - 1];
        voicing.push(prev + mod12(pc - prev) || prev + 12);
      }
      out.push(voicing);
    }
  }
  return out;
}

const mean = (ps: number[]) => ps.reduce((a, b) => a + b, 0) / ps.length;

function movement(a: number[], b: number[]): number {
  if (a.length === b.length) return a.reduce((sum, p, i) => sum + Math.abs(p - b[i]), 0);
  return b.reduce((sum, p) => sum + Math.min(...a.map((q) => Math.abs(p - q))), 0);
}

/**
 * Absolute pitches per chord: left-hand root in the bass (E2–D♯3) plus a
 * right-hand close voicing (the chord's first four tones), each voice-led to
 * the nearest inversion of the next.
 */
export function voiceProgression(specs: ChordSpec[], key: NoteName = 'C'): number[][] {
  const keyPc = NOTE_NAMES.indexOf(key);
  let prev: number[] | null = null;
  return specs.map((spec) => {
    const root = mod12(keyPc + spec.pc);
    const tones = getChordDef(spec.quality).formula.slice(0, 4).map((o) => mod12(root + o));
    const candidates = closeVoicings(tones);
    const score = (v: number[]) =>
      prev ? movement(prev, v) * 10 + Math.abs(mean(v) - RH_CENTRE) : Math.abs(mean(v) - RH_CENTRE);
    const best = candidates.reduce((a, b) => (score(b) < score(a) ? b : a));
    prev = best;
    const bass = BASS_LOW + mod12(root - BASS_LOW);
    return [bass, ...best];
  });
}
