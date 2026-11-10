import type { NoteName } from './note';
import { NOTE_NAMES } from './note';
import { getScaleDef } from './scales';
import { HARMONY_MODES } from './harmony';
import { getChordDef } from './chords';
import { CIRCLE_KEYS } from './circle';
import { mod12, type ChordSpec } from './cadence';

/**
 * Progression maps: how chords flow toward home in a key, drawn left to right
 * like the classic harmonic flow chart (vii° → iii → vi → [ii ⇄ IV] → [V / vii°]
 * → I, which can go anywhere). Major and minor follow Mark's reference charts;
 * the modes keep the same grammar with each mode's own cadences, the chords
 * that hold its colour note marked.
 *
 * A map is a spine of slots (a chord, or a bracketed pair that shares a job)
 * joined by flow arrows, plus arcs (shortcuts over or under the line) and
 * borrowed chords from parallel scales, each standing in for a slot.
 *
 * Chord ids and their order (spine, then borrowed) are stored in shared links:
 * APPEND-ONLY per map. A map whose chords move keeps its old order in `linkOrder`.
 */

/** What a chord shows: its function (numeral) or its notes (chord name). */
export type LabelKind = 'functions' | 'notes';

export interface MapChord {
  id: string;
  /** Scale degree, 0-based, in `scale`. */
  degree: number;
  /** Scale the chord is drawn from; defaults to the map's own. */
  scale?: string;
  /** Holds the mode's colour note (the one that sets it apart). */
  colour?: boolean;
}

export interface MapGroup {
  id: string;
  top: MapChord;
  bottom: MapChord;
  /** The two trade places freely: arrows both ways inside the bracket. */
  swap?: boolean;
}

export type MapSlot = MapChord | MapGroup;

export interface MapArc {
  /** Slot or chord ids. */
  from: string;
  to: string;
  side: 'over' | 'under';
}

export interface BorrowedChord extends MapChord {
  /** The slot it stands in for: it goes where that slot goes. */
  slot: string;
}

export interface ProgressionMap {
  /** The scale id the map belongs to. */
  id: string;
  /** Position of the mode in the major scale (0 Ionian … 6 Locrian), for spelling. */
  modeDegree: number;
  /** Left to right; the last slot is home. */
  spine: MapSlot[];
  arcs: MapArc[];
  borrowed: BorrowedChord[];
  /** Moves between borrowed chords, drawn in their lane. */
  borrowedMoves: Array<[string, string]>;
  /** What the play button walks when nothing is written. */
  demo: string[];
  /** One or two sentences under the map; **…** marks the colour chords, set bold. */
  caption: string;
  borrowedCaption?: string;
  /** Chord ids in the order links store them, when the drawing has since moved chords. */
  linkOrder?: string[];
}

export const isGroup = (s: MapSlot): s is MapGroup => 'top' in s;

const c = (id: string, degree: number, opts: Partial<MapChord> = {}): MapChord => ({ id, degree, ...opts });
const g = (id: string, top: MapChord, bottom: MapChord, swap = false): MapGroup => ({ id, top, bottom, swap });
const b = (id: string, degree: number, scale: string, slot: string): BorrowedChord => ({ id, degree, scale, slot });

const MAJOR: ProgressionMap = {
  id: 'major',
  modeDegree: 0,
  spine: [
    c('vii0', 6),
    c('iii', 2),
    c('vi', 5),
    g('pre', c('ii', 1), c('IV', 3), true),
    g('dom', c('V', 4), c('vii', 6)),
    c('I', 0),
  ],
  arcs: [
    { from: 'dom', to: 'vi', side: 'over' },
    { from: 'iii', to: 'pre', side: 'under' },
    { from: 'pre', to: 'I', side: 'under' },
  ],
  borrowed: [
    b('bIII', 2, 'minor', 'iii'),
    b('bVI', 5, 'minor', 'vi'),
    b('ii0', 1, 'minor', 'pre'),
    b('iv', 3, 'minor', 'pre'),
    b('bII', 1, 'phrygian', 'pre'),
    b('bVII', 6, 'minor', 'dom'),
  ],
  borrowedMoves: [['bVI', 'bVII']],
  demo: ['I', 'vi', 'ii', 'V', 'I'],
  caption: 'Chords flow toward I. Bracketed chords share a job: ii and IV prepare, V and vii° pull home. I can go anywhere.',
  borrowedCaption: 'Borrowed from the parallel minor (dashed): each stands in for the chords above it and goes where they go. ♭II is the Neapolitan.',
};

