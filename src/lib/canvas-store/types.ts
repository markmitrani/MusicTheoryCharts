import type { NoteName } from '@/lib/theory/note';

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
}

export interface ChordElement extends ElementBase {
  kind: 'chord';
  root: NoteName;
  octave: number;
  quality: string;
  inversion: number;
  seventh: boolean;
}

export interface ImageElement extends ElementBase {
  kind: 'image';
  src: string;
  width: number;
  aspectRatio: number;
}

/** Interactive circle of fifths; clicking a key rotates it to the top. */
export interface CircleElement extends ElementBase {
  kind: 'circle';
  centerKey: NoteName;
  /** Show each key's signature (♯/♭ count with treble clef) on an outer ring. */
  showSignatures: boolean;
  /** Show the relative minor of each key on an inner ring. */
  showRelativeMinor: boolean;
}

/** The seven diatonic degree chords of a scale, as playable chips. */
export interface HarmonyElement extends ElementBase {
  kind: 'harmony';
  root: NoteName;
  octave: number;
  scaleId: string;
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
  /** 'scale:<id>', 'chord:<id>', 'harmony:<id>', or 'circle:default' once chosen. */
  typeId: string | null;
  /** Pre-selects the kind tab (e.g. spawned from the circle's radial menu). */
  kindHint?: string;
}

export type CanvasElement =
  | ScaleElement
  | ChordElement
  | HarmonyElement
  | CircleElement
  | ImageElement
  | SectionElement
  | StubElement;

export interface Page {
  id: string;
  name: string;
  elements: CanvasElement[];
}
