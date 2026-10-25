import type { NoteName } from '@/lib/theory/note';
import type { Direction, WalkStep } from '@/lib/theory/cadence';

export type Tool = 'select' | 'move' | 'frame' | 'upload';

interface ElementBase {
  id: string;
  /** Canvas-space position of the element's top-left corner. */
  x: number;
  y: number;
  /** Z-order within the page; higher renders on top. */
  z: number;
}

export interface ScaleElement extends ElementBase {
  kind: 'scale';
  root: NoteName;
  octave: number;
  scaleId: string;
  /** Highlight-colour preset index (0 = theme default); cycled with R. */
  highlightColor?: number;
}

export interface ChordElement extends ElementBase {
  kind: 'chord';
  root: NoteName;
  octave: number;
  quality: string;
  inversion: number;
  seventh: boolean;
  /** Highlight-colour preset index (0 = theme default); cycled with R. */
  highlightColor?: number;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  src: string;
  width: number;
  aspectRatio: number;
}

/**
 * How much of the merged circle to draw: only the major keys, plus their
 * relative minors, or the whole diagram (also each key's viiø and V7/vi).
 */
export type CircleComplexity = 'basic' | 'intermediate' | 'advanced';

/** Interactive circle of fifths; clicking a key rotates it to the top. */
export interface CircleElement extends ElementBase {
  kind: 'circle';
  /** The wedge at the top. With `minorCenter`, its relative minor is the key. */
  centerKey: NoteName;
  /** Show each key's signature (♯/♭ count with treble clef) on an outer ring. */
  showSignatures: boolean;
  complexity: CircleComplexity;
  /** Colour the focused key's chords by harmonic function (I, IV, V, vi…). */
  functionColors: boolean;
  /** The centred key is the relative minor of `centerKey` rather than the major. */
  minorCenter: boolean;
  /**
   * The clicked key, highlighted wherever it sits: its chords show their
   * numerals and the rest go quiet. Null = a general view that merely sits in
   * `centerKey`. Clicking selects; double-clicking re-centres (as on Roads).
   */
  focus: CircleFocus | null;
}

/** A focused key: the wedge of major `key`, read as its relative minor if `minor`. */
export interface CircleFocus {
  key: NoteName;
  minor: boolean;
}

/** The seven diatonic degree chords of a scale, as playable chips. */
export interface HarmonyElement extends ElementBase {
  kind: 'harmony';
  root: NoteName;
  octave: number;
  scaleId: string;
  /** Show each degree chord as its diatonic seventh instead of a triad. */
  showSevenths?: boolean;
  /** Highlight-colour preset index (0 = theme default); cycled with R. */
  highlightColor?: number;
}

/**
 * Bartók/Lendvai pitch axis: the 12 chromatic notes grouped into three
 * functional axes (tonic / subdominant / dominant), each a diminished-seventh
 * "cross". The grouping is fixed by the key centre and independent of mode.
 * v1 is static with C on top.
 */
export interface PitchAxisElement extends ElementBase {
  kind: 'pitchaxis';
  centerKey: NoteName;
}

/**
 * Ways Home: the cadence fractal. `walk` is the path from I to the current
 * centre; `dir` shows ways in (approach chords) or homes (where the centre
 * can go). `key` null = functional Roman numerals.
 */
export interface WaysHomeElement extends ElementBase {
  kind: 'wayshome';
  walk: WalkStep[];
  dir: Direction;
  key: NoteName | null;
  /** Corner colour key (which move each colour is). */
  showLegend: boolean;
}

/**
 * Roads: the circle of fifths as a road map around a centre key. Shows the
 * centre's ways in, its homes, or both; neighbour roads run both ways.
 */
export interface RoadsElement extends ElementBase {
  kind: 'roads';
  centerKey: NoteName;
  show: 'in' | 'out' | 'both';
}

/**
 * Named region drawn with the frame tool. Acts as a group: dragging it
 * moves every element fully enclosed in its area. Renders beneath elements.
 */
export interface SectionElement extends ElementBase {
  kind: 'section';
  name: string;
  width: number;
  height: number;
}

/** Unconfirmed spawn stub: dropdowns shown, vanishes if clicked away unfilled. */
export interface StubElement extends ElementBase {
  kind: 'stub';
  root: NoteName | null;
  /** 'scale:<id>', 'chord:<id>', 'harmony:<id>', or '<instant kind>:default' once chosen. */
  typeId: string | null;
  /** Pre-selects the kind tab (e.g. spawned from the circle's radial menu). */
  kindHint?: string;
}

export type CanvasElement =
  | ScaleElement
  | ChordElement
  | HarmonyElement
  | CircleElement
  | PitchAxisElement
  | WaysHomeElement
  | RoadsElement
  | ImageElement
  | SectionElement
  | StubElement;

export interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
}