const MINOR: ProgressionMap = {
  id: 'minor',
  modeDegree: 5,
  spine: [
    c('VII', 6),
    c('III', 2),
    c('VI', 5),
    g('pre', c('ii', 1), c('iv', 3), true),
    g('dom', c('V', 4, { scale: 'harmonicMinor' }), c('vii', 6, { scale: 'harmonicMinor' })),
    c('i', 0),
  ],
  arcs: [
    { from: 'dom', to: 'VI', side: 'over' },
    { from: 'pre', to: 'i', side: 'under' },
  ],
  borrowed: [
    b('bII', 1, 'phrygian', 'pre'),
    b('IV', 3, 'melodicMinor', 'pre'),
    b('I', 0, 'major', 'i'),
  ],
  borrowedMoves: [],
  demo: ['i', 'VI', 'iv', 'V', 'i'],
  caption:
    'Chords flow toward i. Bracketed chords share a job: ii° and iv prepare, V and vii° pull home on the raised 7th of harmonic minor, while ♭VII keeps the natural one. i can go anywhere.',
  borrowedCaption: 'Borrowed (dashed): the Neapolitan ♭II, the major IV of melodic minor, and the major I of a Picardy ending.',
};

const DORIAN: ProgressionMap = {
  id: 'dorian',
  modeDegree: 1,
  spine: [
    c('III', 2),
    g('pre', c('v', 4), c('VII', 6), true),
    g('cad', c('ii', 1, { colour: true }), c('IV', 3, { colour: true }), true),
    c('i', 0),
  ],
  arcs: [
    { from: 'III', to: 'cad', side: 'under' },
    { from: 'pre', to: 'i', side: 'over' },
  ],
  borrowed: [b('V', 4, 'harmonicMinor', 'pre'), b('iv', 3, 'minor', 'cad')],
  linkOrder: ['III', 'v', 'ii', 'VII', 'IV', 'i', 'V', 'iv'],
  borrowedMoves: [],
  demo: ['i', 'III', 'ii', 'IV', 'i'],
  caption: 'Minor with a raised 6th. **IV** and **ii** hold it (in fuller colour). vi° is left off: its tritone pulls toward the relative major.',
  borrowedCaption: 'Borrowed (dashed): the major V of harmonic minor and the minor iv of natural minor.',
};

const PHRYGIAN: ProgressionMap = {
  id: 'phrygian',
  modeDegree: 2,
  spine: [
    c('VI', 5),
    g('pre', c('III', 2), c('iv', 3), true),
    g('cad', c('II', 1, { colour: true }), c('vii', 6, { colour: true }), true),
    c('i', 0),
  ],
  arcs: [{ from: 'pre', to: 'i', side: 'under' }],
  borrowed: [b('VII', 6, 'minor', 'cad'), b('I', 0, 'phrygianDominant', 'i')],
  borrowedMoves: [],
  demo: ['i', 'VI', 'iv', 'II', 'i'],
  caption: 'Minor with a lowered 2nd. **♭II** and **♭vii** hold it (in fuller colour) and step straight home. v° is left off.',
  borrowedCaption: 'Borrowed (dashed): ♭VII from natural minor, and the major I that ends the Andalusian cadence.',
};

const LYDIAN: ProgressionMap = {
  id: 'lydian',
  modeDegree: 3,
  spine: [
    c('V', 4),
    g('pre', c('iii', 2), c('vi', 5), true),
    g('cad', c('II', 1, { colour: true }), c('vii', 6, { colour: true }), true),
    c('I', 0),
  ],
  arcs: [],
  borrowed: [],
  borrowedMoves: [],
  demo: ['I', 'vi', 'II', 'I'],
  caption: 'Major with a raised 4th. **II** and **vii** hold it (in fuller colour). ♯iv° is left off: its tritone pulls toward the dominant key.',
};

const MIXOLYDIAN: ProgressionMap = {
  id: 'mixolydian',
  modeDegree: 4,
  spine: [
    c('vi', 5),
    g('pre', c('ii', 1), c('v', 4, { colour: true }), true),
    g('cad', c('VII', 6, { colour: true }), c('IV', 3), true),
    c('I', 0),
  ],
  arcs: [{ from: 'pre', to: 'I', side: 'under' }],
  borrowed: [b('bVI', 5, 'minor', 'vi'), b('V', 4, 'major', 'pre'), b('iv', 3, 'minor', 'cad')],
  borrowedMoves: [],
  demo: ['I', 'VII', 'IV', 'I'],
  caption: 'Major with a lowered 7th. **♭VII** and **v** hold it (in fuller colour). iii° is left off: its tritone pulls toward the subdominant key.',
  borrowedCaption: 'Borrowed (dashed): ♭VI and iv from minor, and the major V of Ionian.',
};

const LOCRIAN: ProgressionMap = {
  id: 'locrian',
  modeDegree: 6,
  spine: [
    c('V', 4, { colour: true }),
    g('pre', c('iii', 2, { colour: true }), c('iv', 3), true),
    g('cad', c('II', 1), c('vii', 6), true),
    c('i', 0),
  ],
  arcs: [{ from: 'pre', to: 'i', side: 'under' }],
  borrowed: [],
  borrowedMoves: [],
  demo: ['i', 'V', 'iv', 'II', 'i'],
  caption: 'A diminished home, rarely a true tonic. **♭iii** and **♭V** hold its ♭5 (in fuller colour); ♭II and ♭vii step into it.',
};

const MAPS: Record<string, ProgressionMap> = Object.fromEntries(
  [MAJOR, MINOR, DORIAN, PHRYGIAN, LYDIAN, MIXOLYDIAN, LOCRIAN].map((m) => [m.id, m]),
);

/** Maps in picker order: major and minor first, then the modes bright to dark. */
export const MAP_GROUPS: Array<{ label: string; ids: string[] }> = [
  { label: 'Major & Minor', ids: ['major', 'minor'] },
  { label: 'Modes', ids: ['lydian', 'mixolydian', 'dorian', 'phrygian', 'locrian'] },
];

export const hasProgressionMap = (scaleId: string) => scaleId in MAPS;

export function getProgressionMap(scaleId: string): ProgressionMap {
  const map = MAPS[scaleId];
  if (!map) throw new Error(`No progression map for scale: ${scaleId}`);
  return map;
}

/** Every chord on the map in codec order: the spine left to right (top before bottom), then borrowed. */
export function mapChords(map: ProgressionMap): MapChord[] {
  const spine = map.spine.flatMap((s) => (isGroup(s) ? [s.top, s.bottom] : [s]));
  return [...spine, ...map.borrowed];
}

/** Every chord in the order shared links store it. */
export function linkChords(map: ProgressionMap): MapChord[] {
  if (!map.linkOrder) return mapChords(map);
  const byId = new Map(mapChords(map).map((ch) => [ch.id, ch]));
  return map.linkOrder.map((id) => byId.get(id)!);
}

export const homeId = (map: ProgressionMap) => (map.spine[map.spine.length - 1] as MapChord).id;

/** Chord ids a slot or chord id stands for. */
export function members(map: ProgressionMap, id: string): string[] {
  const slot = map.spine.find((s) => s.id === id);
  if (slot && isGroup(slot)) return [slot.top.id, slot.bottom.id];
  return [id];
}

// ---- moves ----

const key = (from: string, to: string) => `${from}>${to}`;

/**
 * Every move the map draws, as "from>to" chord-id pairs: the flow between
 * slots, swaps inside brackets and arcs. With `borrowed`, each borrowed chord
 * also takes its slot's moves in and out, trades with the chords it stands in
 * for, and adds its own lane moves.
 */
export function mapMoves(map: ProgressionMap, borrowed = false): Set<string> {
  const out = new Set<string>();
  const link = (from: string, to: string) => {
    for (const a of members(map, from)) for (const z of members(map, to)) out.add(key(a, z));
  };
  map.spine.forEach((slot, i) => {
    if (i > 0) link(map.spine[i - 1].id, slot.id);
    if (isGroup(slot) && slot.swap) {
      out.add(key(slot.top.id, slot.bottom.id));
      out.add(key(slot.bottom.id, slot.top.id));
    }
  });
  for (const arc of map.arcs) link(arc.from, arc.to);

  if (borrowed) {
    const base = new Set(out);
    const standsFor = new Map(mapChords(map).map((ch) => [ch.id, [ch.id]]));
    for (const bc of map.borrowed) {
      const twins = members(map, bc.slot);
      standsFor.set(bc.id, twins);
      for (const t of twins) {
        out.add(key(t, bc.id));
        out.add(key(bc.id, t));
      }
    }
    for (const [a, as] of standsFor) {
      for (const [z, zs] of standsFor) {
        if (as.some((x) => zs.some((y) => base.has(key(x, y))))) out.add(key(a, z));
      }
    }
    for (const [from, to] of map.borrowedMoves) out.add(key(from, to));
  }
  return out;
}

/**
 * Whether a written step follows the map: an arrow carries it, it leaves home
 * (which can go anywhere), or it repeats a chord. Anything else runs against
 * the flow.
 */
export function followsFlow(map: ProgressionMap, moves: Set<string>, from: string, to: string): boolean {
  const home = homeId(map);
  const homes = new Set([home, ...map.borrowed.filter((bc) => bc.slot === home).map((bc) => bc.id)]);
  return from === to || homes.has(from) || moves.has(key(from, to));
}

// ---- spelling ----

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

/**
 * The note `pc` spelled on the letter `steps` above `fromLetter`. Double
 * accidentals and E♯/B♯/C♭/F♭ collapse to the plain enharmonic, as on the
 * other charts, so learners read familiar names.
 */
function spellOn(fromLetter: number, steps: number, pc: number): string {
  const letterIdx = (fromLetter + steps) % 7;
  const letter = LETTERS[letterIdx];
  const offset = mod12(pc - LETTER_PC[letterIdx]);
  if (offset === 0) return letter;
  if (offset === 1 && letter !== 'E' && letter !== 'B') return `${letter}♯`;
  if (offset === 11 && letter !== 'C' && letter !== 'F') return `${letter}♭`;
  return offset <= 6 ? SHARP_NAMES[pc] : FLAT_NAMES[pc];
}

/** A note `steps` letters above a spelled one, at pitch class `pc`, spelled as the maps spell. */
export const spellFrom = (note: string, steps: number, pc: number) => spellOn(LETTERS.indexOf(note[0]), steps, pc);

/** The tonic as its parent major key spells it: G♯ minor (from B), E♭ Dorian (from D♭). */
export function tonicName(root: NoteName, map: ProgressionMap): string {
  const pc = NOTE_NAMES.indexOf(root);
  const parentPc = mod12(pc - MAJOR_STEPS[map.modeDegree]);
  const parent = CIRCLE_KEYS.find((k) => NOTE_NAMES.indexOf(k.note) === parentPc)!.label;
  return spellOn(LETTERS.indexOf(parent[0]), map.modeDegree, pc);
}

// ---- chords ----

export interface ResolvedChord {
  id: string;
  /** "vi", "V7", "viiø7", "♭VII". */
  numeral: string;
  /** "Am", "G7", "B♭" (spelled in the key). */
  name: string;
  /** Chord catalog id, for voicing. */
  quality: string;
  /** Root, semitones above the tonic. */
  pc: number;
  colour: boolean;
  borrowed: boolean;
}

const scaleSemis = (scaleId: string) => {
  const out = [0];
  for (const step of getScaleDef(scaleId).intervals) out.push(out[out.length - 1] + step);
  return out;
};

/** Catalog id for a diatonic seventh: the triad quality plus the 7th's size above the root. */
function seventhId(triad: string, interval: number): string {
  if (triad === 'maj') return interval === 11 ? 'maj7' : '7';
  if (triad === 'min') return 'm7';
  if (triad === 'dim') return interval === 9 ? 'dim7' : 'm7b5';
  return interval === 11 ? 'maj7' : '7';
}

function seventhNumeral(base: string, triad: string, interval: number): string {
  if (triad === 'dim') return interval === 9 ? `${base}7` : `${base.replace('°', 'ø')}7`;
  return interval === 11 && triad === 'maj' ? `${base}maj7` : `${base}7`;
}

/** A map chord in a real key: its numeral, spelled name and quality. */
export function resolveChord(map: ProgressionMap, chord: MapChord, root: NoteName, sevenths = false): ResolvedChord {
  const scale = chord.scale ?? map.id;
  const mode = HARMONY_MODES[scale];
  const semis = scaleSemis(scale);
  const n = semis.length - 1;
  const at = (t: number) => semis[(chord.degree + t) % n] + 12 * Math.floor((chord.degree + t) / n);
  const triad = mode.qualities[chord.degree];
  const interval = mod12(at(6) - at(0));
  const quality = sevenths ? seventhId(triad, interval) : triad;
  const tonic = tonicName(root, map);
  const pc = semis[chord.degree];
  const rootName = spellOn(LETTERS.indexOf(tonic[0]), chord.degree, mod12(NOTE_NAMES.indexOf(root) + pc));
  const base = mode.numerals[chord.degree];
  return {
    id: chord.id,
    numeral: sevenths ? seventhNumeral(base, triad, interval) : base,
    name: `${rootName}${getChordDef(quality).label}`,
    quality,
    pc,
    colour: !!chord.colour,
    borrowed: map.borrowed.some((bc) => bc.id === chord.id),
  };
}

/** Chord specs for a written progression (ids → voicing input for `voiceProgression`). */
export function progressionSpecs(map: ProgressionMap, ids: string[], root: NoteName, sevenths = false): ChordSpec[] {
  const byId = new Map(mapChords(map).map((ch) => [ch.id, ch]));
  return ids
    .filter((id) => byId.has(id))
    .map((id) => {
      const r = resolveChord(map, byId.get(id)!, root, sevenths);
      return { pc: r.pc, quality: r.quality };
    });
}

// ---- written steps ----

/**
 * A written step names its chord and the map it came from, "mode:id". Every
 * map shares the tonic, so one progression can cross modes (in the mandala)
 * and survives a change of mode.
 */
export const stepRef = (mode: string, id: string) => `${mode}:${id}`;

export function parseStep(ref: string): { mode: string; id: string } {
  const at = ref.indexOf(':');
  return { mode: ref.slice(0, Math.max(0, at)), id: ref.slice(at + 1) };
}

function stepChord(ref: string): { map: ProgressionMap; chord: MapChord } | undefined {
  const { mode, id } = parseStep(ref);
  const map = MAPS[mode];
  const chord = map && mapChords(map).find((ch) => ch.id === id);
  return chord ? { map, chord } : undefined;
}

/** The step's chord in a real key, or undefined when it names no map chord. */
export function resolveStep(ref: string, root: NoteName, sevenths = false): ResolvedChord | undefined {
  const s = stepChord(ref);
  return s && resolveChord(s.map, s.chord, root, sevenths);
}

/** Chord specs for written steps (voicing input for `voiceProgression`). */
export function stepSpecs(refs: string[], root: NoteName, sevenths = false): ChordSpec[] {
  return refs.flatMap((ref) => {
    const r = resolveStep(ref, root, sevenths);
    return r ? [{ pc: r.pc, quality: r.quality }] : [];
  });
}

/** The chords on `mode`'s map that sound like the step (same root and triad). */
export function stepTwins(ref: string, mode: string): string[] {
  const s = stepChord(ref);
  const map = MAPS[mode];
  if (!s || !map) return [];
  if (s.map === map) return [s.chord.id];
  const sound = resolveChord(s.map, s.chord, 'C');
  return mapChords(map)
    .filter((ch) => {
      const r = resolveChord(map, ch, 'C');
      return r.pc === sound.pc && r.quality === sound.quality;
    })
    .map((ch) => ch.id);
}

const MOVES = new Map<string, Set<string>>();
const allMoves = (map: ProgressionMap) => {
  if (!MOVES.has(map.id)) MOVES.set(map.id, mapMoves(map, true));
  return MOVES.get(map.id)!;
};

/**
 * Whether a written step follows the flow, read on the later chord's map:
 * a chord there that sounds like the earlier one stands in for it. When
 * that map has no such chord the step changes mode, which never runs against
 * the flow.
 */
export function stepFollows(from: string, to: string): boolean {
  const z = stepChord(to);
  if (!z) return true;
  const twins = stepTwins(from, z.map.id);
  return twins.length === 0 || twins.some((id) => followsFlow(z.map, allMoves(z.map), id, z.chord.id));
}

/** The road a step travels on the later chord's map, when one carries it. */
export function stepRoad(from: string, to: string): { mode: string; from: string; to: string } | undefined {
  const z = stepChord(to);
  if (!z) return undefined;
  const moves = allMoves(z.map);
  const twin = stepTwins(from, z.map.id).find((id) => moves.has(key(id, z.chord.id)));
  return twin === undefined ? undefined : { mode: z.map.id, from: twin, to: z.chord.id };
}
